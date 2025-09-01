import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { ChatOllama } from "@langchain/ollama";
import { Runnable } from "@langchain/core/runnables";
import { tool, StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { escapeSparqlLiteral } from "../utils/sparql.utils";
import { ChatOpenAI } from "@langchain/openai";
import { getMostConnectedNodes, searchNodesByKeywords, batchGetEntityDetails } from "./queries";

@Injectable()
export class LlmService {
    constructor(private readonly http: HttpService) {}

    private readonly CORE = "http://example.org/core#";
    private readonly FUSEKI_SPARQL = `${(process.env.FUSEKI_URL ?? "http://fuseki:3030/autonomy").replace(/\/$/,"")}/sparql`;

    /** Empêche l'exécution simultanée de requêtes avec la même clé d'idempotence. */
    private readonly inflightRequests = new Set<string>();

    private buildModel2(): ChatOllama {
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11343";
        const model = process.env.OLLAMA_MODEL || "llama3";
        const headers =
            process.env.UTC_API_KEY && process.env.UTC_API_KEY.trim().length > 0
                ? { Authorization: `Bearer ${process.env.UTC_API_KEY}` }
                : undefined;
        return new ChatOllama({
            baseUrl,
            model,
            temperature: 0.2,
            maxRetries: 2,
            headers,
        });
    }

    private buildModel(): ChatOpenAI {
        const openAIApiKey = process.env.OPENAI_API_KEY;
        if (!openAIApiKey) {
            throw new Error("OPENAI_API_KEY is not set in environment variables");
        }
        const model = process.env.OPENAI_MODEL || "gpt-5-mini";
        return new ChatOpenAI({ openAIApiKey, modelName: model });
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

        const getMostConnectedNodesTool = tool(
            async ({ ontologyIri: onto }: { ontologyIri?: string }) => {
                const ontoEff = onto || ontologyIri || "";
                if (!ontoEff) {
                    return "Erreur : l'IRI de l'ontologie est manquant pour la recherche des nœuds les plus connectés. Demandez à l'utilisateur de la préciser.";
                }
                try {
                    const nodes = await getMostConnectedNodes(this.http, this.FUSEKI_SPARQL, ontoEff);
                    if (nodes.length === 0) {
                        return `Aucun nœud trouvé dans l'ontologie <${ontoEff}>.`;
                    }
                    return JSON.stringify({ 
                        nodes: nodes.map(n => ({ uri: n.uri, connectionCount: n.connectionCount })),
                        totalFound: nodes.length,
                        ontologyIri: ontoEff
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
                    return `Erreur lors de la récupération des nœuds les plus connectés: ${errorMessage}`;
                }
            }, {
                name: "get_most_connected_nodes",
                description: "Récupère les 10 nœuds ayant le plus de connexions (prédicats entrants et sortants) dans une ontologie donnée.",
                schema: z.object({
                    ontologyIri: z.string().optional().describe("IRI du graph d'ontologie"),
                }),
            }
        );

        const searchNodesByKeywordsTool = tool(
            async ({ keywords, ontologyIri: onto }: { keywords: string[], ontologyIri: string }) => {
                if (!onto) {
                    return "Erreur : l'IRI de l'ontologie est obligatoire pour la recherche par mots-clés.";
                }
                if (!keywords || keywords.length === 0) {
                    return "Erreur : au moins un mot-clé est requis pour la recherche.";
                }
                try {
                    const results = await searchNodesByKeywords(this.http, this.FUSEKI_SPARQL, onto, keywords);
                    if (results.length === 0) {
                        return `Aucun nœud trouvé correspondant aux mots-clés [${keywords.join(', ')}] dans l'ontologie <${onto}>.`;
                    }
                    return JSON.stringify({
                        results: results.map(r => ({ uri: r.uri, matchedKeywords: r.matchedKeywords })),
                        totalFound: results.length,
                        searchKeywords: keywords,
                        ontologyIri: onto
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
                    return `Erreur lors de la recherche par mots-clés: ${errorMessage}`;
                }
            }, {
                name: "search_nodes_by_keywords",
                description: "Recherche dans tous les nœuds d'une ontologie en utilisant une liste de mots-clés. Cherche dans les URIs, propriétés, valeurs, labels et commentaires. Retourne les nœuds matchés triés par nombre de mots-clés trouvés.",
                schema: z.object({
                    keywords: z.array(z.string()).describe("Liste des mots-clés à rechercher"),
                    ontologyIri: z.string().describe("IRI du graph d'ontologie dans lequel effectuer la recherche"),
                }),
            }
        );

        const getBatchEntityDetailsTool = tool(
            async ({ uris, ontologyIri: onto }: { uris: string[], ontologyIri?: string }) => {
                const ontoEff = onto || ontologyIri || "";
                if (!ontoEff) {
                    return "Erreur : l'IRI de l'ontologie est obligatoire pour récupérer les détails des entités.";
                }
                if (!uris || uris.length === 0) {
                    return "Erreur : au moins une URI est requise pour récupérer les détails.";
                }
                try {
                    const entitiesMap = await batchGetEntityDetails(this.http, this.FUSEKI_SPARQL, ontoEff, uris);
                    
                    // Convertir la Map en objet pour la sérialisation JSON
                    const entities = Array.from(entitiesMap.entries()).map(([uri, details]) => ({
                        uri,
                        ...details
                    }));
                    
                    if (entities.length === 0) {
                        return `Aucun détail trouvé pour les URIs [${uris.join(', ')}] dans l'ontologie <${ontoEff}>.`;
                    }
                    
                    return JSON.stringify({
                        entities,
                        totalRequested: uris.length,
                        totalFound: entities.length,
                        ontologyIri: ontoEff
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
                    return `Erreur lors de la récupération des détails des entités: ${errorMessage}`;
                }
            }, {
                name: "get_batch_entity_details",
                description: "Récupère les détails (types, propriétés, labels) de plusieurs entités en une seule requête. Plus efficace que d'appeler get_entity individuellement pour chaque entité.",
                schema: z.object({
                    uris: z.array(z.string()).describe("Liste des URIs des entités dont on veut récupérer les détails"),
                    ontologyIri: z.string().optional().describe("IRI du graph d'ontologie"),
                }),
            }
        );
        
        return [searchTool, getTool, getMostConnectedNodesTool, searchNodesByKeywordsTool, getBatchEntityDetailsTool];
    }

    public prepareAgentExecutor(params: { userIri: string; ontologyIri?: string }): {
        llm: ChatOpenAI;
        llmWithTools: Runnable;
        tools: StructuredTool[];
    } {
        const llm = this.buildModel();
        const tools = this.buildTools(params.userIri, params.ontologyIri);
        const llmWithTools = llm.bindTools(tools);
        return { llm, llmWithTools, tools };
    }

    /**
     * Exécute une fonction asynchrone une seule fois pour une clé donnée.
     * Lève une exception si une exécution avec la même clé est déjà en cours.
     * @param key - La clé d'idempotence unique pour cette requête.
     * @param executor - La fonction à exécuter.
     */
    public async executeOnce<T>(key: string, executor: () => Promise<T>): Promise<T> {
        if (this.inflightRequests.has(key)) {
            throw new ConflictException("Une requête identique est déjà en cours de traitement.");
        }
        this.inflightRequests.add(key);
        try {
            return await executor();
        } finally {
            // S'assure que la clé est retirée même en cas d'erreur
            this.inflightRequests.delete(key);
        }
    }
}