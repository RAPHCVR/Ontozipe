import { Injectable, BadRequestException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { ChatOllama } from "@langchain/ollama";
import { Runnable } from "@langchain/core/runnables";
import { tool, StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { escapeSparqlLiteral } from "../utils/sparql.utils";
import { ChatOpenAI } from "@langchain/openai";
import { getMostConnectedNodes, searchNodesByKeywords, buildNodeFromUri } from "./queries";
import { ResultRepresentation, Node } from "./result_representation";
import { Response } from "express";

@Injectable()
export class LlmService {
    constructor(private readonly http: HttpService) {}

    private readonly CORE = "http://example.org/core#";
    private readonly FUSEKI_SPARQL = `${(process.env.FUSEKI_URL ?? "http://fuseki:3030/autonomy").replace(/\/$/,"")}/sparql`;

    /** Registre des runs SSE (idempotencyKey -> set de réponses SSE) pour permettre la reconnexion. */
    private readonly sseRuns = new Map<string, Set<Response>>();
    /**
     * Mémoire des recherches par contexte (clé: userIri + '::' + ontologyIri|default).
     * Évite tout partage entre utilisateurs/sessions.
     */
    private readonly representations = new Map<string, ResultRepresentation>();

    private makeContextKey(userIri: string, ontologyIri?: string): string {
        return `${userIri}::${ontologyIri ?? "default"}`;
    }

    private getOrCreateRepresentation(userIri: string, ontologyIri?: string): ResultRepresentation {
        const key = this.makeContextKey(userIri, ontologyIri);
        let rep = this.representations.get(key);
        if (!rep) {
            rep = new ResultRepresentation();
            this.representations.set(key, rep);
        }
        return rep;
    }

    /* ======================== */
    /*   MODELES (LLM clients)  */
    /* ======================== */
    private buildModel(): ChatOllama {
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
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

    private buildModel2(): ChatOpenAI {
        const openAIApiKey = process.env.OPENAI_API_KEY;
        if (!openAIApiKey) {
            throw new Error("OPENAI_API_KEY is not set in environment variables");
        }
        const model = process.env.OPENAI_MODEL || "gpt-5-mini";
        return new ChatOpenAI({ openAIApiKey, modelName: model });
    }

    /* ========================================== */
    /*       GESTION SSE MULTI-ABONNES PAR CLE     */
    /* ========================================== */
    /**
     * Ajoute un abonné SSE sur une clé d'idempotence. Retourne true si c'est le premier abonné
     * (donc qu'il faut démarrer l'exécution), false si on se greffe sur une exécution en cours.
     */
    public registerSseSubscriber(key: string, res: Response): { isFirst: boolean } {
        const existing = this.sseRuns.get(key);
        const isFirst = !existing;
        const set = existing ?? new Set<Response>();
        set.add(res);
        if (!existing) this.sseRuns.set(key, set);
        // Nettoyage à la fermeture de la connexion
        res.on("close", () => {
            const current = this.sseRuns.get(key);
            if (!current) return;
            current.delete(res);
            // On ne stoppe pas l'exécution si plus d'abonnés; l'agent finira et on nettoiera à la fin.
        });
        return { isFirst };
    }
    /** Diffuse un événement SSE vers tous les abonnés de la clé. */
    public sseBroadcast(key: string, event: { type: string; data: unknown }) {
        const subs = this.sseRuns.get(key);
        if (!subs || subs.size === 0) return;
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        for (const r of Array.from(subs)) {
            try {
                r.write(payload);
            } catch {
                subs.delete(r);
            }
        }
    }
    /** Termine proprement un run SSE: envoie 'done' et ferme toutes les connexions, puis nettoie. */
    public finishSseRun(key: string) {
        const subs = this.sseRuns.get(key);
        if (!subs) return;
        this.sseBroadcast(key, { type: "done", data: null });
        for (const r of Array.from(subs)) { try { r.end(); } catch {} }
        this.sseRuns.delete(key);
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

    private async getEntityDetails(uri: string, ontologyIri: string): Promise<{
        id: string; label?: string; types: string[]; properties: { predicate: string; value: string; isLiteral: boolean }[];
    } | null> {
        if (!ontologyIri) throw new BadRequestException("ontologyIri manquant");
        const sparql = `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?lbl ?p ?v WHERE {
                GRAPH <${ontologyIri}> {
                    OPTIONAL { <${uri}> rdfs:label ?lbl }
                    { <${uri}> rdf:type ?v . BIND(rdf:type AS ?p) }
                    UNION
                    { <${uri}> ?p ?v . FILTER(?p != rdfs:label) }
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
        return { id: uri, label: label || uri.split(/[#/]/).pop(), types, properties };
    }

    private buildTools(userIri: string, ontologyIri?: string): StructuredTool[] {
        const searchTool = tool(
            async ({ query, ontologyIri: onto, limit }: { query: string; ontologyIri?: string; limit?: number; }) => {
                const ontoEff = onto || ontologyIri || "";
                if (!ontoEff) {
                    return "Erreur : l'URI de l'ontologie est manquant pour la recherche. Demandez à l'utilisateur de la préciser.";
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
                    ontologyIri: z.string().optional().describe("URI du graph d'ontologie"),
                    limit: z.number().int().min(1).max(50).optional(),
                }),
            }
        );

        const getTool = tool(
            async ({ uri, ontologyIri: onto }: { uri: string; ontologyIri?: string }) => {
                const ontoEff = onto || ontologyIri || "";
                if (!ontoEff) {
                    return "Erreur : l'URI de l'ontologie est manquant pour la récupération de détails. Demandez à l'utilisateur de la préciser.";
                }
                const data = await this.getEntityDetails(uri, ontoEff);
                if (!data) {
                    return `Aucun détail trouvé pour l'individu <${uri}> dans l'ontologie <${ontoEff}>. Il n'existe peut-être pas.`;
                }
                return JSON.stringify({ entity: data, ontologyIri: ontoEff });
            }, {
                name: "get_entity",
                description: "Récupère le détail d'un individu (types et propriétés).",
                schema: z.object({
                    uri: z.string().describe("URI de l'individu à détailler"),
                    ontologyIri: z.string().optional(),
                }),
            }
        );

        const getMostConnectedNodesTool = tool(
            async ({ ontologyIri: onto }: { ontologyIri?: string }) => {
                const ontoEff = onto || ontologyIri || "";
                if (!ontoEff) {
                    return "Erreur : l'URI de l'ontologie est manquant pour la recherche des noeuds les plus connectés. Demandez à l'utilisateur de la préciser.";
                }
                try {
                    const nodes = await getMostConnectedNodes(this.http, this.FUSEKI_SPARQL, ontoEff);
                    if (nodes.length === 0) {
                        return `Aucun noeud trouvé dans l'ontologie <${ontoEff}>.`;
                    }
                    return JSON.stringify({
                        nodes: nodes.map(n => ({ uri: n.uri, connectionCount: n.connectionCount })),
                        totalFound: nodes.length,
                        ontologyIri: ontoEff
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
                    return `Erreur lors de la récupération des noeuds les plus connectés: ${errorMessage}`;
                }
            }, {
                name: "get_most_connected_nodes",
                description: "Récupère les 10 noeuds ayant le plus de connexions (prédicats entrants et sortants) dans une ontologie donnée.",
                schema: z.object({
                    ontologyIri: z.string().optional().describe("URI du graph d'ontologie"),
                }),
            }
        );

        const searchFromNaturalLanguageTool = tool(
            async ({ keywords, ontologyIri: onto }: { keywords: string[], ontologyIri: string }) => {
                if (!onto) {
                    return "Erreur : l'URI de l'ontologie est obligatoire pour la recherche par mots-clés.";
                }
                if (!keywords || keywords.length === 0) {
                    return "Erreur : au moins un mot-clé est requis pour la recherche.";
                }
                try {
                    // 1. Prendre les 6 premiers résultats
                    const results = await searchNodesByKeywords(this.http, this.FUSEKI_SPARQL, onto, keywords);
                    const first6Results = results.slice(0, 6);

                    if (first6Results.length === 0) {
                        return `Aucun noeud trouvé correspondant aux mots-clés [${keywords.join(', ')}] dans l'ontologie <${onto}>.`;
                    }

                    // 2. Transmettre ces résultats à buildNodeFromUri un par un (avec système de déduplication)
                    const uncoveredUri = new Set<string>();
                    const nodes: Node[] = [];

                    for (const result of first6Results) {
                        try {
                            const node = await buildNodeFromUri(this.http, this.FUSEKI_SPARQL, onto, result.uri);

                            // Vérifie si l'URI de la node est déjà dans uncoveredUri
                            if (!uncoveredUri.has(node.uri)) {
                                nodes.push(node);

                                // Ajoute les URI à uncoveredUri pour éviter les résultats de recherche redondants.
                                uncoveredUri.add(node.uri);

                                for (const relationship of node.relationships) {
                                    uncoveredUri.add(relationship.target_uri);
                                }

                                for (const attribute of node.attributes) {
                                    uncoveredUri.add(attribute.property_uri);
                                }

                                console.log(`Successfully built and added node for URI: ${result.uri}`);
                            } else {
                                console.log(`Node with URI ${result.uri} already covered, skipping.`);
                            }
                        } catch (error) {
                            console.warn(`Failed to build node for URI ${result.uri}:`, error);
                            // Saute cette node en cas d'échec
                        }
                    }

                    // 4. Mettre à jour la représentation persistante POUR CET UTILISATEUR/ONTOLOGIE
                    this.updateRepresentationWithNodes(userIri, onto, nodes);

                    // Renvoyer un message personnalisé avec les labels des entités trouvées
                    const entityLabels = nodes
                        .filter(node => node.label) // Seulement les nodes avec un label
                        .map(node => node.label)
                        .join(', ');

                    if (entityLabels) {
                        return `Les entités ${entityLabels} ont été trouvées par la recherche. Leurs relations ont été ajoutées aux résultats de recherche.`;
                    } else {
                        return `${nodes.length} entité(s) ont été trouvées par la recherche. Leurs relations ont été ajoutées aux résultats de recherche.`;
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
                    return `Erreur lors de la recherche par mots-clés: ${errorMessage}`;
                }
            }, {
                name: "search_from_natural_language",
                description: "Recherche des entités dans l'ontologie pour lesquels un des mots fournis apparaît dans les propriétés, valeurs, labels ou commentaires.",
                schema: z.object({
                    keywords: z.array(z.string()).describe("Liste de mots (partiels ou non) dans la langue de l'ontologie à rechercher"),
                    ontologyIri: z.string().describe("URI de l'ontologie dans laquelle effectuer la recherche"),
                }),
            }
        );

        const searchFromUriTool = tool(
            async ({ uris, ontologyIri: onto }: { uris: string[], ontologyIri: string }) => {
                if (!onto) {
                    return "Erreur : l'URI de l'ontologie est obligatoire pour le debug du graph.";
                }
                if (!uris || uris.length === 0) {
                    return "Erreur : au moins un URI d'entité est requis pour créer le graph de debug.";
                }
                try {
                    console.log(`Debug Graph Tool: Processing ${uris.length} entity URIs from ontology <${onto}>`);

                    // 2. Récupérer les détails de chaque URI une par une avec buildNodeFromUri
                    const nodes: Node[] = [];
                    for (const uri of uris) {
                        try {
                            const node = await buildNodeFromUri(this.http, this.FUSEKI_SPARQL, onto, uri);
                            nodes.push(node);
                            console.log(`Successfully built node for URI: ${uri}`);
                        } catch (error) {
                            console.warn(`Failed to build node for URI ${uri}:`, error);
                            // Saute cette node en cas d'échec
                        }
                    }

                    // 3. Mettre à jour la représentation persistante POUR CET UTILISATEUR/ONTOLOGIE
                    this.updateRepresentationWithNodes(userIri, onto, nodes);

                    // Renvoyer un message personnalisé avec les labels des entités trouvées
                    const entityLabels = nodes
                        .filter(node => node.label) // Seulement les nodes avec un label
                        .map(node => node.label)
                        .join(', ');

                    if (entityLabels) {
                        return `Les entités ${entityLabels} ont été trouvées par la recherche. Leurs relations ont été ajoutées aux résultats de recherche.`;
                    } else {
                        return `${nodes.length} entité(s) ont été trouvées par la recherche. Leurs relations ont été ajoutées aux résultats de recherche.`;
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
                    console.error('Error in debug graph tool:', error);
                    return `Erreur lors de la création du graph de debug: ${errorMessage}`;
                }
            }, {
                name: "search_from_uri",
                description: "Recherche des entités à partir d'une liste d'URIs dans une ontologie. Trouve leurs informations détaillées ainsi que leur voisinnage, concepts liés.",
                schema: z.object({
                    uris: z.array(z.string()).describe("Liste des URIs des éléments à partir desquels rechercher"),
                    ontologyIri: z.string().describe("URI de l'ontologie dans laquelle effectuer la recherche"),
                }),
            }
        );

        return [getMostConnectedNodesTool, searchFromNaturalLanguageTool, searchFromUriTool];
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

    /**
     * Met à jour la représentation (mémoire) pour un utilisateur/ontologie.
     */
    public updateRepresentationWithNodes(userIri: string, ontologyIri: string | undefined, nodes: Node[]) {
        const current = this.getOrCreateRepresentation(userIri, ontologyIri);
        const updated = current.updateWithNodes(nodes);
        this.representations.set(this.makeContextKey(userIri, ontologyIri), updated);
    }

    /**
     * Récupère la représentation textuelle des résultats persistants
     * pour un utilisateur (et une ontologie éventuelle).
     */
    public getPersistentResultsFor(userIri: string, ontologyIri?: string): string {
        return this.getOrCreateRepresentation(userIri, ontologyIri).toString();
    }

    /** Réinitialise la mémoire pour un utilisateur/ontologie (optionnel) */
    public clearRepresentation(userIri: string, ontologyIri?: string) {
        this.representations.delete(this.makeContextKey(userIri, ontologyIri));
    }
}