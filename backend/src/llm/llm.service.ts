import { Injectable, BadRequestException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom, Observable, Observer } from "rxjs";
import { ChatOllama } from "@langchain/ollama";
import {
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SYSTEM_PROMPT_FR } from "./prompt";

// Types
type HistoryItem = { role: "user" | "assistant" | "system"; content: string };
interface MessageEvent {
    data: string | object;
}

@Injectable()
export class LlmService {
    constructor(private readonly http: HttpService) {}

    // Constantes
    private readonly CORE = "http://example.org/core#";
    private readonly FUSEKI_BASE = (process.env.FUSEKI_URL ?? "http://fuseki:3030/autonomy").replace(
        /\/$/,
        ""
    );
    private readonly FUSEKI_SPARQL = `${this.FUSEKI_BASE}/sparql`;

    /**
     * Fonction d'échappement sécurisée pour les littéraux SPARQL.
     * Partagée avec OntologyService pour une protection cohérente.
     */
    private _escape(literalValue: string): string {
        if (typeof literalValue !== 'string') return '';
        return literalValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    // --- Méthodes privées de configuration et d'accès aux données ---

    private buildModel() {
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

    private async getUserGroups(userIri: string): Promise<string[]> {
        const sparql = `
      PREFIX core: <${this.CORE}>
      SELECT DISTINCT ?g WHERE {
        { ?g core:hasMember <${userIri}> } UNION
        { ?ms core:member <${userIri}> ; core:group ?g } UNION
        { GRAPH ?ng { ?g core:hasMember <${userIri}> } } UNION
        { GRAPH ?ng { ?ms core:member <${userIri}> ; core:group ?g } }
      }
    `;
        const params = new URLSearchParams({
            query: sparql,
            format: "application/sparql-results+json",
        });
        const res = await lastValueFrom(this.http.get(this.FUSEKI_SPARQL, { params }));
        return res.data.results.bindings.map((b: any) => b.g.value);
    }

    private async searchEntities(
        term: string,
        ontologyIri: string,
        userIri: string,
        limit = 10
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
          ?s ?p ?o .
          FILTER(isIRI(?s))
          OPTIONAL { ?s rdfs:label ?lbl }
          OPTIONAL { ?s core:visibleTo ?vg }
          FILTER(
            CONTAINS(LCASE(STR(COALESCE(?lbl, ""))), LCASE("${this._escape(term)}"))
            ||
            EXISTS {
              ?s ?p2 ?lit .
              FILTER(isLiteral(?lit) && CONTAINS(LCASE(STR(?lit)), LCASE("${this._escape(term)}")))
            }
          )
          FILTER( ${aclFilter} )
        }
      }
      ORDER BY LCASE(STR(?lbl))
      LIMIT ${Math.max(1, Math.min(50, limit))}
    `;
        const params = new URLSearchParams({
            query: sparql,
            format: "application/sparql-results+json",
        });
        const res = await lastValueFrom(this.http.get(this.FUSEKI_SPARQL, { params }));
        type Row = { s: { value: string }; lbl?: { value: string } };
        return (res.data.results.bindings as Row[]).map((r) => ({
            id: r.s.value,
            label: r.lbl?.value,
        }));
    }

    private async getEntityDetails(iri: string, ontologyIri: string): Promise<{
        id: string;
        label?: string;
        types: string[];
        properties: { predicate: string; value: string; isLiteral: boolean }[];
    }> {
        if (!ontologyIri) throw new BadRequestException("ontologyIri manquant");
        const sparql = `
      PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT ?lbl ?p ?v ?isUri WHERE {
        GRAPH <${ontologyIri}> {
          OPTIONAL { <${iri}> rdfs:label ?lbl }
          {
            <${iri}> rdf:type ?v .
            BIND("type" AS ?isUri)
            BIND(rdf:type AS ?p)
          } UNION {
            <${iri}> ?p ?v .
            FILTER(?p != rdfs:label)
            BIND( IF(isIRI(?v), "uri", "lit") AS ?isUri )
          }
        }
      }
    `;
        const params = new URLSearchParams({
            query: sparql,
            format: "application/sparql-results+json",
        });
        const res = await lastValueFrom(this.http.get(this.FUSEKI_SPARQL, { params }));
        type Row = {
            lbl?: { value: string };
            p: { value: string };
            v: { value: string; type: string };
            isUri: { value: string };
        };

        const rows = res.data.results.bindings as Row[];
        const label = rows.find((r) => r.lbl)?.lbl?.value;
        const types = Array.from(
            new Set(rows.filter((r) => r.p.value.endsWith("type")).map((r) => r.v.value))
        );
        const properties = rows
            .filter((r) => !r.p.value.endsWith("type"))
            .map((r) => ({
                predicate: r.p.value,
                value: r.v.value,
                isLiteral: r.v.type !== "uri",
            }));

        return {
            id: iri,
            label: label || iri.split(/[#/]/).pop(),
            types,
            properties,
        };
    }

    private toLangchainHistory(history?: HistoryItem[]): BaseMessage[] {
        if (!history || history.length === 0) return [];
        return history.map((h) => {
            if (h.role === "system") return new SystemMessage(h.content);
            if (h.role === "assistant") return new AIMessage(h.content);
            return new HumanMessage(h.content);
        });
    }

    /**
     * Crée les outils (tools) que le LLM peut utiliser.
     */
    private _buildTools(userIri: string, ontologyIri?: string) {
        const searchEntitiesTool = tool(
            async ({
                       query,
                       ontologyIri: onto,
                       limit,
                   }: {
                query: string;
                ontologyIri?: string;
                limit?: number;
            }) => {
                const ontoEff = onto || ontologyIri || "";
                const list = await this.searchEntities(query, ontoEff, userIri, limit ?? 10);
                return JSON.stringify({ hits: list, ontologyIri: ontoEff });
            },
            {
                name: "search_entities",
                description:
                    "Recherche des individus pertinents par mot-clé dans une ontologie donnée. Utilise les labels et les valeurs littérales.",
                schema: z.object({
                    query: z.string().describe("Texte de recherche"),
                    ontologyIri: z.string().optional().describe("IRI du graph d'ontologie"),
                    limit: z.number().int().min(1).max(50).optional().describe("Nombre maximum de résultats"),
                }),
            }
        );

        const getEntityTool = tool(
            async ({ iri, ontologyIri: onto }: { iri: string; ontologyIri?: string }) => {
                const ontoEff = onto || ontologyIri || "";
                const data = await this.getEntityDetails(iri, ontoEff);
                return JSON.stringify({ entity: data, ontologyIri: ontoEff });
            },
            {
                name: "get_entity",
                description: "Récupère le détail d'un individu (types et propriétés) dans une ontologie.",
                schema: z.object({
                    iri: z.string().describe("IRI de l'individu à détailler"),
                    ontologyIri: z.string().optional().describe("IRI du graph d'ontologie"),
                }),
            }
        );

        return [searchEntitiesTool, getEntityTool];
    }

    // --- Méthodes publiques ---

    /**
     * Pose une question au LLM et retourne la réponse en streaming (SSE).
     */
    askStream(params: {
        userIri: string;
        question: string;
        ontologyIri?: string;
        history?: HistoryItem[];
    }): Observable<MessageEvent> {
        const { userIri, question, ontologyIri, history } = params;
        if (!question || !question.trim()) {
            throw new BadRequestException("Question vide");
        }

        return new Observable((observer: Observer<MessageEvent>) => {
            const run = async () => {
                try {
                    const llm = this.buildModel();
                    const tools = this._buildTools(userIri, ontologyIri);
                    const llmWithTools = llm.bindTools(tools);

                    const messages: BaseMessage[] = [
                        new SystemMessage(
                            (ontologyIri
                                ? `${SYSTEM_PROMPT_FR}\nContexte: l'ontologie active est <${ontologyIri}>.`
                                : SYSTEM_PROMPT_FR) as string
                        ),
                        ...this.toLangchainHistory(history),
                        new HumanMessage(question),
                    ];

                    // Première invocation pour potentiellement appeler des outils
                    let ai = await llmWithTools.invoke(messages);
                    let safety = 0;

                    // Boucle pour gérer les appels d'outils
                    while (ai.tool_calls && ai.tool_calls.length > 0 && safety < 4) {
                        for (const tc of ai.tool_calls) {
                            if (!tc.id) continue;
                            let result = "";
                            if (tc.name === "search_entities") {
                                const args = tc.args as { query: string; ontologyIri?: string; limit?: number };
                                const onto = args.ontologyIri || ontologyIri || "";
                                const list = await this.searchEntities(args.query, onto, userIri, args.limit ?? 10);
                                result = JSON.stringify({ hits: list, ontologyIri: onto });
                            } else if (tc.name === "get_entity") {
                                const args = tc.args as { iri: string; ontologyIri?: string };
                                const onto = args.ontologyIri || ontologyIri || "";
                                const data = await this.getEntityDetails(args.iri, onto);
                                result = JSON.stringify({ entity: data, ontologyIri: onto });
                            } else {
                                result = JSON.stringify({ error: `Outil inconnu: ${tc.name}` });
                            }
                            messages.push(new ToolMessage({ content: result, tool_call_id: tc.id }));
                        }
                        // Ré-invoque le modèle avec les résultats des outils
                        ai = await llmWithTools.invoke(messages);
                        safety += 1;
                    }

                    // Une fois les outils utilisés, on streame la réponse finale
                    const stream = await llm.stream(messages);

                    for await (const chunk of stream) {
                        if (chunk.content) {
                            observer.next({ data: chunk.content as string });
                        }
                    }
                    observer.next({ data: "[DONE]" }); // Signal de fin standard pour SSE
                    observer.complete();
                } catch (error) {
                    observer.error(error);
                }
            };
            run();
        });
    }

    /**
     * Pose une question au LLM et retourne la réponse complète.
     */
    async ask(params: {
        userIri: string;
        question: string;
        ontologyIri?: string;
        history?: HistoryItem[];
    }): Promise<{ answer: string }> {
        const { userIri, question, ontologyIri, history } = params;
        if (!question || !question.trim()) throw new BadRequestException("Question vide");

        const llm = this.buildModel();
        const tools = this._buildTools(userIri, ontologyIri);
        const llmWithTools = llm.bindTools(tools);

        const messages: BaseMessage[] = [
            new SystemMessage(
                (ontologyIri
                    ? `${SYSTEM_PROMPT_FR}\nContexte: l'ontologie active est <${ontologyIri}>.`
                    : SYSTEM_PROMPT_FR) as string
            ),
            ...this.toLangchainHistory(history),
            new HumanMessage(question),
        ];

        let ai = await llmWithTools.invoke(messages);
        let safety = 0;

        while (ai.tool_calls && ai.tool_calls.length > 0 && safety < 4) {
            for (const tc of ai.tool_calls) {
                if (!tc.id) continue;
                let result = "";
                if (tc.name === "search_entities") {
                    const args = tc.args as { query: string; ontologyIri?: string; limit?: number };
                    const onto = args.ontologyIri || ontologyIri || "";
                    const list = await this.searchEntities(args.query, onto, userIri, args.limit ?? 10);
                    result = JSON.stringify({ hits: list, ontologyIri: onto });
                } else if (tc.name === "get_entity") {
                    const args = tc.args as { iri: string; ontologyIri?: string };
                    const onto = args.ontologyIri || ontologyIri || "";
                    const data = await this.getEntityDetails(args.iri, onto);
                    result = JSON.stringify({ entity: data, ontologyIri: onto });
                } else {
                    result = JSON.stringify({ error: `Outil inconnu: ${tc.name}` });
                }
                messages.push(new ToolMessage({ content: result, tool_call_id: tc.id }));
            }
            // Ré-invoque le modèle avec le contexte des outils
            ai = await llmWithTools.invoke(messages);
            safety += 1;
        }

        const answer = (ai.content as string) || "Je n’ai pas pu formuler de réponse.";
        return { answer };
    }
}