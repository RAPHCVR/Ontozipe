import { Injectable, BadRequestException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { ChatOllama } from "@langchain/ollama";
import { Runnable } from "@langchain/core/runnables";
import { tool, StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { escapeSparqlLiteral } from "../utils/sparql.utils";
import { ChatOpenAI } from "@langchain/openai";
import {
	getMostConnectedNodes,
	searchNodesByKeywords,
	buildNodeFromUri,
	buildNodesFromUris,
} from "./queries";
import { ResultRepresentation, Node } from "./result_representation";
import { NodeRequest } from "./constrained_query";
import { Response } from "express";

@Injectable()
export class LlmService {
	constructor(private readonly http: HttpService) {}

	private readonly CORE = "http://example.org/core#";
	private readonly FUSEKI_SPARQL = `${(process.env.FUSEKI_URL ?? "http://fuseki:3030/autonomy").replace(/\/$/, "")}/sparql`;
	private readonly FRONTEND_BASE_URL = (
		process.env.FRONTEND_BASE_URL || "http://localhost:5173"
	).replace(/\/$/, "");

	private readonly sseRuns = new Map<string, Set<Response>>();
	private readonly representations = new Map<string, ResultRepresentation>();

	private makeContextKey(
		userIri: string,
		ontologyIri?: string,
		sessionId?: string
	): string {
		return `${userIri}::${ontologyIri ?? "default"}::${sessionId ?? "default"}`;
	}

	private isLikelyIri(value?: string | null): value is string {
		if (!value) return false;
		return /^https?:\/\//i.test(value);
	}

	private getOrCreateRepresentation(
		userIri: string,
		ontologyIri?: string,
		sessionId?: string
	): ResultRepresentation {
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

	public registerSseSubscriber(
		key: string,
		res: Response
	): { isFirst: boolean } {
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
		for (const r of Array.from(subs)) {
			try {
				r.end();
			} catch {
				// ignore close errors
			}
		}
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
		type SparqlBinding = { g: { value: string } };
		const params = new URLSearchParams({
			query: sparql,
			format: "application/sparql-results+json",
		});
		const res = await lastValueFrom(
			this.http.get(this.FUSEKI_SPARQL, { params })
		);
		return (res.data.results.bindings as SparqlBinding[]).map((b) => b.g.value);
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
              ?s ?p ?o . FILTER(isIRI(?s))
              OPTIONAL { ?s rdfs:label ?lbl }
              OPTIONAL { ?s core:visibleTo ?vg }
              FILTER(
                CONTAINS(LCASE(STR(COALESCE(?lbl, ""))), LCASE("${escapeSparqlLiteral(term)}")) ||
                EXISTS { ?s ?p2 ?lit .
                    FILTER(isLiteral(?lit) && CONTAINS(LCASE(STR(?lit)), LCASE("${escapeSparqlLiteral(term)}")))
                }
              )
              FILTER(${aclFilter})
            }
          }
          ORDER BY LCASE(STR(?lbl))
          LIMIT ${Math.max(1, Math.min(50, limit))}`;

		const params = new URLSearchParams({
			query: sparql,
			format: "application/sparql-results+json",
		});
		const res = await lastValueFrom(
			this.http.get(this.FUSEKI_SPARQL, { params })
		);
		type Row = { s: { value: string }; lbl?: { value: string } };
		return (res.data.results.bindings as Row[]).map((r) => ({
			id: r.s.value,
			label: r.lbl?.value,
		}));
	}

	private async getEntityDetails(
		uri: string,
		ontologyIri: string
	): Promise<{
		id: string;
		label?: string;
		types: string[];
		properties: { predicate: string; value: string; isLiteral: boolean }[];
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
		const params = new URLSearchParams({
			query: sparql,
			format: "application/sparql-results+json",
		});
		const res = await lastValueFrom(
			this.http.get(this.FUSEKI_SPARQL, { params })
		);
		type Row = {
			lbl?: { value: string };
			p: { value: string };
			v: { value: string; type: string };
		};
		const rows = res.data.results.bindings as Row[];

		if (rows.length === 0) return null;

		const label = rows.find((r) => r.lbl)?.lbl?.value;
		const types = Array.from(
			new Set(
				rows.filter((r) => r.p.value.endsWith("type")).map((r) => r.v.value)
			)
		);
		const properties = rows
			.filter((r) => !r.p.value.endsWith("type"))
			.map((r) => ({
				predicate: r.p.value,
				value: r.v.value,
				isLiteral: r.v.type !== "uri",
			}));
		return {
			id: uri,
			label: label || uri.split(/[#/]/).pop(),
			types,
			properties,
		};
	}

	private async uriExistsInGraph(
		ontologyIri: string,
		candidate: string
	): Promise<boolean> {
		const sparql = `ASK { GRAPH <${ontologyIri}> { <${candidate}> ?p ?o } }`;
		const params = new URLSearchParams({
			query: sparql,
			format: "application/sparql-results+json",
		});
		try {
			const res = await lastValueFrom(
				this.http.get(this.FUSEKI_SPARQL, { params })
			);
			return Boolean(res.data?.boolean);
		} catch (error) {
			console.warn(
				"[LlmService] Failed to verify URI existence:",
				candidate,
				error
			);
			return false;
		}
	}

	private buildCandidateUris(
		identifier: string,
		ontologyIri?: string
	): string[] {
		if (!ontologyIri) return [];
		const trimmed = ontologyIri.replace(/[#/]+$/, "");
		return [`${trimmed}#${identifier}`, `${trimmed}/${identifier}`];
	}

	private async normalizeEntityIdentifiers(
		identifiers: string[],
		context: { userIri: string; ontologyIri?: string; sessionId?: string }
	): Promise<string[]> {
		if (!identifiers || identifiers.length === 0) return [];
		const normalized: string[] = [];
		const cache = new Map<string, string>();
		const rep = this.getOrCreateRepresentation(
			context.userIri,
			context.ontologyIri,
			context.sessionId
		);

		for (const raw of identifiers) {
			const value = raw?.trim();
			if (!value) continue;

			if (/^https?:\/\//i.test(value)) {
				normalized.push(value);
				continue;
			}

			const cached = cache.get(value) ?? cache.get(value.toLowerCase());
			if (cached) {
				normalized.push(cached);
				continue;
			}

			const fromRep = rep.findMatchingUri(value);
			if (fromRep) {
				cache.set(value, fromRep);
				cache.set(value.toLowerCase(), fromRep);
				normalized.push(fromRep);
				continue;
			}

			let resolved: string | undefined;
			if (context.ontologyIri) {
				const candidates = this.buildCandidateUris(value, context.ontologyIri);
				for (const candidate of candidates) {
					if (await this.uriExistsInGraph(context.ontologyIri, candidate)) {
						resolved = candidate;
						break;
					}
				}
			}

			if (resolved) {
				cache.set(value, resolved);
				cache.set(value.toLowerCase(), resolved);
				normalized.push(resolved);
			} else {
				console.warn(
					"[LlmService] Unable to resolve identifier to URI:",
					value
				);
			}
		}
		return normalized;
	}

	private buildTools(
		userIri: string,
		ontologyIri?: string,
		sessionId?: string
	): StructuredTool[] {
		const searchTool = tool(
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
				if (!ontoEff) {
					return "Erreur : l'URI de l'ontologie est manquant pour la recherche. Demandez à l'utilisateur de la préciser.";
				}
				const list = await this.searchEntities(
					query,
					ontoEff,
					userIri,
					limit ?? 10
				);
				if (list.length === 0) {
					return `Aucune entité trouvée pour la recherche "${query}" dans l'ontologie <${ontoEff}>.`;
				}
				return JSON.stringify({ hits: list, ontologyIri: ontoEff });
			},
			{
				name: "search_entities",
				description:
					"Recherche des individus pertinents par mot-clé dans une ontologie donnée.",
				schema: z.object({
					query: z.string().describe("Texte de recherche"),
					ontologyIri: z
						.string()
						.optional()
						.describe("URI du graph d'ontologie"),
					limit: z.number().int().min(1).max(50).optional(),
				}),
			}
		);

		const getTool = tool(
			async ({
				uri,
				ontologyIri: onto,
			}: {
				uri: string;
				ontologyIri?: string;
			}) => {
				const ontoEff = onto || ontologyIri || "";
				if (!ontoEff) {
					return "Erreur : l'URI de l'ontologie est manquant pour la récupération de détails. Demandez à l'utilisateur de la préciser.";
				}
				const data = await this.getEntityDetails(uri, ontoEff);
				if (!data) {
					return `Aucun détail trouvé pour l'individu <${uri}> dans l'ontologie <${ontoEff}>. Il n'existe peut-être pas.`;
				}
				return JSON.stringify({ entity: data, ontologyIri: ontoEff });
			},
			{
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
					const nodes = await getMostConnectedNodes(
						this.http,
						this.FUSEKI_SPARQL,
						ontoEff
					);
					if (nodes.length === 0) {
						return `Aucun noeud trouvé dans l'ontologie <${ontoEff}>.`;
					}
					return JSON.stringify({
						nodes: nodes.map((n) => ({
							uri: n.uri,
							connectionCount: n.connectionCount,
						})),
						totalFound: nodes.length,
						ontologyIri: ontoEff,
					});
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : "Erreur inconnue";
					return `Erreur lors de la récupération des noeuds les plus connectés: ${errorMessage}`;
				}
			},
			{
				name: "get_most_connected_nodes",
				description:
					"Récupère les 10 noeuds ayant le plus de connexions dans une ontologie donnée.",
				schema: z.object({
					ontologyIri: z
						.string()
						.optional()
						.describe("URI du graph d'ontologie"),
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
				relationFilters?: Array<{
					predicate: string;
					direction?: "incoming" | "outgoing" | "both";
					present: boolean;
					objectUris?: string[];
				}>;
				maxResults?: number;
				typeNames?: string[];
				relationNameFilters?: Array<{
					name: string;
					direction?: "incoming" | "outgoing" | "both";
					present?: boolean;
				}>;
			}) => {
				if (!onto) {
					return "Erreur : l'URI de l'ontologie est obligatoire pour la recherche.";
				}

				const sanitizedMax = Math.min(Math.max(maxResults ?? 6, 1), 20);
				const hasAdvancedFilters =
					Boolean(uris?.length) ||
					Boolean(objectUris?.length) ||
					Boolean(relationFilters?.length) ||
					Boolean(typeNames?.length) ||
					Boolean(relationNameFilters?.length);

				try {
					let nodes: Node[] = [];
					if (hasAdvancedFilters) {
						const request = new NodeRequest({
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
							max_results: sanitizedMax,
						});
						nodes = (
							await request.fetch(this.http, this.FUSEKI_SPARQL, onto)
						).filter((node) => this.isLikelyIri(node?.uri));
					} else {
						if (!keywords || keywords.length === 0) {
							return "Erreur : au moins un mot-clé est requis pour la recherche.";
						}
						const results = await searchNodesByKeywords(
							this.http,
							this.FUSEKI_SPARQL,
							onto,
							keywords
						);
						const firstHits = results.slice(0, sanitizedMax);
						const covered = new Set<string>();
						for (const hit of firstHits) {
							if (!this.isLikelyIri(hit.uri)) {
								continue;
							}
							try {
								const node = await buildNodeFromUri(
									this.http,
									this.FUSEKI_SPARQL,
									onto,
									hit.uri
								);
								if (covered.has(node.uri)) continue;
								nodes.push(node);
								covered.add(node.uri);
								for (const relation of node.relationships) {
									covered.add(relation.target_uri);
								}
								for (const attribute of node.attributes) {
									covered.add(attribute.property_uri);
								}
							} catch (error) {
								console.warn(`Failed to build node for URI ${hit.uri}:`, error);
							}
						}
					}

					this.updateRepresentationWithNodes(userIri, onto, nodes, sessionId);

					const entityLabels = nodes
						.filter((node) => node.label)
						.map((node) => node.label)
						.join(", ");

					if (entityLabels) {
						return `Les entités ${entityLabels} ont été trouvées par la recherche. Leurs relations ont été ajoutées aux résultats de recherche.`;
					}
					return `${nodes.length} entité(s) ont été trouvées par la recherche. Leurs relations ont été ajoutées aux résultats de recherche.`;
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : "Erreur inconnue";
					return `Erreur lors de la recherche: ${errorMessage}`;
				}
			},
			{
				name: "search_from_natural_language",
				description:
					"Recherche et filtrage d'entités dans l'ontologie à partir de mots-clés ou de critères avancés (types, relations, URIs).",
				schema: z.object({
					keywords: z
						.array(z.string())
						.optional()
						.describe("Mots-clés à chercher (partiels ou non)"),
					ontologyIri: z.string().describe("URI de l'ontologie"),
					uris: z
						.array(z.string())
						.optional()
						.describe(
							"URIs COMPLETES des entités à inclure directement dans les résultats."
						),
					objectUris: z
						.array(z.string())
						.optional()
						.describe("Filtre sur les objets liés (?node ?p ?o)."),
					relationFilters: z
						.array(
							z.object({
								predicate: z
									.string()
									.describe("IRI exact du prédicat à tester"),
								direction: z
									.enum(["incoming", "outgoing", "both"])
									.optional()
									.describe("Direction à tester (défaut: both)"),
								present: z
									.boolean()
									.describe(
										"true => doit exister, false => ne doit pas exister"
									),
								objectUris: z
									.array(z.string())
									.optional()
									.describe("Cibles spécifiques pour outgoing"),
							})
						)
						.optional(),
					typeNames: z
						.array(z.string())
						.optional()
						.describe(
							"Types (rdf:type) exigés par nom partiel (insensible casse/espaces)."
						),
					relationNameFilters: z
						.array(
							z.object({
								name: z
									.string()
									.describe("Nom (partiel) du prédicat, ex: 'ownedBy'"),
								direction: z
									.enum(["incoming", "outgoing", "both"])
									.optional()
									.describe("Direction (défaut: both)"),
								present: z
									.boolean()
									.optional()
									.describe("true => doit exister (défaut), false sinon"),
							})
						)
						.optional(),
					maxResults: z
						.number()
						.int()
						.min(1)
						.max(20)
						.optional()
						.describe(
							"Nombre max de résultats (min: 1, max: 20, recherche de survol: 5)"
						),
				}),
			}
		);

		const searchFromUriTool = tool(
			async ({
				uris,
				ontologyIri: onto,
			}: {
				uris: string[];
				ontologyIri: string;
			}) => {
				if (!onto) {
					return "Erreur : l'URI de l'ontologie est obligatoire pour le debug du graph.";
				}
				if (!uris || uris.length === 0) {
					return "Erreur : au moins un URI d'entité est requis pour créer le graph de debug.";
				}
				try {
					const normalizedUris = await this.normalizeEntityIdentifiers(uris, {
						userIri,
						ontologyIri: onto || ontologyIri,
						sessionId,
					});
					const baseCandidates = normalizedUris.length ? normalizedUris : uris;
					const uniqueUris = Array.from(
						new Set(baseCandidates.filter((uri) => this.isLikelyIri(uri)))
					);
					if (uniqueUris.length === 0) {
						return "Erreur : aucune URI valide n'a été fournie pour créer le graph de debug.";
					}
					if (uniqueUris.length === 0) {
						return "Erreur : aucune URI valide n'a été fournie.";
					}

					let nodes: Node[] = [];
					try {
						nodes = await buildNodesFromUris(
							this.http,
							this.FUSEKI_SPARQL,
							onto,
							uniqueUris
						);
					} catch (bulkError) {
						console.warn(
							"buildNodesFromUris failed, falling back to per-URI fetch:",
							bulkError
						);
						for (const uri of uniqueUris) {
							try {
								const node = await buildNodeFromUri(
									this.http,
									this.FUSEKI_SPARQL,
									onto,
									uri
								);
								nodes.push(node);
							} catch (error) {
								console.warn(`Failed to build node for URI ${uri}:`, error);
							}
						}
					}

					nodes = nodes.filter((node) => this.isLikelyIri(node?.uri));

					this.updateRepresentationWithNodes(userIri, onto, nodes, sessionId);

					const entityLabels = nodes
						.filter((node) => node.label)
						.map((node) => node.label)
						.join(", ");

					if (entityLabels) {
						return `Les entités ${entityLabels} ont été trouvées par la recherche. Leurs relations ont été ajoutées aux résultats de recherche.`;
					}
					return `${nodes.length} entité(s) ont été trouvées par la recherche. Leurs relations ont été ajoutées aux résultats de recherche.`;
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : "Erreur inconnue";
					console.error("Error in debug graph tool:", error);
					return `Erreur lors de la création du graph de debug: ${errorMessage}`;
				}
			},
			{
				name: "search_from_uri",
				description:
					"Explore le graph à partir d'URIs complètes d'entités : récupère le voisinage (liens sortants/entrants), les sous-classes et les instances.",
				schema: z.object({
					uris: z
						.array(z.string())
						.describe("Liste des URIs complètes à explorer"),
					ontologyIri: z.string().describe("URI de l'ontologie"),
				}),
			}
		);

		return [
			searchTool,
			getTool,
			getMostConnectedNodesTool,
			searchFromNaturalLanguageTool,
			searchFromUriTool,
		];
	}

	public prepareAgentExecutor(params: {
		userIri: string;
		ontologyIri?: string;
		sessionId?: string;
	}): {
		llm: ChatOpenAI;
		llmWithTools: Runnable;
		tools: StructuredTool[];
	} {
		const llm = this.buildModel();
		const tools = this.buildTools(
			params.userIri,
			params.ontologyIri,
			params.sessionId
		);
		const llmWithTools = llm.bindTools(tools);
		return { llm, llmWithTools, tools };
	}

	public updateRepresentationWithNodes(
		userIri: string,
		ontologyIri: string | undefined,
		nodes: Node[],
		sessionId?: string
	) {
		const current = this.getOrCreateRepresentation(
			userIri,
			ontologyIri,
			sessionId
		);
		const updated = current.updateWithNodes(nodes);
		this.representations.set(
			this.makeContextKey(userIri, ontologyIri, sessionId),
			updated
		);
	}

	public getPersistentResultsFor(
		userIri: string,
		ontologyIri?: string,
		sessionId?: string
	): string {
		return this.getOrCreateRepresentation(
			userIri,
			ontologyIri,
			sessionId
		).toString({
			ontologyIri,
			frontendBaseUrl: this.FRONTEND_BASE_URL,
		});
	}

	public clearRepresentation(
		userIri: string,
		ontologyIri?: string,
		sessionId?: string
	) {
		this.representations.delete(
			this.makeContextKey(userIri, ontologyIri, sessionId)
		);
	}

	public async summarizeDashboard(
		section: string,
		payload: unknown,
		language: string = "fr"
	): Promise<string> {
		const llm = this.buildModel();
		const prompt = [
			{
				role: "system",
				content:
					"Tu es un assistant qui synthétise un tableau de bord. Rédige un court paragraphe (80-120 mots), sans puces, ni liste, ni chiffres exacts. " +
					"Explique l'état général, les tendances, les zones de tension, les acteurs ou ressources les plus sollicités, et des pistes d'action. " +
					'Ne répète pas les valeurs des KPI, parle qualitativement ("forte activité", "peu de participation", "concentration sur...", "manque de clarté"), ' +
					"et n'invente pas de données absentes. Réponds dans la langue demandée.",
			},
			{
				role: "user",
				content: `Langue: ${language}\nSection: ${section}\nDonnées:\n${JSON.stringify(payload)}`,
			},
		];
		const res = await llm.invoke(prompt as any);
		const content = (res as any)?.content;
		if (typeof content === "string") return content;
		if (Array.isArray(content)) {
			return content
				.map((c: any) =>
					typeof c?.text === "string" ? c.text : typeof c === "string" ? c : ""
				)
				.join("");
		}
		return "Résumé indisponible.";
	}
}
