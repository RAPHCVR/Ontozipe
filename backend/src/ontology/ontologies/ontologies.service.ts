import axios from "axios";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { Express } from "express";

import { OntologyBaseService } from "../common/base-ontology.service";
import { FullSnapshot, NodeData, EdgeData } from "../common/types";
import { rdfLiteral } from "../common/rdf.utils";
import { LocalizedLabelDto } from "./dto/localized-label.dto";
import { IndividualsService } from "../individuals/individuals.service";

@Injectable()
export class OntologiesService extends OntologyBaseService {
    constructor(
        httpService: HttpService,
        private readonly individualsService: IndividualsService
    ) {
        super(httpService);
    }

    async getProjects(
        lang?: string,
        acceptLanguage?: string
    ): Promise<Array<{ iri: string; label?: string; labelLang?: string; languages: string[] }>> {
        const preferredLang = this.resolveLang(lang, acceptLanguage);
        const labelPattern = this.buildLabelSelection("?proj", "label", preferredLang);
        const data = await this.runSelect(`
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX core: <${this.CORE}>
            SELECT ?proj ?label ?labelLang (GROUP_CONCAT(DISTINCT ?langsRaw; separator="|") AS ?langs)
            WHERE {
                GRAPH <${this.PROJECTS_GRAPH}> {
                    ?proj a core:OntologyProject .
                    ${labelPattern}
                    OPTIONAL {
                        ?proj rdfs:label ?anyLabel .
                        BIND(LANG(?anyLabel) AS ?langsTag)
                        BIND(COALESCE(?langsTag, "") AS ?langsRaw)
                    }
                }
            }
            GROUP BY ?proj ?label ?labelLang
            ORDER BY COALESCE(LCASE(STR(?label)), STR(?proj))
        `);

        type Row = {
            proj: { value: string };
            label?: { value: string };
            labelLang?: { value: string };
            langs?: { value: string };
        };

        return (data.results.bindings as Row[]).map((row) => {
            const iri = row.proj.value;
            const label = row.label?.value?.trim() || iri.split(/[#/]/).pop() || iri;
            const rawLang = row.labelLang?.value?.trim();
            const labelLang = rawLang ? rawLang.toLowerCase() : undefined;
            const languages = row.langs?.value
                ? Array.from(new Set(row.langs.value.split("|").map((l) => l.trim()).filter(Boolean))).map((l) => l.toLowerCase())
                : labelLang
                    ? [labelLang]
                    : [];
            return { iri, label, labelLang, languages };
        });
    }

    async createProject(
        requesterIri: string,
        {
            iri,
            label,
            labels,
            visibleToGroups = [],
        }: { iri: string; label?: string; labels?: LocalizedLabelDto[]; visibleToGroups?: string | string[] },
        file?: Express.Multer.File
    ): Promise<void> {
        const groups = Array.isArray(visibleToGroups)
            ? visibleToGroups
            : visibleToGroups
                ? [visibleToGroups]
                : [];

        const normalizedLabels = this.normalizeLabels(labels, label ?? this.iriLocalName(iri));
        const additionalTriples = [
            ...normalizedLabels.map(({ value, lang }) => `<${iri}> rdfs:label ${rdfLiteral(value, lang)} .`),
            ...groups.map((g) => `<${iri}> core:visibleTo <${g}> .`),
        ];
        const additionalBlock = additionalTriples.length
            ? `
              ${additionalTriples.join('\n              ')}`
            : "";

        const metaTriples = `
          PREFIX core: <${this.CORE}>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          PREFIX owl:  <http://www.w3.org/2002/07/owl#>

          INSERT DATA {
            GRAPH <${this.PROJECTS_GRAPH}> {
              <${iri}> a core:OntologyProject , owl:Ontology ;
                       core:createdBy <${requesterIri}> .${additionalBlock}
            }
          }`;

        await this.runUpdate(metaTriples);

        if (file) {
            await axios.post(
                `${this.fusekiBase.replace(/\/?$/, "/data")}?graph=${encodeURIComponent(iri)}`,
                file.buffer,
                {
                    auth: this.adminAuth,
                    headers: { "Content-Type": file.mimetype || "application/rdf+xml" },
                    maxBodyLength: Infinity,
                }
            );
        }
    }

    async updateProject(
        requesterIri: string,
        projectIri: string,
        newLabel?: string,
        visibleToGroups?: string[],
        labels?: LocalizedLabelDto[]
    ): Promise<void> {
        const allowed = (await this.isSuperAdmin(requesterIri)) || (await this.isProjectOwner(requesterIri, projectIri));
        if (!allowed) {
            throw new ForbiddenException("Accès refusé. Vous n'avez pas les droits d'écriture sur cette ontologie.");
        }

        const operations: string[] = [];

        if (labels !== undefined || newLabel !== undefined) {
            const normalizedLabels = this.normalizeLabels(labels, newLabel ?? this.iriLocalName(projectIri));
            const labelInsertTriples = normalizedLabels
                .map(({ value, lang }) => `<${projectIri}> rdfs:label ${rdfLiteral(value, lang)} .`)
                .join('\n              ');
            operations.push(`
            DELETE { GRAPH <${this.PROJECTS_GRAPH}> { <${projectIri}> rdfs:label ?lbl . } }
            INSERT { GRAPH <${this.PROJECTS_GRAPH}> {
              ${labelInsertTriples}
            } }
            WHERE  { OPTIONAL { GRAPH <${this.PROJECTS_GRAPH}> { <${projectIri}> rdfs:label ?lbl . } } }
            `);
        }

        if (Array.isArray(visibleToGroups)) {
            const aclInsert = visibleToGroups
                .map((g) => `<${projectIri}> core:visibleTo <${g}> .`)
                .join('\n              ');
            operations.push(`
            DELETE { GRAPH <${this.PROJECTS_GRAPH}> { <${projectIri}> core:visibleTo ?vg . } }
            INSERT { GRAPH <${this.PROJECTS_GRAPH}> {
              ${aclInsert}
            } }
            WHERE  { OPTIONAL { GRAPH <${this.PROJECTS_GRAPH}> { <${projectIri}> core:visibleTo ?vg . } } }
            `);
        }

        if (operations.length === 0) return;

        const update = `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX core: <${this.CORE}>
            ${operations.map((op) => op.trim()).join(';\n')}
        `;

        await this.runUpdate(update);
    }

    async deleteProject(requesterIri: string, projectIri: string): Promise<void> {
        const allowed = (await this.isSuperAdmin(requesterIri)) || (await this.isProjectOwner(requesterIri, projectIri));
        if (!allowed) {
            throw new ForbiddenException("Accès refusé. Vous n'avez pas les droits d'écriture sur cette ontologie.");
        }

        await this.runUpdate(`DELETE WHERE { GRAPH <${this.PROJECTS_GRAPH}> { <${projectIri}> ?p ?o . } }`);
        await this.runUpdate(`DELETE WHERE { GRAPH <${projectIri}> { ?s ?p ?o . } }`);
    }

    async getGraph(ontologyIri: string, preferredLang?: string): Promise<{ nodes: NodeData[]; edges: EdgeData[] }> {
        const sLabelPattern = this.buildLabelSelection("?s", "sLabel", preferredLang);
        const oLabelPattern = this.buildLabelSelection("?o", "oLabel", preferredLang);
        const params = new URLSearchParams({
            query: `
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX owl:  <http://www.w3.org/2002/07/owl#>
                SELECT ?s ?sLabel ?o ?oLabel WHERE {
                  GRAPH <${ontologyIri}> {
                    ?s rdfs:subClassOf ?o .
                    FILTER(isIRI(?s) && isIRI(?o))
                    ${sLabelPattern}
                    ${oLabelPattern}
                  }
                }`,
            format: "application/sparql-results+json",
        });

        const response = await lastValueFrom(this.httpService.get(this.fusekiUrl, { params }));
        const bindings = response.data.results.bindings as Array<{
            s: { value: string };
            o: { value: string };
            sLabel?: { value: string };
            oLabel?: { value: string };
        }>;

        const nodesMap = new Map<string, NodeData>();
        const edges: EdgeData[] = [];

        bindings.forEach((row) => {
            const s = row.s.value;
            const o = row.o.value;
            const sLbl = row.sLabel?.value?.trim() || this.iriLocalName(s);
            const oLbl = row.oLabel?.value?.trim() || this.iriLocalName(o);
            nodesMap.set(s, { id: s, label: sLbl, title: s });
            nodesMap.set(o, { id: o, label: oLbl, title: o });
            edges.push({ from: s, to: o });
        });

        return { nodes: Array.from(nodesMap.values()), edges };
    }

    async getClassProperties(
        classIri: string,
        _userIri: string,
        ontologyIri: string,
        lang?: string,
        acceptLanguage?: string
    ): Promise<{
        dataProps: { iri: string; label: string }[];
        objectProps: { iri: string; label: string; range?: { iri: string; label: string } }[];
    }> {
        const preferredLang = this.resolveLang(lang, acceptLanguage);
        const propLabelPattern = this.buildLabelSelection("?p", "pLabel", preferredLang);
        const rangeLabelPattern = this.buildLabelSelection("?range", "rangeLabel", preferredLang);
        const data = await this.runSelect(`
            PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX owl:  <http://www.w3.org/2002/07/owl#>
            SELECT ?p ?pLabel ?kind ?range ?rangeLabel WHERE {
              GRAPH <${ontologyIri}> {
                {
                  ?p rdf:type owl:DatatypeProperty .
                  BIND("data" AS ?kind)
                }
                UNION
                {
                  ?p rdf:type owl:ObjectProperty .
                  BIND("object" AS ?kind)
                  OPTIONAL {
                    ?p rdfs:range ?range .
                    ${rangeLabelPattern}
                  }
                }
                ?p rdfs:domain ?d .
                <${classIri}> rdfs:subClassOf* ?d .
                ${propLabelPattern}
              }
            }
        `);

        const dataProps: { iri: string; label: string }[] = [];
        const objectProps: {
            iri: string;
            label: string;
            range?: { iri: string; label: string };
        }[] = [];

        data.results.bindings.forEach((row: any) => {
            const predicateIri = row.p.value;
            const base = {
                iri: predicateIri,
                label: row.pLabel?.value?.trim() || this.iriLocalName(predicateIri),
            };
            if (row.kind.value === "data") {
                dataProps.push(base);
            } else {
                const rangeIri = row.range?.value;
                objectProps.push({
                    ...base,
                    range: rangeIri
                        ? {
                              iri: rangeIri,
                              label: row.rangeLabel?.value?.trim() || this.iriLocalName(rangeIri),
                          }
                        : undefined,
                });
            }
        });

        return { dataProps, objectProps };
    }

    private iriLocalName(iri: string): string {
        const parts = iri.split(/[#/]/);
        return parts[parts.length - 1] || iri;
    }

    private normalizeLabels(
        labels?: Array<{ value?: string; lang?: string }>,
        fallback?: string
    ): Array<{ value: string; lang?: string }> {
        const normalized = new Map<string, string>();
        if (labels) {
            for (const entry of labels) {
                if (!entry?.value) continue;
                const value = entry.value.trim();
                if (!value) continue;
                const lang = this.sanitizeLang(entry.lang);
                const key = lang ?? "";
                if (!normalized.has(key)) {
                    normalized.set(key, value);
                }
            }
        }
        const fallbackValue = fallback?.trim();
        if (normalized.size === 0 && fallbackValue) {
            normalized.set("", fallbackValue);
        }
        return Array.from(normalized.entries()).map(([lang, value]) => ({
            value,
            lang: lang || undefined,
        }));
    }

    async getFullSnapshot(
        userIri: string,
        ontologyIri: string,
        lang?: string,
        acceptLanguage?: string
    ): Promise<FullSnapshot> {
        const preferredLang = this.resolveLang(lang, acceptLanguage);
        const [graph, individuals, persons] = await Promise.all([
            this.getGraph(ontologyIri, preferredLang),
            this.individualsService.getIndividualsForOntology(userIri, ontologyIri, preferredLang),
            this.individualsService.getAllPersons(preferredLang),
        ]);
        return { graph, individuals, persons };
    }
}
