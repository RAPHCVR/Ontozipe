import { Injectable, BadRequestException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { ChatOllama } from "@langchain/ollama";
import { Runnable } from "@langchain/core/runnables";
import { tool, StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { escapeSparqlLiteral } from "../utils/sparql.utils";

@Injectable()
export class LlmService {
    constructor(private readonly http: HttpService) {}

    private readonly CORE = "http://example.org/core#";
    private readonly FUSEKI_SPARQL = `${(process.env.FUSEKI_URL ?? "http://fuseki:3030/autonomy").replace(/\/$/,"")}/sparql`;

    private buildModel(): ChatOllama {
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11343";
        const model = process.env.OLLAMA_MODEL || "llama3";
        const headers =
            process.env.UTC_API_KEY && process.env.UTC_API_KEY.trim().length > 0
                ? { Authorization: `Bearer ${process.env.UTC_API_KEY}` }
                : undefined;
        return new ChatOllama({ baseUrl, model, temperature: 0.2, maxRetries: 2, headers });
    }

    private async getUserGroups(userIri: string): Promise<string[]> {
        const sparql = `
            PREFIX core: <${this.CORE}>
            SELECT DISTINCT ?g WHERE {
                { ?g core:hasMember <${userIri}> } UNION
                { ?ms core:member <${userIri}> ; core:group ?g } UNION
                { GRAPH ?ng { ?g core:hasMember <${userIri}> } } UNION
                { GRAPH ?ng { ?ms core:member <${userIri}> ; core:group ?g } }
            }`;
        type SparqlBinding = {
            g: { value: string };
        };
        const params = new URLSearchParams({ query: sparql, format: "application/sparql-results+json" });
        const res = await lastValueFrom(this.http.get(this.FUSEKI_SPARQL, { params }));
        return (res.data.results.bindings as SparqlBinding[]).map((b) => b.g.value);
    }

    private async searchEntities(
        term: string, ontologyIri: string, userIri: string, limit = 10
    ): Promise<{ id: string; label?: string }[]> {
        if (!ontologyIri) throw new BadRequestException("ontologyIri manquant");
        const groups = await this.getUserGroups(userIri);
        const groupsList = groups.map((g) => `<${g}>`).join(", ");
        const aclFilter =
            groups.length > 0
                ? `(!BOUND(?vg) || ?vg IN (${groupsList}) || EXISTS { ?s <${this.CORE}createdBy> <${userIri}> })`
                : `(!BOUND(?vg) || EXISTS { ?s <${this.CORE}createdBy> <${userIri}> })`;
        const sparql = `
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          PREFIX core: <${this.CORE}>
          SELECT DISTINCT ?s ?lbl WHERE {
            GRAPH <${ontologyIri}> {
              ?s ?p ?o . FILTER(isIRI(?s))
              OPTIONAL { ?s rdfs:label ?lbl }
              OPTIONAL { ?s core:visibleTo ?vg }
              FILTER(
                CONTAINS(LCASE(STR(COALESCE(?lbl, ""))), LCASE("${escapeSparqlLiteral(term)}")) ||
                EXISTS { ?s ?p2 ?lit . FILTER(isLiteral(?lit) && CONTAINS(LCASE(STR(?lit)), LCASE("${escapeSparqlLiteral(term)}"))) }
              )
              FILTER( ${aclFilter} )
            }
          } ORDER BY LCASE(STR(?lbl)) LIMIT ${Math.max(1, Math.min(50, limit))}`;
        const params = new URLSearchParams({ query: sparql, format: "application/sparql-results+json" });
        const res = await lastValueFrom(this.http.get(this.FUSEKI_SPARQL, { params }));
        type Row = { s: { value: string }; lbl?: { value: string } };
        return (res.data.results.bindings as Row[]).map((r) => ({ id: r.s.value, label: r.lbl?.value }));
    }

    private async getEntityDetails(iri: string, ontologyIri: string): Promise<{
        id: string; label?: string; types: string[]; properties: { predicate: string; value: string; isLiteral: boolean }[];
    } | null> {
        if (!ontologyIri) throw new BadRequestException("ontologyIri manquant");
        const sparql = `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?lbl ?p ?v WHERE {
                GRAPH <${ontologyIri}> {
                    OPTIONAL { <${iri}> rdfs:label ?lbl }
                    { <${iri}> rdf:type ?v . BIND(rdf:type AS ?p) }
                    UNION
                    { <${iri}> ?p ?v . FILTER(?p != rdfs:label) }
                }
            }`;
        const params = new URLSearchParams({ query: sparql, format: "application/sparql-results+json" });
        const res = await lastValueFrom(this.http.get(this.FUSEKI_SPARQL, { params }));
        type Row = { lbl?: { value: string }; p: { value: string }; v: { value: string; type: string }; };
        const rows = res.data.results.bindings as Row[];

        if (rows.length === 0) return null;

        const label = rows.find((r) => r.lbl)?.lbl?.value;
        const types = Array.from(new Set(rows.filter((r) => r.p.value.endsWith("type")).map((r) => r.v.value)));
        const properties = rows
            .filter((r) => !r.p.value.endsWith("type"))
            .map((r) => ({ predicate: r.p.value, value: r.v.value, isLiteral: r.v.type !== "uri" }));
        return { id: iri, label: label || iri.split(/[#/]/).pop(), types, properties };
    }

    private buildTools(userIri: string, ontologyIri?: string): StructuredTool[] {
        const searchTool = tool(
            async ({ query, ontologyIri: onto, limit }: { query: string; ontologyIri?: string; limit?: number; }) => {
                const ontoEff = onto || ontologyIri || "";
                if (!ontoEff) {
                    return "Erreur : l'IRI de l'ontologie est manquant pour la recherche. Demandez à l'utilisateur de la préciser.";
                }
                const list = await this.searchEntities(query, ontoEff, userIri, limit ?? 10);
                // Le LLM comprend mieux une réponse en langage naturel si rien n'est trouvé.
                if (list.length === 0) {
                    return `Aucune entité trouvée pour la recherche "${query}" dans l'ontologie <${ontoEff}>.`;
                }
                return JSON.stringify({ hits: list, ontologyIri: ontoEff });
            }, {
                name: "search_entities",
                description: "Recherche des individus pertinents par mot-clé dans une ontologie donnée.",
                schema: z.object({
                    query: z.string().describe("Texte de recherche"),
                    ontologyIri: z.string().optional().describe("IRI du graph d'ontologie"),
                    limit: z.number().int().min(1).max(50).optional(),
                }),
            }
        );

        const getTool = tool(
            async ({ iri, ontologyIri: onto }: { iri: string; ontologyIri?: string }) => {
                const ontoEff = onto || ontologyIri || "";
                if (!ontoEff) {
                    return "Erreur : l'IRI de l'ontologie est manquant pour la récupération de détails. Demandez à l'utilisateur de la préciser.";
                }
                const data = await this.getEntityDetails(iri, ontoEff);
                if (!data) {
                    return `Aucun détail trouvé pour l'individu <${iri}> dans l'ontologie <${ontoEff}>. Il n'existe peut-être pas.`;
                }
                return JSON.stringify({ entity: data, ontologyIri: ontoEff });
            }, {
                name: "get_entity",
                description: "Récupère le détail d'un individu (types et propriétés).",
                schema: z.object({
                    iri: z.string().describe("IRI de l'individu à détailler"),
                    ontologyIri: z.string().optional(),
                }),
            }
        );
        return [searchTool, getTool];
    }

    public prepareAgentExecutor(params: { userIri: string; ontologyIri?: string }): {
        llm: ChatOllama;
        llmWithTools: Runnable;
        tools: StructuredTool[];
    } {
        const llm = this.buildModel();
        const tools = this.buildTools(params.userIri, params.ontologyIri);
        const llmWithTools = llm.bindTools(tools);
        return { llm, llmWithTools, tools };
    }
}