import axios from "axios";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { Express } from "express";

import { OntologyBaseService } from "../common/base-ontology.service";
import { FullSnapshot, NodeData, EdgeData } from "../common/types";
import { escapeSparqlLiteral } from "../../utils/sparql.utils";
import { IndividualsService } from "../individuals/individuals.service";

@Injectable()
export class OntologiesService extends OntologyBaseService {
    constructor(
        httpService: HttpService,
        private readonly individualsService: IndividualsService
    ) {
        super(httpService);
    }

    async getProjects(): Promise<{ iri: string; label?: string }[]> {
        const data = await this.runSelect(`
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX core: <${this.CORE}>
            SELECT ?proj ?lbl WHERE {
                GRAPH <${this.PROJECTS_GRAPH}> {
                    ?proj a core:OntologyProject .
                    OPTIONAL { ?proj rdfs:label ?lbl }
                }
            }
            ORDER BY ?lbl
        `);

        type Row = { proj: { value: string }; lbl?: { value: string } };
        return (data.results.bindings as Row[]).map((row) => ({
            iri: row.proj.value,
            label: row.lbl?.value,
        }));
    }

    async createProject(
        requesterIri: string,
        {
            iri,
            label,
            visibleToGroups = [],
        }: { iri: string; label: string; visibleToGroups?: string | string[] },
        file?: Express.Multer.File
    ): Promise<void> {
        const groups = Array.isArray(visibleToGroups)
            ? visibleToGroups
            : visibleToGroups
                ? [visibleToGroups]
                : [];

        const metaTriples = `
          PREFIX core: <${this.CORE}>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          PREFIX owl:  <http://www.w3.org/2002/07/owl#>

          INSERT DATA {
            GRAPH <${this.PROJECTS_GRAPH}> {
              <${iri}> a core:OntologyProject , owl:Ontology ;
                       rdfs:label """${escapeSparqlLiteral(label)}""" ;
                       core:createdBy <${requesterIri}> .
              ${groups.map((g) => `<${iri}> core:visibleTo <${g}> .`).join("\n      ")}
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
        visibleToGroups?: string[]
    ): Promise<void> {
        const allowed = (await this.isSuperAdmin(requesterIri)) || (await this.isProjectOwner(requesterIri, projectIri));
        if (!allowed) {
            throw new ForbiddenException("Accès refusé. Vous n'avez pas les droits d'écriture sur cette ontologie.");
        }

        let deletePart = "";
        let insertPart = "";

        if (newLabel !== undefined) {
            deletePart += `<${projectIri}> rdfs:label ?lbl .\n`;
            insertPart += `<${projectIri}> rdfs:label """${escapeSparqlLiteral(newLabel)}""" .\n`;
        }
        if (Array.isArray(visibleToGroups)) {
            deletePart += `<${projectIri}> core:visibleTo ?vg .\n`;
            insertPart += visibleToGroups
                .map((g) => `<${projectIri}> core:visibleTo <${g}> .\n`)
                .join("");
        }

        if (!deletePart) return;

        const update = `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX core: <${this.CORE}>
            DELETE { GRAPH <${this.PROJECTS_GRAPH}> { ${deletePart} } }
            INSERT { GRAPH <${this.PROJECTS_GRAPH}> { ${insertPart} } }
            WHERE  { OPTIONAL { GRAPH <${this.PROJECTS_GRAPH}> { ${deletePart} } } }
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

    async getGraph(ontologyIri: string): Promise<{ nodes: NodeData[]; edges: EdgeData[] }> {
        const params = new URLSearchParams({
            query: `
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX owl:  <http://www.w3.org/2002/07/owl#>
                SELECT ?s ?sLabel ?o ?oLabel WHERE {
                  GRAPH <${ontologyIri}> {
                    ?s rdfs:subClassOf ?o .
                    FILTER(isIRI(?s) && isIRI(?o))
                    OPTIONAL { ?s rdfs:label ?sLabel }
                    OPTIONAL { ?o rdfs:label ?oLabel }
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
            const sLbl = row.sLabel?.value || s.split(/[#/]/).pop() || s;
            const oLbl = row.oLabel?.value || o.split(/[#/]/).pop() || o;
            nodesMap.set(s, { id: s, label: sLbl, title: s });
            nodesMap.set(o, { id: o, label: oLbl, title: o });
            edges.push({ from: s, to: o });
        });

        return { nodes: Array.from(nodesMap.values()), edges };
    }

    async getClassProperties(
        classIri: string,
        _userIri: string,
        ontologyIri: string
    ): Promise<{
        dataProps: { iri: string; label: string }[];
        objectProps: { iri: string; label: string; range?: { iri: string; label: string } }[];
    }> {
        const data = await this.runSelect(`
            PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX owl:  <http://www.w3.org/2002/07/owl#>
            SELECT ?p ?pLabel ?kind ?range ?rangeLabel WHERE {
              GRAPH <${ontologyIri}> {
                {
                  ?p rdf:type owl:DatatypeProperty .
                  BIND("data" AS ?kind)
                } UNION {
                  ?p rdf:type owl:ObjectProperty .
                  BIND("object" AS ?kind)
                  OPTIONAL { ?p rdfs:range ?range . OPTIONAL { ?range rdfs:label ?rangeLabel } }
                }
                ?p rdfs:domain ?d .
                <${classIri}> rdfs:subClassOf* ?d .
                OPTIONAL { ?p rdfs:label ?pLabel }
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
            const base = {
                iri: row.p.value,
                label: row.pLabel?.value || row.p.value.split(/[#/]/).pop(),
            };
            if (row.kind.value === "data") {
                dataProps.push(base);
            } else {
                objectProps.push({
                    ...base,
                    range: row.range
                        ? {
                            iri: row.range.value,
                            label: row.rangeLabel?.value || row.range.value.split(/[#/]/).pop(),
                        }
                        : undefined,
                });
            }
        });

        return { dataProps, objectProps };
    }

    async getFullSnapshot(userIri: string, ontologyIri: string): Promise<FullSnapshot> {
        const [graph, individuals, persons] = await Promise.all([
            this.getGraph(ontologyIri),
            this.individualsService.getIndividualsForOntology(userIri, ontologyIri),
            this.individualsService.getAllPersons(),
        ]);
        return { graph, individuals, persons };
    }
}
