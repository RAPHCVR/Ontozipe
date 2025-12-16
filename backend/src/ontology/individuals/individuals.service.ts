import { Injectable, BadRequestException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import * as fs from "fs";
import * as path from "path";
import { OntologyBaseService } from "../common/base-ontology.service";
import { IndividualNode, Property } from "../common/types";
import { toRdfTerm, rdfLiteral } from "../common/rdf.utils";
import { escapeSparqlLiteral } from "../../utils/sparql.utils";

const OWL_THING = "http://www.w3.org/2002/07/owl#Thing";
const GENERIC_CLASS_IRIS = new Set<string>([
	"http://www.w3.org/2002/07/owl#NamedIndividual",
	OWL_THING,
	"http://www.w3.org/2002/07/owl#Restriction",
	"http://www.w3.org/2002/07/owl#Axiom",
]);

const resolveInitialClassId = (candidate?: string): string =>
	candidate && !GENERIC_CLASS_IRIS.has(candidate)
		? candidate
		: candidate || OWL_THING;

const mergeClassId = (current?: string, candidate?: string): string => {
	if (
		candidate &&
		(!current || GENERIC_CLASS_IRIS.has(current)) &&
		!GENERIC_CLASS_IRIS.has(candidate)
	) {
		return candidate;
	}
	return current || candidate || OWL_THING;
};

@Injectable()
export class IndividualsService extends OntologyBaseService {
	constructor(httpService: HttpService) {
		super(httpService);
	}

	async createIndividual(
		node: IndividualNode,
		requesterIri: string,
		ontologyIri: string,
		visibleToGroups: string[] = [],
		pdfs?: PdfInfo[]
	): Promise<void> {
		await this.enforceWritePermission(requesterIri, ontologyIri);

		if (await this.individualExists(node.id)) {
			throw new Error("IRI already exists");
		}

		const now = new Date().toISOString();

		let triples = `<${node.id}> rdf:type <${node.classId}> ;\n`;
		triples += `\trdfs:label ${rdfLiteral(node.label)} ;\n`;
		triples += `\tcore:inProject <${ontologyIri}> ;\n`;
		triples += `\tcore:createdBy <${requesterIri}> ;\n`;
		triples += `\tcore:createdAt "${now}"^^xsd:dateTime ;\n`;
		triples += `\tcore:updatedBy <${requesterIri}> ;\n`;
		triples += `\tcore:updatedAt "${now}"^^xsd:dateTime .\n`;

		for (const prop of node.properties) {
			triples += `<${node.id}> <${prop.predicate}> ${toRdfTerm(prop.value, prop.isLiteral)} .\n`;
		}

		// Ajout des PDFs si fournis
		if (pdfs && Array.isArray(pdfs)) {
			for (const pdf of pdfs) {
				if (pdf && pdf.url) {
					triples += `<${node.id}> <http://example.org/core#pdfUrl> \"\"\"${escapeSparqlLiteral(pdf.url)}\"\"\" .\n`;
					if (pdf.originalName) {
						triples += `<${node.id}> <http://example.org/core#pdfOriginalName> \"\"\"${escapeSparqlLiteral(pdf.originalName)}\"\"\" .\n`;
					}
				}
			}
		}

		for (const groupIri of visibleToGroups) {
			triples += `<${node.id}> core:visibleTo <${groupIri}> .\n`;
		}

		const update = `
            PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
            PREFIX core: <${this.CORE}>
            INSERT DATA {
                GRAPH <${ontologyIri}> {
                    ${triples}
                }
            }
        `;

		await this.runUpdate(update);
	}

	async updateIndividual(
		iri: string,
		addProps: Property[] = [],
		_delProps: Property[] = [],
		requesterIri: string,
		newVisibleToGroups: string[] | undefined,
		ontologyIri?: string,
		pdfs?: PdfInfo[]
	): Promise<void> {
		if (!ontologyIri) {
			throw new BadRequestException("ontologyIri manquant");
		}

		await this.enforceWritePermission(requesterIri, ontologyIri);

		const now = new Date().toISOString();

		const mkVal = (value: string, isLiteral: boolean) =>
			isLiteral ? rdfLiteral(value) : `<${value}>`;

		const perPropUpdates = addProps
			.map(
				(prop) => `
          WITH <${ontologyIri}>
          DELETE { <${iri}> <${prop.predicate}> ?old . }
          ${
						prop.value === "" || prop.value == null
							? ""
							: `INSERT { <${iri}> <${prop.predicate}> ${mkVal(prop.value, prop.isLiteral)} . }`
					}
          WHERE  { OPTIONAL { <${iri}> <${prop.predicate}> ?old . } }
        `
			)
			.join(" ;\n");

		let aclUpdate = "";
		if (Array.isArray(newVisibleToGroups)) {
			const aclInserts = newVisibleToGroups
				.map((group) => `<${iri}> <${this.CORE}visibleTo> <${group}> .`)
				.join("\n");
			aclUpdate = `
            WITH <${ontologyIri}>
            DELETE { <${iri}> <${this.CORE}visibleTo> ?g . }
            INSERT { ${aclInserts} }
            WHERE  { OPTIONAL { <${iri}> <${this.CORE}visibleTo> ?g . } }
        `;
		}

		let pdfUpdate = "";
		if (pdfs !== undefined) {
			pdfUpdate = `
            WITH <${ontologyIri}>
            DELETE { <${iri}> <http://example.org/core#pdfUrl> ?oldPdf . <${iri}> <http://example.org/core#pdfOriginalName> ?oldName . }
            ${
							Array.isArray(pdfs) && pdfs.length > 0
								? `INSERT { ${pdfs
										.filter(Boolean)
										.map(
											(pdf) =>
												`<${iri}> <http://example.org/core#pdfUrl> \"\"\"${escapeSparqlLiteral(pdf.url)}\"\"\" .${pdf.originalName ? `\n<${iri}> <http://example.org/core#pdfOriginalName> \"\"\"${escapeSparqlLiteral(pdf.originalName)}\"\"\" .` : ""}`
										)
										.join("\n")} }`
								: ""
						}
            WHERE { OPTIONAL { <${iri}> <http://example.org/core#pdfUrl> ?oldPdf . OPTIONAL { <${iri}> <http://example.org/core#pdfOriginalName> ?oldName . } } }
            `;
		}
		const touchUpdate = `
            PREFIX core: <${this.CORE}>
            PREFIX xsd: <${this.XSD}>
            WITH <${ontologyIri}>
            DELETE { <${iri}> core:updatedBy ?u ; core:updatedAt ?d . }
            INSERT {
              <${iri}> core:updatedBy <${requesterIri}> ;
                      core:updatedAt "${now}"^^xsd:dateTime .
            }
            WHERE  { OPTIONAL { <${iri}> core:updatedBy ?u ; core:updatedAt ?d . } }
        `;

		const statements = [perPropUpdates, aclUpdate, pdfUpdate, touchUpdate]
			.map((part) => part.trim())
			.filter(Boolean)
			.join(" ;\n");

		if (statements) {
			await this.runUpdate(statements);
		}
	}

	async deleteIndividual(
		iri: string,
		ontologyIri: string,
		requesterIri: string
	): Promise<void> {
		await this.enforceWritePermission(requesterIri, ontologyIri);

		await this.deletePDFsOfIndividual(iri, ontologyIri);
		const update = `DELETE WHERE { GRAPH <${ontologyIri}> { <${iri}> ?p ?o . } }`;
		await this.runUpdate(update);
	}

	async deletePDFsOfIndividual(
		iri: string,
		ontologyIri: string
	): Promise<void> {
		const sparql = `
                SELECT ?pdf WHERE {
                    GRAPH <${ontologyIri}> {
                        <${iri}> <http://example.org/core#pdfUrl> ?pdf .
                    }
                }
            `;
		const params = new URLSearchParams({
			query: sparql,
			format: "application/sparql-results+json",
		});
		try {
			const res = await (this.httpService && this.httpService.get
				? await (
						await import("rxjs")
					).lastValueFrom(this.httpService.get(this.fusekiUrl, { params }))
				: { data: { results: { bindings: [] } } });
			const pdfUrls = res.data.results.bindings.map((b: any) => b.pdf.value);

			// 2. Supprimer les fichiers PDF du disque
			for (const url of pdfUrls) {
				const filePath = path.join(
					__dirname,
					"../../../uploads",
					path.basename(url)
				);
				if (filePath.startsWith(path.resolve(__dirname, "../../../uploads"))) {
					try {
						await fs.promises.unlink(filePath);
					} catch (e) {
						// Optionnel : log ou ignorer si le fichier n'existe pas
					}
				}
			}
		} catch (e) {
			// Optionnel : log erreur récupération ou suppression fichiers PDF
		}
	}

	async getIndividualsForOntology(
		userIri: string,
		ontologyIri: string,
		preferredLang?: string
	): Promise<IndividualNode[]> {
		const langPreference = this.sanitizeLang(preferredLang);
		const userGroups = await this.getUserGroups(userIri);
		const groupsList = userGroups.map((g) => `<${g}>`).join(", ");
		const aclFilter = `
            EXISTS { ?s core:createdBy <${userIri}> } ||
            ${userGroups.length > 0 ? `(!BOUND(?vg) || ?vg IN (${groupsList}))` : `(!BOUND(?vg))`}
          `.trim();

		const data = await this.runSelect(`
            PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX owl:  <http://www.w3.org/2002/07/owl#>
            PREFIX core: <${this.CORE}>
            PREFIX foaf: <http://xmlns.com/foaf/0.1/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX schema: <http://schema.org/>
            PREFIX dct: <http://purl.org/dc/terms/>

            SELECT ?s ?sLabel ?sLabelLang ?clsEff ?createdBy ?createdAt ?updatedBy ?updatedAt ?vg
                   ?pred ?predLabel ?predLabelLang ?val ?valLang ?valLabel ?valLabelLang ?vCls
            WHERE {
              GRAPH <${ontologyIri}> {
                { ?s core:inProject <${ontologyIri}> . }
                UNION
                { ?s rdf:type ?cls0 . }

                OPTIONAL { ?s rdf:type ?cls }
                BIND(COALESCE(?cls, ?cls0) AS ?clsEff)

                FILTER NOT EXISTS { ?s a owl:Class }
                FILTER NOT EXISTS { ?s a owl:ObjectProperty }
                FILTER NOT EXISTS { ?s a owl:DatatypeProperty }
                FILTER NOT EXISTS { ?s a owl:Ontology }

                OPTIONAL { ?s rdfs:label ?sLabel . BIND(LANG(?sLabel) AS ?sLabelLang) }
                OPTIONAL { ?s core:visibleTo ?vg }
                OPTIONAL { ?s core:createdBy ?createdBy }
                OPTIONAL { ?s core:createdAt ?createdAt }
                OPTIONAL { ?s core:updatedBy ?updatedBy }
                OPTIONAL { ?s core:updatedAt ?updatedAt }

                ?s ?pred ?val .
                FILTER(
                  ?pred != rdf:type &&
                  ?pred != core:inProject &&
                  ?pred != core:createdBy &&
                  ?pred != core:createdAt &&
                  ?pred != core:updatedBy &&
                  ?pred != core:updatedAt &&
                  ?pred != core:visibleTo
                )
                OPTIONAL { ?pred rdfs:label ?predLabel . BIND(LANG(?predLabel) AS ?predLabelLang) }
              }

              BIND(LANG(?val) AS ?valLang)

              OPTIONAL {
                { ?val (rdfs:label|foaf:name|skos:prefLabel|schema:name|dct:title) ?valLabel }
                UNION
                { GRAPH ?g { ?val (rdfs:label|foaf:name|skos:prefLabel|schema:name|dct:title) ?valLabel } }
                BIND(LANG(?valLabel) AS ?valLabelLang)
              }

              OPTIONAL {
                { ?val rdf:type ?_vCls1 }
                UNION
                { GRAPH ?gx { ?val rdf:type ?_vCls2 } }
              }
              BIND(COALESCE(?_vCls1, ?_vCls2) AS ?vCls)

              FILTER( ${aclFilter} )
            }
        `);

		type Row = {
			s: { value: string };
			sLabel?: { value: string };
			sLabelLang?: { value: string };
			clsEff?: { value: string };
			createdBy?: { value: string };
			createdAt?: { value: string };
			updatedBy?: { value: string };
			updatedAt?: { value: string };
			vg?: { value: string };
			pred: { value: string };
			predLabel?: { value: string };
			predLabelLang?: { value: string };
			val: { value: string; type: string };
			valLang?: { value: string };
			valLabel?: { value: string };
			valLabelLang?: { value: string };
			vCls?: { value: string };
		};

		const map = new Map<string, IndividualNode>();
		const nodeLabelStates = new Map<string, LabelState>();
		const predicateLabelStates = new Map<string, LabelState>();
		const literalCandidates = new Map<string, Map<string, LiteralBucket>>();

		(data.results.bindings as Row[]).forEach((row) => {
			const id = row.s.value;
			if (!map.has(id)) {
				map.set(id, {
					id,
					label: this.iriLocalName(id),
					classId: resolveInitialClassId(row.clsEff?.value),
					properties: [],
					children: [],
				});
			}
			const entry = map.get(id)!;
			const subjectLabelState = this.pickLabel(
				nodeLabelStates.get(id),
				row.sLabel?.value,
				row.sLabelLang?.value,
				langPreference
			);
			if (subjectLabelState) {
				nodeLabelStates.set(id, subjectLabelState);
				entry.label = subjectLabelState.value;
			} else if (!nodeLabelStates.has(id)) {
				entry.label = entry.label || this.iriLocalName(id);
			}

			entry.classId = mergeClassId(entry.classId, row.clsEff?.value);
			if (row.createdBy?.value) entry.createdBy = row.createdBy.value;
			if (row.createdAt?.value) entry.createdAt = row.createdAt.value;
			if (row.updatedBy?.value) entry.updatedBy = row.updatedBy.value;
			if (row.updatedAt?.value) entry.updatedAt = row.updatedAt.value;
			if (row.vg?.value) {
				entry.visibleTo ??= [];
				if (!entry.visibleTo.includes(row.vg.value))
					entry.visibleTo.push(row.vg.value);
			}

			const predicateState = this.pickLabel(
				predicateLabelStates.get(row.pred.value),
				row.predLabel?.value,
				row.predLabelLang?.value,
				langPreference
			);
			if (predicateState)
				predicateLabelStates.set(row.pred.value, predicateState);
			const predicateLabel =
				predicateLabelStates.get(row.pred.value)?.value ||
				this.iriLocalName(row.pred.value);

			const isUri = row.val?.type === "uri";
			let valueLabel = row.valLabel?.value?.trim();
			if (isUri) {
				const relatedId = row.val.value;
				const relatedState = this.pickLabel(
					nodeLabelStates.get(relatedId),
					row.valLabel?.value,
					row.valLabelLang?.value,
					langPreference
				);
				if (relatedState) {
					nodeLabelStates.set(relatedId, relatedState);
					valueLabel = relatedState.value;
				} else {
					valueLabel = nodeLabelStates.get(relatedId)?.value || valueLabel;
				}

				const relatedLabel =
					nodeLabelStates.get(relatedId)?.value || this.iriLocalName(relatedId);
				const related = map.get(relatedId);
				if (!related) {
					map.set(relatedId, {
						id: relatedId,
						label: relatedLabel,
						classId: resolveInitialClassId(row.vCls?.value),
						properties: [],
						children: [],
					});
				} else {
					related.classId = mergeClassId(related.classId, row.vCls?.value);
					related.label = relatedLabel;
				}

				entry.properties.push({
					predicate: row.pred.value,
					predicateLabel,
					value: row.val.value,
					valueLabel: valueLabel || this.iriLocalName(row.val.value),
					isLiteral: false,
				});
				return;
			}

			const subjectBuckets =
				literalCandidates.get(id) ?? new Map<string, LiteralBucket>();
			if (!literalCandidates.has(id)) {
				literalCandidates.set(id, subjectBuckets);
			}
			const bucket = subjectBuckets.get(row.pred.value) ?? { predicateLabel };
			if (!bucket.predicateLabel && predicateLabel) {
				bucket.predicateLabel = predicateLabel;
			}
			const candidateLiteral = this.pickLabel(
				bucket.state,
				row.val.value,
				row.valLang?.value,
				langPreference
			);
			if (candidateLiteral) {
				bucket.state = candidateLiteral;
				if (predicateLabel) {
					bucket.predicateLabel = predicateLabel;
				}
				subjectBuckets.set(row.pred.value, bucket);
			}
			return;
		});

		for (const [subjectId, predicates] of literalCandidates.entries()) {
			const entry = map.get(subjectId);
			if (!entry) continue;
			for (const [predicateIri, info] of predicates.entries()) {
				if (!info.state) continue;
				entry.properties.push({
					predicate: predicateIri,
					predicateLabel:
						info.predicateLabel || this.iriLocalName(predicateIri),
					value: info.state.value,
					valueLabel: info.state.value,
					isLiteral: true,
				});
			}
		}

		for (const node of map.values()) {
			node.label =
				nodeLabelStates.get(node.id)?.value ||
				node.label ||
				this.iriLocalName(node.id);

			if (!node.properties || node.properties.length === 0) {
				node.properties = node.properties ?? [];
				continue;
			}

			if (node.properties.length === 1) {
				node.properties = node.properties.map((prop) =>
					this.finalizeProperty(prop)
				);
				continue;
			}

			const uniq = new Map<string, Property>();
			for (const prop of node.properties) {
				const key = `${prop.predicate}||${prop.isLiteral ? "L" : "R"}||${prop.value}`;
				const previous = uniq.get(key);
				if (!previous) {
					uniq.set(key, prop);
				} else {
					const merged: Property = {
						predicate: prop.predicate,
						predicateLabel: prop.predicateLabel || previous.predicateLabel,
						value: prop.value,
						valueLabel: prop.valueLabel || previous.valueLabel,
						isLiteral: prop.isLiteral,
					};
					uniq.set(key, merged);
				}
			}
			node.properties = Array.from(uniq.values()).map((prop) =>
				this.finalizeProperty(prop)
			);
		}

		return Array.from(map.values());
	}

	private finalizeProperty(prop: Property): Property {
		return {
			...prop,
			predicateLabel: prop.predicateLabel || this.iriLocalName(prop.predicate),
			valueLabel:
				prop.valueLabel ||
				(prop.isLiteral ? prop.value : this.iriLocalName(prop.value)),
		};
	}

	private computeLabelScore(
		candidateLang?: string,
		preferredLang?: string | null
	): number {
		if (!preferredLang) {
			return candidateLang ? 2 : 3;
		}
		if (!candidateLang) return 3;
		const normalizedCandidate = candidateLang.toLowerCase();
		const normalizedPreferred = preferredLang.toLowerCase();
		if (normalizedCandidate === normalizedPreferred) return 5;
		if (normalizedCandidate.split("-")[0] === normalizedPreferred.split("-")[0])
			return 4;
		return 2;
	}

	private pickLabel(
		current: LabelState | undefined,
		candidateValue?: string,
		candidateLang?: string,
		preferredLang?: string | null
	): LabelState | undefined {
		if (!candidateValue) return current;
		const value = candidateValue.trim();
		if (!value) return current;
		const lang = this.sanitizeLang(candidateLang);
		const score = this.computeLabelScore(lang, preferredLang);
		if (
			!current ||
			score > current.score ||
			(score === current.score && lang && !current.lang)
		) {
			return { value, lang, score };
		}
		return current;
	}

	private iriLocalName(iri: string): string {
		const parts = iri.split(/[#/]/);
		const raw = parts[parts.length - 1] || iri;
		try {
			const decoded = decodeURIComponent(raw);
			return decoded || raw;
		} catch (_error) {
			return raw;
		}
	}

	async getAllPersons(preferredLang?: string): Promise<IndividualNode[]> {
		const langPreference = this.sanitizeLang(preferredLang);
		const data = await this.runSelect(`
            PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX core:  <${this.CORE}>
            PREFIX foaf:  <http://xmlns.com/foaf/0.1/>

            SELECT ?u ?uLabel ?uLabelLang ?uName ?uNameLang ?pred ?predLabel ?predLabelLang ?val ?valLabel ?valLabelLang ?grp ?grpLabel ?grpLabelLang WHERE {
              ?u rdf:type core:User .
              OPTIONAL { ?u core:hasAccount ?acc }
              OPTIONAL { ?u rdfs:label ?uLabel . BIND(LANG(?uLabel) AS ?uLabelLang) }
              OPTIONAL { ?u foaf:name ?uName . BIND(LANG(?uName) AS ?uNameLang) }
              OPTIONAL {
                { ?grp core:hasMember ?u }
                UNION
                { GRAPH ?ng { ?grp core:hasMember ?u } }
                OPTIONAL { ?grp rdfs:label ?grpLabel . BIND(LANG(?grpLabel) AS ?grpLabelLang) }
              }
              ?u ?pred ?val .
              FILTER (?pred != rdf:type)
              OPTIONAL { ?pred rdfs:label ?predLabel . BIND(LANG(?predLabel) AS ?predLabelLang) }
              OPTIONAL { ?val  rdfs:label ?valLabel . BIND(LANG(?valLabel) AS ?valLabelLang) }
            }
        `);

		type Row = {
			u: { value: string };
			uLabel?: { value: string };
			uLabelLang?: { value: string };
			uName?: { value: string };
			uNameLang?: { value: string };
			pred: { value: string };
			predLabel?: { value: string };
			predLabelLang?: { value: string };
			val: { value: string; type: string };
			valLabel?: { value: string };
			valLabelLang?: { value: string };
			grp?: { value: string };
			grpLabel?: { value: string };
			grpLabelLang?: { value: string };
		};

		const USER_CLASS_IRI = `${this.CORE}User`;
		const personMap = new Map<string, IndividualNode>();
		const personLabelStates = new Map<string, LabelState>();
		const predicateLabelStates = new Map<string, LabelState>();
		const valueLabelStates = new Map<string, LabelState>();
		const groupLabelStates = new Map<string, LabelState>();

		(data.results.bindings as Row[]).forEach((row) => {
			const id = row.u.value;
			if (!personMap.has(id)) {
				personMap.set(id, {
					id,
					label: this.iriLocalName(id),
					classId: USER_CLASS_IRI,
					properties: [],
					children: [],
				});
			}
			const person = personMap.get(id)!;

			let personState = this.pickLabel(
				personLabelStates.get(id),
				row.uLabel?.value,
				row.uLabelLang?.value,
				langPreference
			);
			personState = this.pickLabel(
				personState,
				row.uName?.value,
				row.uNameLang?.value,
				langPreference
			);
			if (personState) {
				personLabelStates.set(id, personState);
				person.label = personState.value;
			}

			if (row.grp?.value) {
				const groupState = this.pickLabel(
					groupLabelStates.get(row.grp.value),
					row.grpLabel?.value,
					row.grpLabelLang?.value,
					langPreference
				);
				if (groupState) {
					groupLabelStates.set(row.grp.value, groupState);
				}
				const groupLabel =
					groupLabelStates.get(row.grp.value)?.value ||
					this.iriLocalName(row.grp.value);
				const groups = person.groups ?? [];
				if (!groups.some((g) => g.iri === row.grp!.value)) {
					groups.push({ iri: row.grp.value, label: groupLabel });
				}
				person.groups = groups;
			}

			const predicateState = this.pickLabel(
				predicateLabelStates.get(row.pred.value),
				row.predLabel?.value,
				row.predLabelLang?.value,
				langPreference
			);
			if (predicateState)
				predicateLabelStates.set(row.pred.value, predicateState);
			const predicateLabel =
				predicateLabelStates.get(row.pred.value)?.value ||
				this.iriLocalName(row.pred.value);

			const isLiteral = row.val.type !== "uri";
			let valueLabel = row.valLabel?.value?.trim();
			if (!isLiteral) {
				const valueState = this.pickLabel(
					valueLabelStates.get(row.val.value),
					row.valLabel?.value,
					row.valLabelLang?.value,
					langPreference
				);
				if (valueState) valueLabelStates.set(row.val.value, valueState);
				valueLabel =
					valueLabelStates.get(row.val.value)?.value ||
					this.iriLocalName(row.val.value);
			}

			person.properties.push({
				predicate: row.pred.value,
				predicateLabel,
				value: row.val.value,
				valueLabel,
				isLiteral,
			});
		});

		for (const person of personMap.values()) {
			person.label =
				personLabelStates.get(person.id)?.value ||
				person.label ||
				this.iriLocalName(person.id);
			person.properties = person.properties.map((prop) =>
				this.finalizeProperty(prop)
			);
		}

		return Array.from(personMap.values());
	}

	async getPerson(
		personIri: string,
		preferredLang?: string
	): Promise<IndividualNode | null> {
		const langPreference = this.sanitizeLang(preferredLang);
		const data = await this.runSelect(`
            PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX core:  <${this.CORE}>

            SELECT ?uLabel ?uLabelLang ?pred ?predLabel ?predLabelLang ?val ?valLabel ?valLabelLang ?grp ?grpLabel ?grpLabelLang WHERE {
              BIND(<${personIri}> AS ?u)
              ?u rdf:type core:User .

              OPTIONAL { ?u rdfs:label ?uLabel . BIND(LANG(?uLabel) AS ?uLabelLang) }

              OPTIONAL {
                { ?grp core:hasMember ?u }
                UNION { GRAPH ?ng { ?grp core:hasMember ?u } }
                OPTIONAL { ?grp rdfs:label ?grpLabel . BIND(LANG(?grpLabel) AS ?grpLabelLang) }
              }

              OPTIONAL {
                ?u ?pred ?val .
                FILTER(?pred != rdf:type)
                OPTIONAL { ?pred rdfs:label ?predLabel . BIND(LANG(?predLabel) AS ?predLabelLang) }
                OPTIONAL { ?val  rdfs:label ?valLabel . BIND(LANG(?valLabel) AS ?valLabelLang) }
              }
            }
        `);

		type Row = {
			uLabel?: { value: string };
			uLabelLang?: { value: string };
			pred?: { value: string };
			predLabel?: { value: string };
			predLabelLang?: { value: string };
			val?: { value: string; type: string };
			valLabel?: { value: string };
			valLabelLang?: { value: string };
			grp?: { value: string };
			grpLabel?: { value: string };
			grpLabelLang?: { value: string };
		};

		const rows = data.results.bindings as Row[];
		if (rows.length === 0) {
			return null;
		}

		const USER_CLASS_IRI = `${this.CORE}User`;
		const person: IndividualNode = {
			id: personIri,
			label: this.iriLocalName(personIri),
			classId: USER_CLASS_IRI,
			properties: [],
			children: [],
		};

		let personLabelState: LabelState | undefined;
		const predicateLabelStates = new Map<string, LabelState>();
		const valueLabelStates = new Map<string, LabelState>();
		const groupLabelStates = new Map<string, LabelState>();

		rows.forEach((row) => {
			personLabelState =
				this.pickLabel(
					personLabelState,
					row.uLabel?.value,
					row.uLabelLang?.value,
					langPreference
				) ?? personLabelState;

			if (row.grp?.value) {
				const groupState = this.pickLabel(
					groupLabelStates.get(row.grp.value),
					row.grpLabel?.value,
					row.grpLabelLang?.value,
					langPreference
				);
				if (groupState) {
					groupLabelStates.set(row.grp.value, groupState);
				}
				const groupLabel =
					groupLabelStates.get(row.grp.value)?.value ||
					this.iriLocalName(row.grp.value);
				person.groups ??= [];
				if (!person.groups.some((g) => g.iri === row.grp!.value)) {
					person.groups.push({ iri: row.grp.value, label: groupLabel });
				}
			}

			if (row.pred && row.val) {
				const predicateState = this.pickLabel(
					predicateLabelStates.get(row.pred.value),
					row.predLabel?.value,
					row.predLabelLang?.value,
					langPreference
				);
				if (predicateState)
					predicateLabelStates.set(row.pred.value, predicateState);
				const predicateLabel =
					predicateLabelStates.get(row.pred.value)?.value ||
					this.iriLocalName(row.pred.value);

				const isLiteral = row.val.type !== "uri";
				let valueLabel = row.valLabel?.value?.trim();
				if (!isLiteral) {
					const valueState = this.pickLabel(
						valueLabelStates.get(row.val.value),
						row.valLabel?.value,
						row.valLabelLang?.value,
						langPreference
					);
					if (valueState) valueLabelStates.set(row.val.value, valueState);
					valueLabel =
						valueLabelStates.get(row.val.value)?.value ||
						this.iriLocalName(row.val.value);
				}

				person.properties.push({
					predicate: row.pred.value,
					predicateLabel,
					value: row.val.value,
					valueLabel,
					isLiteral,
				});
			}
		});

		if (person.properties.length > 1) {
			const uniq = new Map<string, Property>();
			for (const prop of person.properties) {
				const key = `${prop.predicate}||${prop.isLiteral ? "L" : "R"}||${prop.value}`;
				const previous = uniq.get(key);
				if (!previous) {
					uniq.set(key, prop);
				} else {
					const merged: Property = {
						predicate: prop.predicate,
						predicateLabel: prop.predicateLabel || previous.predicateLabel,
						value: prop.value,
						valueLabel: prop.valueLabel || previous.valueLabel,
						isLiteral: prop.isLiteral,
					};
					uniq.set(key, merged);
				}
			}
			person.properties = Array.from(uniq.values());
		}

		person.properties = person.properties.map((prop) =>
			this.finalizeProperty(prop)
		);
		person.label =
			personLabelState?.value || person.label || this.iriLocalName(personIri);
		return person;
	}
}

interface LabelState {
	value: string;
	lang?: string;
	score: number;
}

interface LiteralBucket {
	predicateLabel?: string;
	state?: LabelState;
}
interface PdfInfo {
	url: string;
	originalName: string;
}
