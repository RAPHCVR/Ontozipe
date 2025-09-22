import { Injectable, BadRequestException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";

import { OntologyBaseService } from "../common/base-ontology.service";
import { IndividualNode, Property } from "../common/types";
import { toRdfTerm, rdfLiteral } from "../common/rdf.utils";

@Injectable()
export class IndividualsService extends OntologyBaseService {
    constructor(httpService: HttpService) {
        super(httpService);
    }

    async createIndividual(
        node: IndividualNode,
        requesterIri: string,
        ontologyIri: string,
        visibleToGroups: string[] = []
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
        ontologyIri?: string
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
          ${prop.value === "" || prop.value == null
                        ? ""
                        : `INSERT { <${iri}> <${prop.predicate}> ${mkVal(prop.value, prop.isLiteral)} . }`}
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

        const statements = [perPropUpdates, aclUpdate, touchUpdate]
            .map((part) => part.trim())
            .filter(Boolean)
            .join(" ;\n");

        if (statements) {
            await this.runUpdate(statements);
        }
    }

    async deleteIndividual(iri: string, ontologyIri: string, requesterIri: string): Promise<void> {
        await this.enforceWritePermission(requesterIri, ontologyIri);
        const update = `DELETE WHERE { GRAPH <${ontologyIri}> { <${iri}> ?p ?o . } }`;
        await this.runUpdate(update);
    }

    async getIndividualsForOntology(userIri: string, ontologyIri: string): Promise<IndividualNode[]> {
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

            SELECT ?s ?sLabel ?clsEff ?createdBy ?createdAt ?updatedBy ?updatedAt ?vg
                   ?pred ?predLabel ?val ?valLabel ?vCls
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

                OPTIONAL { ?s rdfs:label ?sLabel }
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
                OPTIONAL { ?pred rdfs:label ?predLabel }
              }

              OPTIONAL {
                { ?val (rdfs:label|foaf:name|skos:prefLabel|schema:name|dct:title) ?_vLabel1 }
                UNION
                { GRAPH ?g { ?val (rdfs:label|foaf:name|skos:prefLabel|schema:name|dct:title) ?_vLabel2 } }
              }
              BIND(COALESCE(?_vLabel1, ?_vLabel2) AS ?valLabel)

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
            clsEff?: { value: string };
            createdBy?: { value: string };
            createdAt?: { value: string };
            updatedBy?: { value: string };
            updatedAt?: { value: string };
            vg?: { value: string };
            pred: { value: string };
            predLabel?: { value: string };
            val: { value: string; type: string };
            valLabel?: { value: string };
            vCls?: { value: string };
        };

        const map = new Map<string, IndividualNode>();

        (data.results.bindings as Row[]).forEach((row) => {
            const id = row.s.value;
            if (!map.has(id)) {
                map.set(id, {
                    id,
                    label: row.sLabel?.value || id.split(/[#/]/).pop() || "",
                    classId: row.clsEff?.value || "http://www.w3.org/2002/07/owl#Thing",
                    properties: [],
                    children: [],
                });
            }
            const entry = map.get(id)!;
            if (row.createdBy?.value) entry.createdBy = row.createdBy.value;
            if (row.createdAt?.value) entry.createdAt = row.createdAt.value;
            if (row.updatedBy?.value) entry.updatedBy = row.updatedBy.value;
            if (row.updatedAt?.value) entry.updatedAt = row.updatedAt.value;
            if (row.vg?.value) {
                entry.visibleTo ??= [];
                if (!entry.visibleTo.includes(row.vg.value)) entry.visibleTo.push(row.vg.value);
            }

            const isUri = row.val?.type === "uri";
            entry.properties.push({
                predicate: row.pred.value,
                predicateLabel: row.predLabel?.value,
                value: row.val.value,
                valueLabel: row.valLabel?.value,
                isLiteral: !isUri,
            });

            if (row.val?.type === "uri" && !map.has(row.val.value)) {
                map.set(row.val.value, {
                    id: row.val.value,
                    label: row.valLabel?.value || row.val.value.split(/[#/]/).pop() || row.val.value,
                    classId: row.vCls?.value || "http://www.w3.org/2002/07/owl#Thing",
                    properties: [],
                    children: [],
                });
            }
        });

        for (const node of map.values()) {
            if (!node.properties || node.properties.length <= 1) continue;

            const uniq = new Map<string, Property>();
            for (const prop of node.properties) {
                const key = `${prop.predicate}||${prop.isLiteral ? "L" : "R"}||${prop.value}`;
                const previous = uniq.get(key);
                if (!previous) {
                    uniq.set(key, prop);
                } else {
                    const better: Property = {
                        predicate: prop.predicate,
                        predicateLabel: prop.predicateLabel || previous.predicateLabel,
                        value: prop.value,
                        valueLabel: prop.valueLabel || previous.valueLabel,
                        isLiteral: prop.isLiteral,
                    };
                    uniq.set(key, better);
                }
            }
            node.properties = Array.from(uniq.values());
        }

        return Array.from(map.values());
    }

    async getAllPersons(): Promise<IndividualNode[]> {
        const data = await this.runSelect(`
            PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX core:  <${this.CORE}>

            SELECT ?u ?uLabel ?pred ?predLabel ?val ?valLabel ?grp ?grpLabel WHERE {
              ?u rdf:type core:User .
              OPTIONAL { ?u core:hasAccount ?acc }
              OPTIONAL { ?u rdfs:label ?uLabel }
              OPTIONAL {
                { ?grp core:hasMember ?u }
                UNION
                { GRAPH ?ng { ?grp core:hasMember ?u } }
                OPTIONAL { ?grp rdfs:label ?grpLabel }
              }
              ?u ?pred ?val .
              FILTER (?pred != rdf:type)
              OPTIONAL { ?pred rdfs:label ?predLabel }
              OPTIONAL { ?val  rdfs:label ?valLabel }
            }
        `);

        type Row = {
            u: { value: string };
            uLabel?: { value: string };
            pred: { value: string };
            predLabel?: { value: string };
            val: { value: string; type: string };
            valLabel?: { value: string };
            grp?: { value: string };
            grpLabel?: { value: string };
        };

        const USER_CLASS_IRI = `${this.CORE}User`;
        const personMap = new Map<string, IndividualNode>();

        (data.results.bindings as Row[]).forEach((row) => {
            const id = row.u.value;
            const label = row.uLabel?.value || id.split(/[#/]/).pop();
            if (!personMap.has(id)) {
                personMap.set(id, {
                    id,
                    label: label || "Unknown",
                    classId: USER_CLASS_IRI,
                    properties: [],
                    children: [],
                });
            }

            if (row.grp?.value) {
                const groups = personMap.get(id)!.groups ?? [];
                if (!groups.some((g) => g.iri === row.grp!.value)) {
                    groups.push({ iri: row.grp.value, label: row.grpLabel?.value });
                }
                personMap.get(id)!.groups = groups;
            }

            personMap.get(id)!.properties.push({
                predicate: row.pred.value,
                predicateLabel: row.predLabel?.value,
                value: row.val.value,
                valueLabel: row.valLabel?.value,
                isLiteral: row.val.type !== "uri",
            });
        });

        return Array.from(personMap.values());
    }

    async getPerson(personIri: string): Promise<IndividualNode | null> {
        const data = await this.runSelect(`
            PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX core:  <${this.CORE}>

            SELECT ?uLabel ?pred ?predLabel ?val ?valLabel ?grp ?grpLabel WHERE {
              BIND(<${personIri}> AS ?u)
              ?u rdf:type core:User .

              OPTIONAL { ?u rdfs:label ?uLabel }

              OPTIONAL {
                { ?grp core:hasMember ?u }
                UNION { GRAPH ?ng { ?grp core:hasMember ?u } }
                OPTIONAL { ?grp rdfs:label ?grpLabel }
              }

              OPTIONAL {
                ?u ?pred ?val .
                FILTER(?pred != rdf:type)
                OPTIONAL { ?pred rdfs:label ?predLabel }
                OPTIONAL { ?val  rdfs:label ?valLabel }
              }
            }
        `);

        type Row = {
            uLabel?: { value: string };
            pred?: { value: string };
            predLabel?: { value: string };
            val?: { value: string; type: string };
            valLabel?: { value: string };
            grp?: { value: string };
            grpLabel?: { value: string };
        };

        if ((data.results.bindings as Row[]).length === 0) {
            return null;
        }

        const USER_CLASS_IRI = `${this.CORE}User`;
        const person: IndividualNode = {
            id: personIri,
            label:
                data.results.bindings[0].uLabel?.value ||
                personIri.split(/[#/]/).pop() ||
                "Unknown",
            classId: USER_CLASS_IRI,
            properties: [],
            children: [],
        };

        (data.results.bindings as Row[]).forEach((row) => {
            if (row.grp?.value) {
                person.groups ??= [];
                if (!person.groups.some((g) => g.iri === row.grp!.value)) {
                    person.groups.push({ iri: row.grp.value, label: row.grpLabel?.value });
                }
            }

            if (row.pred && row.val) {
                const isLiteral = row.val.type !== "uri";
                person.properties.push({
                    predicate: row.pred.value,
                    predicateLabel: row.predLabel?.value,
                    value: row.val.value,
                    valueLabel: row.valLabel?.value,
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
                    const better: Property = {
                        predicate: prop.predicate,
                        predicateLabel: prop.predicateLabel || previous.predicateLabel,
                        value: prop.value,
                        valueLabel: prop.valueLabel || previous.valueLabel,
                        isLiteral: prop.isLiteral,
                    };
                    uniq.set(key, better);
                }
            }
            person.properties = Array.from(uniq.values());
        }

        return person;
    }
}
