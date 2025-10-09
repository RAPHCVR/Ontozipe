import { Injectable, BadRequestException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { ChatOllama } from "@langchain/ollama";
import { Runnable } from "@langchain/core/runnables";
import { tool, StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { escapeSparqlLiteral } from "../utils/sparql.utils";
import { ChatOpenAI } from "@langchain/openai";
import { getMostConnectedNodes, searchNodesByKeywords, buildNodeFromUri, buildNodesFromUris } from "./queries";
import { ResultRepresentation, Node } from "./result_representation";
import { NodeRequest } from "./constrained_query";
import { Response } from "express";

@Injectable()
export class LlmService {
    constructor(private readonly http: HttpService) {}

    private readonly CORE = "http://example.org/core#";
    private readonly FUSEKI_SPARQL = `${(process.env.FUSEKI_URL ?? "http://fuseki:3030/autonomy").replace(/\/$/,"")}/sparql`;

    private readonly sseRuns = new Map<string, Set<Response>>();
    private readonly representations = new Map<string, ResultRepresentation>();

    private makeContextKey(userIri: string, ontologyIri?: string, sessionId?: string): string {
        return `${userIri}::${ontologyIri ?? "default"}::${sessionId ?? "default"}`;
    }
    private getOrCreateRepresentation(userIri: string, ontologyIri?: string, sessionId?: string): ResultRepresentation {
        const key = this.makeContextKey(userIri, ontologyIri, sessionId);
        let rep = this.representations.get(key);
        if (!rep) {
            rep = new ResultRepresentation();
            this.representations.set(key, rep);
        }
        return rep;
    }

    private buildModel2(): ChatOllama {
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

    private buildModel(): ChatOpenAI {
        const openAIApiKey = process.env.OPENAI_API_KEY;
        if (!openAIApiKey) {
            throw new Error("OPENAI_API_KEY is not set in environment variables");
        }
        const model = process.env.OPENAI_MODEL || "gpt-5-mini";
        return new ChatOpenAI({ openAIApiKey, modelName: model });
    }

    public buildDecisionModel(): ChatOpenAI {
         const openAIApiKey = process.env.OPENAI_API_KEY;
         if (!openAIApiKey) {
             throw new Error("OPENAI_API_KEY is not set in environment variables");
         }
         const model = process.env.OPENAI_DECISION_MODEL || "gpt-4.1-mini";
         return new ChatOpenAI({ openAIApiKey, modelName: model });
     }

    public registerSseSubscriber(key: string, res: Response): { isFirst: boolean } {
        const existing = this.sseRuns.get(key);
        const isFirst = !existing;
        const set = existing ?? new Set<Response>();
        set.add(res);
        if (!existing) this.sseRuns.set(key, set);

        res.on("close", () => {
            const current = this.sseRuns.get(key);
            if (!current) return;
            current.delete(res);
        });
        return { isFirst };
    }

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

    private buildTools(userIri: string, ontologyIri?: string, sessionId?: string): StructuredTool[] {

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
            async ({
                keywords,
                ontologyIri: onto,
                uris,
                objectUris,
                relationFilters,
                maxResults,
                typeNames,
                relationNameFilters,
            }: {
                keywords?: string[];
                ontologyIri: string;
                uris?: string[];
                objectUris?: string[];
                relationFilters?: Array<{ predicate: string; direction?: "incoming" | "outgoing" | "both"; present: boolean; objectUris?: string[] }>;
                maxResults?: number;
                typeNames?: string[];
                relationNameFilters?: Array<{ name: string; direction?: "incoming" | "outgoing" | "both"; present?: boolean }>;
            }) => {
                if (!onto) return "Erreur : l'URI de l'ontologie est obligatoire pour la recherche.";
                try {
                const req = new NodeRequest({
                    keywords: keywords ?? [],
                    uris: uris ?? [],
                    object_uris: objectUris ?? [],
                    relation_filters: (relationFilters ?? []).map((rf) => ({
                    predicate: rf.predicate,
                    direction: rf.direction,
                    present: rf.present,
                    object_uris: rf.objectUris ?? [],
                    })),
                    type_name_patterns: typeNames ?? [],
                    relation_name_filters: (relationNameFilters ?? []).map((r) => ({
                        name: r.name,
                        direction: r.direction,
                        present: r.present ?? true,
                    })),
                    max_results: maxResults ?? 6,
                });
                const nodes = await req.fetch(this.http, this.FUSEKI_SPARQL, onto);
                this.updateRepresentationWithNodes(userIri, onto, nodes, sessionId);
                const entityLabels = nodes
                    .filter((n) => n.label)
                    .map((n) => n.label)
                    .join(", ");
                return entityLabels
                    ? `Les entités ${entityLabels} ont été trouvées par la recherche. Leurs relations ont été ajoutées aux résultats de recherche.`
                    : `${nodes.length} entité(s) ont été trouvées par la recherche. Leurs relations ont été ajoutées aux résultats de recherche.`;
                } catch (error) {
                const msg = error instanceof Error ? error.message : "Erreur inconnue";
                return `Erreur lors de la recherche: ${msg}`;
                }
            },
            {
                name: "search_from_natural_language",
                description:
                "Recherche d'entités dans l'ontologie. Insensible à la casse et aux espaces (ex: 'développé par' ~ 'développéPar'). " +
                "Paramètres possibles (tous optionnels sauf ontologyIri) :\n" +
                "- keywords: texte libre sur URI/localName/label/comment/propriétés/valeurs (OR)\n" +
                "- uris: inclure directement ces URIs\n" +
                "- objectUris: retourne les sujets ?node tels que ?node ?p ?o et ?o ∈ objectUris\n" +
                "- relationFilters: via IRI exact du prédicat (présence/absence, direction, cibles)\n" +
                "- typeNames: restreint aux noeuds ayant les rdf:type correspondants (nom partiel, AND)\n" +
                "- relationNameFilters: restreint selon le nom (partiel) du prédicat (AND, direction/presence configurables)\n" +
                "Les correspondances par nom sont insensibles à la casse et aux espaces/traits/underscores (ex: 'ownedBy' ~ 'Owned By').",
                schema: z.object({
                keywords: z.array(z.string()).optional().describe("Mots-clés à chercher (partiels ou non)"),
                ontologyIri: z.string().describe("URI de l'ontologie"),
                uris: z.array(z.string()).optional().describe("URIs d'entités à inclure directement dans la recherche"),
                objectUris: z.array(z.string()).optional().describe("Retourne les sujets ?node tels que ?node ?p ?o et ?o ∈ objectUris"),
                relationFilters: z.array(
                    z.object({
                    predicate: z.string().describe("IRI du prédicat à tester"),
                    direction: z.enum(["incoming", "outgoing", "both"]).optional().describe("Direction à tester (défaut: both)"),
                    present: z.boolean().describe("true => doit exister, false => ne doit pas exister"),
                    objectUris: z.array(z.string()).optional().describe("Pour direction=outgoing, cible(s) ?o spécifique(s)"),
                    })
                ).optional(),
                typeNames: z.array(z.string()).optional().describe("Types (rdf:type) à exiger par nom (correspondance partielle insensible à la casse/espaces). Tous doivent être présents (AND)."),
                relationNameFilters: z.array(
                    z.object({
                        name: z.string().describe("Nom (partiel accepté) du prédicat à tester, ex: 'ownedBy'"),
                        direction: z.enum(["incoming", "outgoing", "both"]).optional().describe("Direction (défaut: both)"),
                        present: z.boolean().optional().describe("true => doit exister (défaut), false => ne doit pas exister"),
                    })
                ).optional(),
                maxResults: z.number().int().min(1).max(20).optional().describe("Nombre max de résultats (défaut: 6)"),
                }),
            }
        );

        const searchFromUriTool = tool(
            async ({ uris, ontologyIri: onto }: { uris: string[]; ontologyIri: string }) => {
                if (!onto) {
                    return "Erreur : l'URI de l'ontologie est obligatoire pour le debug du graph.";
                }
                if (!uris || uris.length === 0) {
                    return "Erreur : au moins un URI d'entité est requis pour créer le graph de debug.";
                }
                try {
                    const uniqueUris = Array.from(new Set(uris.filter(Boolean)));
                    console.log(`Debug Graph Tool: Processing ${uniqueUris.length} entity URIs from ontology <${onto}>`);

                    // One SPARQL round-trip for multiple URIs
                    const nodes: Node[] = await buildNodesFromUris(this.http, this.FUSEKI_SPARQL, onto, uniqueUris);

                    this.updateRepresentationWithNodes(userIri, onto, nodes, sessionId);

                    const entityLabels = nodes
                        .filter(node => node.label)
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
                description: "Explore le graph à partir d'URIs d'entités: récupère les informations détaillées et le voisinage (liens sortants/entrants), y compris les sous-classes (enfants via rdfs:subClassOf entrants) et les instances/membres (via belongsToClass entrants).",
                schema: z.object({
                    uris: z.array(z.string()).describe("Liste des URIs des éléments à partir desquels rechercher"),
                    ontologyIri: z.string().describe("URI de l'ontologie dans laquelle effectuer la recherche"),
                }),
            }
        );

        // Only returning the tools you enabled previously
        return [searchFromNaturalLanguageTool, searchFromUriTool];
    }

    public prepareAgentExecutor(params: { userIri: string; ontologyIri?: string; sessionId?: string }): {
        llm: ChatOpenAI;
        llmWithTools: Runnable;
        tools: StructuredTool[];
    } {
        const llm = this.buildModel();
        const tools = this.buildTools(params.userIri, params.ontologyIri, params.sessionId);
        const llmWithTools = llm.bindTools(tools);
        return { llm, llmWithTools, tools };
    }

    public updateRepresentationWithNodes(userIri: string, ontologyIri: string | undefined, nodes: Node[], sessionId?: string) {
        const current = this.getOrCreateRepresentation(userIri, ontologyIri, sessionId);
        const updated = current.updateWithNodes(nodes);
        this.representations.set(this.makeContextKey(userIri, ontologyIri, sessionId), updated);
    }

    public getPersistentResultsFor(userIri: string, ontologyIri?: string, sessionId?: string): string {
        return this.getOrCreateRepresentation(userIri, ontologyIri, sessionId).toString();
    }

    public clearRepresentation(userIri: string, ontologyIri?: string, sessionId?: string) {
        this.representations.delete(this.makeContextKey(userIri, ontologyIri, sessionId));
    }
}