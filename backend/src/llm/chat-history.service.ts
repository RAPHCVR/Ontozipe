import { Injectable, NotFoundException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { randomUUID } from "crypto";
import { escapeSparqlLiteral } from "../utils/sparql.utils";

export interface ChatSessionSummary {
	id: string;
	iri: string;
	title: string;
	ontologyIri?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface ChatMessageRecord {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	agentSteps?: string;
	createdAt?: string;
	index: number;
}

export interface AppendMessageInput {
	role: "user" | "assistant" | "system";
	content: string;
	agentSteps?: string;
}

interface SessionLookupResult {
	iri: string;
	title: string;
	ontologyIri?: string;
	createdAt?: string;
	updatedAt?: string;
	exists: boolean;
}

@Injectable()
export class ChatHistoryService {
	private readonly fusekiBase = (
		process.env.FUSEKI_URL ?? "http://localhost:3030/autonomy"
	).replace(/\/$/, "");
	private readonly sparqlEndpoint = `${this.fusekiBase}/sparql`;
	private readonly updateEndpoint = `${this.fusekiBase}/update`;
	private readonly CORE = "http://example.org/core#";
	private readonly XSD = "http://www.w3.org/2001/XMLSchema#";
	private readonly CHAT_NAMESPACE = "http://example.org/chat/";
	private readonly CHAT_GRAPH = `${this.fusekiBase}#chat-history`;
	private readonly DEFAULT_TITLE = "Nouvelle conversation";
	private readonly adminAuth = {
		username: process.env.FUSEKI_USER || "admin",
		password: process.env.FUSEKI_PASSWORD || "Pass123",
	};

	constructor(private readonly http: HttpService) {}

	private sanitizeSessionId(sessionId: string): string {
		const trimmed = sessionId.trim();
		if (!/^[A-Za-z0-9\-_]+$/.test(trimmed)) {
			throw new NotFoundException("Invalid session identifier");
		}
		return trimmed;
	}

	private buildSessionIri(sessionId: string): string {
		return `${this.CHAT_NAMESPACE}s/${sessionId}`;
	}

	private buildMessageIri(): string {
		return `${this.CHAT_NAMESPACE}m/${randomUUID()}`;
	}

	private async runSelect(query: string): Promise<any> {
		const params = new URLSearchParams({
			query,
			format: "application/sparql-results+json",
		});
		const { data } = await lastValueFrom(
			this.http.get(this.sparqlEndpoint, { params })
		);
		return data;
	}

	private async runUpdate(update: string): Promise<void> {
		await lastValueFrom(
			this.http.post(this.updateEndpoint, new URLSearchParams({ update }), {
				auth: this.adminAuth,
			})
		);
	}

	private async lookupSession(
		userIri: string,
		sessionId: string
	): Promise<SessionLookupResult | null> {
		const safeId = this.sanitizeSessionId(sessionId);
		const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            SELECT ?session ?title ?onto ?created ?updated WHERE {
              GRAPH <${this.CHAT_GRAPH}> {
                ?session a core:ChatSession ;
                         core:sessionId "${escapeSparqlLiteral(safeId)}" ;
                         core:createdBy <${userIri}> .
                OPTIONAL { ?session core:sessionTitle ?title }
                OPTIONAL { ?session core:sessionForOntology ?onto }
                OPTIONAL { ?session core:createdAt ?created }
                OPTIONAL { ?session core:updatedAt ?updated }
              }
            }
            LIMIT 1
        `);
		const binding = data.results?.bindings?.[0];
		if (!binding) {
			return null;
		}
		return {
			iri: binding.session.value,
			title: binding.title?.value ?? this.DEFAULT_TITLE,
			ontologyIri: binding.onto?.value,
			createdAt: binding.created?.value,
			updatedAt: binding.updated?.value,
			exists: true,
		};
	}

	private async createSessionInternal(
		userIri: string,
		sessionId: string,
		title?: string,
		ontologyIri?: string
	): Promise<SessionLookupResult> {
		const safeId = this.sanitizeSessionId(sessionId);
		const now = new Date().toISOString();
		const iri = this.buildSessionIri(safeId);
		const finalTitle =
			(title ?? this.DEFAULT_TITLE).trim() || this.DEFAULT_TITLE;

		let triples = `<${iri}> a core:ChatSession ;
            core:sessionId "${escapeSparqlLiteral(safeId)}" ;
            core:sessionTitle "${escapeSparqlLiteral(finalTitle)}" ;
            core:createdBy <${userIri}> ;
            core:updatedBy <${userIri}> ;
            core:createdAt "${now}"^^xsd:dateTime ;
            core:updatedAt "${now}"^^xsd:dateTime .\n`;
		if (ontologyIri) {
			triples += `<${iri}> core:sessionForOntology <${ontologyIri}> .\n`;
		}
		triples += `<${userIri}> core:hasChatSession <${iri}> .\n`;

		const update = `
            PREFIX core: <${this.CORE}>
            PREFIX xsd:  <${this.XSD}>
            INSERT DATA { GRAPH <${this.CHAT_GRAPH}> { ${triples} } }
        `;
		await this.runUpdate(update);
		return {
			iri,
			title: finalTitle,
			ontologyIri,
			createdAt: now,
			updatedAt: now,
			exists: true,
		};
	}

	public async ensureSession(
		userIri: string,
		sessionId: string,
		params?: { title?: string; ontologyIri?: string }
	): Promise<SessionLookupResult> {
		const existing = await this.lookupSession(userIri, sessionId);
		if (existing) {
			if (params?.ontologyIri && params.ontologyIri !== existing.ontologyIri) {
				await this.setSessionOntology(existing.iri, params.ontologyIri);
				existing.ontologyIri = params.ontologyIri;
			}
			return existing;
		}
		return this.createSessionInternal(
			userIri,
			sessionId,
			params?.title,
			params?.ontologyIri
		);
	}

	public async createSession(
		userIri: string,
		params?: { title?: string; ontologyIri?: string }
	): Promise<ChatSessionSummary> {
		const newId = randomUUID();
		const session = await this.createSessionInternal(
			userIri,
			newId,
			params?.title,
			params?.ontologyIri
		);
		return {
			id: newId,
			iri: session.iri,
			title: session.title,
			ontologyIri: session.ontologyIri,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
		};
	}

	public async listSessions(
		userIri: string,
		ontologyIri?: string
	): Promise<ChatSessionSummary[]> {
		const filterClause = ontologyIri
			? `FILTER EXISTS { ?session core:sessionForOntology <${ontologyIri}> }`
			: "";
		const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            SELECT ?session ?sid ?title ?onto ?created ?updated WHERE {
              GRAPH <${this.CHAT_GRAPH}> {
                <${userIri}> core:hasChatSession ?session .
                ?session a core:ChatSession ;
                         core:sessionId ?sid ;
                         core:createdBy <${userIri}> .
                OPTIONAL { ?session core:sessionTitle ?title }
                OPTIONAL { ?session core:sessionForOntology ?onto }
                OPTIONAL { ?session core:createdAt ?created }
                OPTIONAL { ?session core:updatedAt ?updated }
                ${filterClause}
              }
            }
            ORDER BY DESC(?updated) DESC(?created)
        `);

		return (data.results?.bindings ?? []).map((binding: any) => ({
			id: binding.sid.value,
			iri: binding.session.value,
			title: binding.title?.value ?? this.DEFAULT_TITLE,
			ontologyIri: binding.onto?.value ?? undefined,
			createdAt: binding.created?.value,
			updatedAt: binding.updated?.value,
		}));
	}

	public async renameSession(
		userIri: string,
		sessionId: string,
		title: string
	): Promise<void> {
		const session = await this.lookupSession(userIri, sessionId);
		if (!session) {
			throw new NotFoundException("Session not found");
		}
		const cleanTitle = title.trim() || this.DEFAULT_TITLE;
		const now = new Date().toISOString();
		const update = `
            PREFIX core: <${this.CORE}>
            DELETE { GRAPH <${this.CHAT_GRAPH}> { <${session.iri}> core:sessionTitle ?t . } }
            INSERT { GRAPH <${this.CHAT_GRAPH}> { <${session.iri}> core:sessionTitle "${escapeSparqlLiteral(cleanTitle)}" . } }
            WHERE  { OPTIONAL { GRAPH <${this.CHAT_GRAPH}> { <${session.iri}> core:sessionTitle ?t . } } }
        `;
		await this.runUpdate(update);
		const metadataUpdate = `
            PREFIX core: <${this.CORE}>
            PREFIX xsd:  <${this.XSD}>
            DELETE {
              GRAPH <${this.CHAT_GRAPH}> {
                <${session.iri}> core:updatedAt ?oldUpdated .
                <${session.iri}> core:updatedBy ?oldUpdater .
              }
            }
            INSERT {
              GRAPH <${this.CHAT_GRAPH}> {
                <${session.iri}> core:updatedAt "${now}"^^xsd:dateTime ;
                                  core:updatedBy <${userIri}> .
              }
            }
            WHERE {
              GRAPH <${this.CHAT_GRAPH}> {
                OPTIONAL { <${session.iri}> core:updatedAt ?oldUpdated . }
                OPTIONAL { <${session.iri}> core:updatedBy ?oldUpdater . }
              }
            }
        `;
		await this.runUpdate(metadataUpdate);
	}

	public async deleteSession(
		userIri: string,
		sessionId: string
	): Promise<void> {
		const session = await this.lookupSession(userIri, sessionId);
		if (!session) {
			throw new NotFoundException("Session not found");
		}
		const update = `
            PREFIX core: <${this.CORE}>
            DELETE {
              GRAPH <${this.CHAT_GRAPH}> {
                <${userIri}> core:hasChatSession <${session.iri}> .
                <${session.iri}> ?p ?o .
                ?m ?mp ?mo .
              }
            }
            WHERE {
              GRAPH <${this.CHAT_GRAPH}> {
                <${userIri}> core:hasChatSession <${session.iri}> .
                <${session.iri}> ?p ?o .
                OPTIONAL {
                  ?m core:belongsToSession <${session.iri}> ;
                     ?mp ?mo .
                }
              }
            }
        `;
		await this.runUpdate(update);
	}

	public async getMessages(
		userIri: string,
		sessionId: string
	): Promise<ChatMessageRecord[]> {
		const session = await this.lookupSession(userIri, sessionId);
		if (!session) {
			throw new NotFoundException("Session not found");
		}
		const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            PREFIX xsd:  <${this.XSD}>
            SELECT ?msg ?role ?content ?idx ?created ?agent WHERE {
              GRAPH <${this.CHAT_GRAPH}> {
                ?msg a core:ChatMessage ;
                     core:belongsToSession <${session.iri}> ;
                     core:messageRole ?role ;
                     core:messageContent ?content ;
                     core:messageIndex ?idx .
                OPTIONAL { ?msg core:createdAt ?created }
                OPTIONAL { ?msg core:agentSteps ?agent }
              }
            }
            ORDER BY ASC(xsd:integer(?idx))
        `);

		return (data.results?.bindings ?? []).map((binding: any) => ({
			id: binding.msg.value,
			role: binding.role.value as ChatMessageRecord["role"],
			content: binding.content.value,
			agentSteps: binding.agent?.value,
			createdAt: binding.created?.value,
			index: Number(binding.idx.value),
		}));
	}

	private async getNextMessageIndex(sessionIri: string): Promise<number> {
		const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            SELECT (MAX(?idx) AS ?maxIdx) WHERE {
              GRAPH <${this.CHAT_GRAPH}> {
                ?msg core:belongsToSession <${sessionIri}> ;
                     core:messageIndex ?idx .
              }
            }
        `);
		const raw = data.results?.bindings?.[0]?.maxIdx?.value;
		if (raw === undefined) return 0;
		const parsed = Number(raw);
		return Number.isFinite(parsed) ? parsed + 1 : 0;
	}

	private truncateTitleFromMessage(content: string): string {
		const normalized = content.replace(/\s+/g, " ").trim();
		if (!normalized) return this.DEFAULT_TITLE;
		return normalized.length > 80 ? `${normalized.slice(0, 77)}…` : normalized;
	}

	private async setSessionOntology(
		sessionIri: string,
		ontologyIri: string
	): Promise<void> {
		const update = `
            PREFIX core: <${this.CORE}>
            DELETE { GRAPH <${this.CHAT_GRAPH}> { <${sessionIri}> core:sessionForOntology ?onto . } }
            INSERT { GRAPH <${this.CHAT_GRAPH}> { <${sessionIri}> core:sessionForOntology <${ontologyIri}> . } }
            WHERE  { OPTIONAL { GRAPH <${this.CHAT_GRAPH}> { <${sessionIri}> core:sessionForOntology ?onto . } } }
        `;
		await this.runUpdate(update);
	}

	public async appendMessages(
		userIri: string,
		sessionId: string,
		messages: AppendMessageInput[],
		options?: { ontologyIri?: string }
	): Promise<void> {
		if (!messages.length) return;
		const session = await this.ensureSession(userIri, sessionId, {
			ontologyIri: options?.ontologyIri,
		});
		const nextIndex = await this.getNextMessageIndex(session.iri);
		const now = new Date().toISOString();

		const triples: string[] = [];
		let offset = 0;
		let shouldUpdateTitle = false;
		let newTitleCandidate: string | null = null;

		for (const entry of messages) {
			const messageIri = this.buildMessageIri();
			const currentIndex = nextIndex + offset;
			offset += 1;
			let messageTriples = `<${messageIri}> a core:ChatMessage ;
                core:belongsToSession <${session.iri}> ;
                core:messageRole "${entry.role}" ;
                core:messageIndex "${currentIndex}"^^xsd:integer ;
                core:messageContent """${escapeSparqlLiteral(entry.content)}""" ;
                core:createdAt "${now}"^^xsd:dateTime ;
                core:createdBy <${userIri}> .\n`;
			if (entry.agentSteps) {
				messageTriples += `<${messageIri}> core:agentSteps """${escapeSparqlLiteral(entry.agentSteps)}""" .\n`;
			}
			messageTriples += `<${session.iri}> core:hasChatMessage <${messageIri}> .\n`;
			triples.push(messageTriples);

			if (
				entry.role === "user" &&
				(!session.title || session.title === this.DEFAULT_TITLE)
			) {
				shouldUpdateTitle = true;
				newTitleCandidate ??= this.truncateTitleFromMessage(entry.content);
			}
		}

		const insertUpdate = `
            PREFIX core: <${this.CORE}>
            PREFIX xsd:  <${this.XSD}>
            INSERT DATA { GRAPH <${this.CHAT_GRAPH}> { ${triples.join("\n")} } }
        `;
		await this.runUpdate(insertUpdate);

		const metadataUpdate = `
            PREFIX core: <${this.CORE}>
            PREFIX xsd:  <${this.XSD}>
            DELETE {
              GRAPH <${this.CHAT_GRAPH}> {
                <${session.iri}> core:updatedAt ?oldUpdated .
                <${session.iri}> core:updatedBy ?oldUpdater .
              }
            }
            INSERT {
              GRAPH <${this.CHAT_GRAPH}> {
                <${session.iri}> core:updatedAt "${now}"^^xsd:dateTime ;
                                  core:updatedBy <${userIri}> .
              }
            }
            WHERE {
              GRAPH <${this.CHAT_GRAPH}> {
                OPTIONAL { <${session.iri}> core:updatedAt ?oldUpdated . }
                OPTIONAL { <${session.iri}> core:updatedBy ?oldUpdater . }
              }
            }
        `;
		await this.runUpdate(metadataUpdate);

		if (shouldUpdateTitle && newTitleCandidate) {
			await this.renameSession(userIri, sessionId, newTitleCandidate);
		}
	}
}
