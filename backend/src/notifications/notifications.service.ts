import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { randomUUID } from "crypto";
import { escapeSparqlLiteral } from "../utils/sparql.utils";

const CORE = "http://example.org/core#";
const FOAF = "http://xmlns.com/foaf/0.1/";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const XSD = "http://www.w3.org/2001/XMLSchema#";

type CreateNotificationInput = {
	recipient: string;
	content: string;
	actor?: string;
	verb?: string;
	target?: string;
	link?: string;
	isRead?: boolean;
	createdAt?: string;
	id?: string;
};

type ListOptions = {
	status?: "all" | "unread";
	limit?: number;
	offset?: number;
	verb?: string;
};

type NotificationRow = {
	iri: string;
	content: string;
	createdAt: string;
	isRead: boolean;
	actor?: { iri: string; name?: string };
	target?: { iri: string; label?: string };
	verb?: string;
	link?: string | null;
};

@Injectable()
export class NotificationsService {
	private readonly fusekiBase = (
		process.env.FUSEKI_URL ?? "http://localhost:3030/autonomy"
	).replace(/\/$/, "");
	private readonly fusekiUrl = `${this.fusekiBase}/sparql`;
	private readonly fusekiUpdateUrl = `${this.fusekiBase}/update`;
	private readonly graph = `${this.fusekiBase}#notifications`;
	private readonly auth = {
		username: process.env.FUSEKI_USER || "admin",
		password: process.env.FUSEKI_PASSWORD || "Pass123",
	};
	private readonly logger = new Logger(NotificationsService.name);

	constructor(private readonly http: HttpService) {}

	private async runSelect(query: string) {
		const params = new URLSearchParams({
			query,
			format: "application/sparql-results+json",
		});
		const { data } = await lastValueFrom(
			this.http.get(this.fusekiUrl, { params })
		);
		return data;
	}

	private async runUpdate(update: string) {
		await lastValueFrom(
			this.http.post(this.fusekiUpdateUrl, new URLSearchParams({ update }), {
				auth: this.auth,
			})
		);
	}

	private newNotificationIri(id?: string) {
		const suffix = id ?? randomUUID();
		return `http://example.org/notification/${suffix}`;
	}

	private truncate(text: string, max = 160) {
		if (!text) return "";
		if (text.length <= max) return text;
		return text.slice(0, max - 1).trimEnd() + "…";
	}

	private async getUserDisplayName(userIri: string): Promise<string> {
		const query = `
      PREFIX foaf: <${FOAF}>
      PREFIX core: <${CORE}>
      SELECT ?name ?email WHERE {
        OPTIONAL { <${userIri}> foaf:name ?name }
        OPTIONAL { <${userIri}> core:email ?email }
      } LIMIT 1
    `;
		const data = await this.runSelect(query);
		const row = data?.results?.bindings?.[0];
		const name = row?.name?.value?.trim();
		const email = row?.email?.value?.trim();
		if (name) return name;
		if (email) return email;
		return userIri.split("/").pop() || userIri;
	}

	private async getResourceLabel(
		resourceIri: string
	): Promise<string | undefined> {
		const query = `
      PREFIX rdfs: <${RDFS}>
      SELECT ?lbl WHERE { <${resourceIri}> rdfs:label ?lbl } LIMIT 1
    `;
		const data = await this.runSelect(query);
		return data?.results?.bindings?.[0]?.lbl?.value;
	}

	private buildLink(target?: string, fallback?: string) {
		if (fallback) return fallback;
		if (!target) return undefined;
		return target;
	}

	async createNotification({
		recipient,
		actor,
		verb,
		target,
		link,
		content,
		isRead = false,
		createdAt,
		id,
	}: CreateNotificationInput): Promise<string> {
		const iri = this.newNotificationIri(id);
		const now = createdAt ?? new Date().toISOString();

		const triples: string[] = [
			`<${iri}> a <${CORE}Notification> ;`,
			`  <${CORE}recipient> <${recipient}> ;`,
			`  <${CORE}content> """${escapeSparqlLiteral(content)}""" ;`,
			`  <${CORE}createdAt> "${now}"^^<${XSD}dateTime> ;`,
			`  <${CORE}isRead> ${isRead ? "true" : "false"} .`,
		];

		if (actor) {
			triples.splice(triples.length - 1, 0, `  <${CORE}actor> <${actor}> ;`);
		}
		if (verb) {
			triples.splice(triples.length - 1, 0, `  <${CORE}verb> <${verb}> ;`);
		}
		if (target) {
			triples.splice(triples.length - 1, 0, `  <${CORE}target> <${target}> ;`);
		}
		if (link) {
			const escapedLink = escapeSparqlLiteral(link);
			triples.splice(
				triples.length - 1,
				0,
				`  <${CORE}link> "${escapedLink}"^^<${XSD}anyURI> ;`
			);
		}

		const update = `
      PREFIX core: <${CORE}>
      PREFIX xsd:  <${XSD}>
      INSERT DATA { GRAPH <${this.graph}> { ${triples.join("\n")} } }
    `;
		await this.runUpdate(update);
		return iri;
	}

	async listForUser(
		userIri: string,
		options: ListOptions = {}
	): Promise<{
		items: NotificationRow[];
		total: number;
		unreadCount: number;
		limit: number;
		offset: number;
	}> {
		const status = options.status ?? "all";
		const limit = Math.max(1, Math.min(100, options.limit ?? 20));
		const offset = Math.max(0, options.offset ?? 0);
		const verbFilter = options.verb ? `FILTER(?verb = <${options.verb}>)` : "";
		const statusFilter =
			status === "unread"
				? `FILTER(!BOUND(?isRead) || lcase(str(?isRead)) = "false" || str(?isRead) = "0")`
				: "";

		const query = `
      PREFIX core: <${CORE}>
      PREFIX foaf: <${FOAF}>
      PREFIX rdfs: <${RDFS}>
      SELECT ?notif ?content ?createdAt
             (SAMPLE(?isReadRaw) AS ?isRead)
             (SAMPLE(?actorRaw) AS ?actor)
             (SAMPLE(?actorNameRaw) AS ?actorName)
             (SAMPLE(?targetRaw) AS ?target)
             (SAMPLE(?targetLabelRaw) AS ?targetLabel)
             (SAMPLE(?verbRaw) AS ?verb)
             (SAMPLE(?linkRaw) AS ?link)
      WHERE {
        GRAPH <${this.graph}> {
          ?notif a core:Notification ;
                 core:recipient <${userIri}> ;
                 core:content ?content ;
                 core:createdAt ?createdAt .
          OPTIONAL { ?notif core:isRead ?isReadRaw }
          OPTIONAL { ?notif core:actor ?actorRaw }
          OPTIONAL { ?notif core:target ?targetRaw }
          OPTIONAL { ?notif core:verb ?verbRaw }
          OPTIONAL { ?notif core:link ?linkRaw }
        }
        OPTIONAL { ?actorRaw foaf:name ?actorNameRaw }
        OPTIONAL { ?targetRaw rdfs:label ?targetLabelRaw }
        ${statusFilter}
        ${verbFilter}
      }
      GROUP BY ?notif ?content ?createdAt
      ORDER BY DESC(?createdAt)
      LIMIT ${limit}
      OFFSET ${offset}
    `;
		const data = await this.runSelect(query);
		const items: NotificationRow[] = (data?.results?.bindings ?? []).map(
			(row: any) => ({
				iri: row.notif.value,
				content: row.content?.value ?? "",
				createdAt: row.createdAt?.value ?? "",
				isRead:
					row.isRead?.value === "true" ||
					row.isRead?.value === "1" ||
					row.isRead?.value === true,
				actor: row.actor?.value
					? { iri: row.actor.value, name: row.actorName?.value }
					: undefined,
				target: row.target?.value
					? { iri: row.target.value, label: row.targetLabel?.value }
					: undefined,
				verb: row.verb?.value,
				link: row.link?.value ?? null,
			})
		);

		const total = await this.countForUser(userIri, status, options.verb);
		const unreadCount = await this.getUnreadCountForUser(userIri);
		return { items, total, unreadCount, limit, offset };
	}

	private async countForUser(
		userIri: string,
		status: "all" | "unread",
		verb?: string
	): Promise<number> {
		const statusFilter =
			status === "unread"
				? `FILTER(!BOUND(?isRead) || lcase(str(?isRead)) = "false" || str(?isRead) = "0")`
				: "";
		const verbFilter = verb ? `FILTER(?verb = <${verb}>)` : "";
		const query = `
      PREFIX core: <${CORE}>
      SELECT (COUNT(?notif) AS ?total) WHERE {
        GRAPH <${this.graph}> {
          ?notif a core:Notification ;
                 core:recipient <${userIri}> .
          OPTIONAL { ?notif core:isRead ?isRead }
          OPTIONAL { ?notif core:verb ?verb }
          ${statusFilter}
          ${verbFilter}
        }
      }
    `;
		const data = await this.runSelect(query);
		const value = data?.results?.bindings?.[0]?.total?.value;
		return Number(value ?? 0);
	}

	async getUnreadCountForUser(userIri: string): Promise<number> {
		const query = `
      PREFIX core: <${CORE}>
      SELECT (COUNT(?notif) AS ?total) WHERE {
        GRAPH <${this.graph}> {
          ?notif a core:Notification ;
                 core:recipient <${userIri}> .
          OPTIONAL { ?notif core:isRead ?isRead }
          FILTER(!BOUND(?isRead) || lcase(str(?isRead)) = "false" || str(?isRead) = "0")
        }
      }
    `;
		const data = await this.runSelect(query);
		const value = data?.results?.bindings?.[0]?.total?.value;
		return Number(value ?? 0);
	}

	async markAsRead(userIri: string, notifIri: string) {
		const update = `
      PREFIX core: <${CORE}>
      WITH <${this.graph}>
      DELETE { <${notifIri}> core:isRead ?r . }
      INSERT { <${notifIri}> core:isRead true . }
      WHERE  { <${notifIri}> core:recipient <${userIri}> . OPTIONAL { <${notifIri}> core:isRead ?r } }
    `;
		await this.runUpdate(update);
	}

	async markAllAsRead(userIri: string) {
		const update = `
      PREFIX core: <${CORE}>
      WITH <${this.graph}>
      DELETE { ?n core:isRead ?r . }
      INSERT { ?n core:isRead true . }
      WHERE  {
        ?n a core:Notification ;
           core:recipient <${userIri}> .
        OPTIONAL { ?n core:isRead ?r }
      }
    `;
		await this.runUpdate(update);
	}

	async deleteForUser(userIri: string, notifIri: string) {
		const update = `
      WITH <${this.graph}>
      DELETE { <${notifIri}> ?p ?o . }
      WHERE  {
        <${notifIri}> ?p ?o .
        FILTER EXISTS { <${notifIri}> <${CORE}recipient> <${userIri}> }
      }
    `;
		await this.runUpdate(update);
	}

	async notifyComment(params: {
		actorIri: string;
		resourceIri: string;
		ontologyIri: string;
		body: string;
	}) {
		const { actorIri, resourceIri, ontologyIri, body } = params;
		const recipient = await this.findResourceCreator(resourceIri, ontologyIri);
		if (!recipient || recipient === actorIri) return;
		const actorName = await this.getUserDisplayName(actorIri);
		const resourceLabel =
			(await this.getResourceLabel(resourceIri)) || "ressource";
		const content = `${actorName} a commenté l'élément ${resourceLabel} : ${this.truncate(body)}`;
		const link = `/ontology?iri=${encodeURIComponent(
			ontologyIri
		)}#${encodeURIComponent(resourceIri)}`;
		const verb = `${CORE}Commented`;
		const hasRecent = await this.hasRecentNotification(
			recipient,
			verb,
			2,
			resourceIri
		);
		if (hasRecent) return;
		await this.deleteNotificationsByVerbAndTarget(recipient, verb, resourceIri);
		await this.createNotification({
			recipient,
			actor: actorIri,
			verb,
			target: resourceIri,
			link,
			content,
		});
	}

	async notifyGroupMembershipChange(params: {
		actorIri: string;
		memberIri: string;
		groupIri: string;
		action: "add" | "remove";
	}) {
		const { actorIri, memberIri, groupIri, action } = params;
		if (actorIri === memberIri) return;
		const actorName = await this.getUserDisplayName(actorIri);
		const groupLabel = (await this.getResourceLabel(groupIri)) || "groupe";
		const verb =
			action === "add" ? `${CORE}AddedToGroup` : `${CORE}RemovedFromGroup`;
		const content =
			action === "add"
				? `Vous avez été ajouté(e) au groupe ${groupLabel} par ${actorName}`
				: `Vous avez été retiré(e) du groupe ${groupLabel} par ${actorName}`;
		const hasRecent = await this.hasRecentNotification(
			memberIri,
			verb,
			2,
			groupIri
		);
		if (hasRecent) return;
		await this.deleteNotificationsByVerbAndTarget(memberIri, verb, groupIri);
		await this.createNotification({
			recipient: memberIri,
			actor: actorIri,
			verb,
			target: groupIri,
			link: `/groups`,
			content,
		});
	}

	async notifyOrganizationMembershipChange(params: {
		actorIri: string;
		memberIri: string;
		organizationIri: string;
		action: "add" | "remove";
	}) {
		const { actorIri, memberIri, organizationIri, action } = params;
		if (actorIri === memberIri) return;
		const actorName = await this.getUserDisplayName(actorIri);
		const orgLabel =
			(await this.getResourceLabel(organizationIri)) || "organisation";
		const verb =
			action === "add"
				? `${CORE}AddedToOrganization`
				: `${CORE}RemovedFromOrganization`;
		const content =
			action === "add"
				? `Vous avez été ajouté(e) à l'organisation ${orgLabel} par ${actorName}`
				: `Vous avez été retiré(e) de l'organisation ${orgLabel} par ${actorName}`;
		const hasRecent = await this.hasRecentNotification(
			memberIri,
			verb,
			2,
			organizationIri
		);
		if (hasRecent) return;
		await this.deleteNotificationsByVerbAndTarget(
			memberIri,
			verb,
			organizationIri
		);
		await this.createNotification({
			recipient: memberIri,
			actor: actorIri,
			verb,
			target: organizationIri,
			link: `/organisations`,
			content,
		});
	}

	async notifyRolesUpdated(params: {
		actorIri: string;
		userIri: string;
		roles: string[];
	}) {
		const { actorIri, userIri, roles } = params;
		const actorName = await this.getUserDisplayName(actorIri);
		const rolesText =
			roles.length > 0
				? roles.map((r) => r.split("#").pop()).join(", ")
				: "aucun";
		const content = `Vos rôles ont été mis à jour par ${actorName} : ${rolesText}`;
		// Si une notif récente du même type existe déjà pour cet utilisateur, ne pas dupliquer
		const verb = `${CORE}RolesUpdated`;
		const hasRecent = await this.hasRecentNotification(userIri, verb, 2);
		if (hasRecent) return;
		// Nettoyer les anciennes notifications de rôles pour éviter les doublons accumulés
		await this.deleteNotificationsByVerb(userIri, verb);
		await this.createNotification({
			recipient: userIri,
			actor: actorIri,
			verb,
			content,
			link: "/profile",
		});
	}

	async notifyUserRegistered(params: {
		userIri: string;
		email?: string | null;
		name?: string | null;
	}) {
		const { userIri, email, name } = params;
		const superAdmins = Array.from(new Set(await this.getSuperAdmins()));
		if (superAdmins.length === 0) return;
		const label =
			name?.trim() ||
			email?.trim() ||
			userIri.split("/").pop() ||
			"Nouveau compte";
		const content = `Nouvelle inscription à valider : ${label}`;

		for (const recipient of superAdmins) {
			const verb = `${CORE}UserRegistered`;
			const hasRecent = await this.hasRecentNotification(
				recipient,
				verb,
				5,
				userIri
			);
			if (hasRecent) continue;
			await this.deleteNotificationsByVerbAndTarget(recipient, verb, userIri);
			try {
				await this.createNotification({
					recipient,
					actor: userIri,
					verb,
					content,
					link: "/admin/users",
				});
			} catch (error) {
				this.logger.warn(
					`notifyUserRegistered failed for ${recipient}: ${error}`
				);
			}
		}
	}

	private async hasSimilarNotification(params: {
		recipient: string;
		actor?: string;
		verb?: string;
	}): Promise<boolean> {
		const { recipient, actor, verb } = params;
		const filters: string[] = [`?n core:recipient <${recipient}>`];
		if (actor) filters.push(`?n core:actor <${actor}>`);
		if (verb) filters.push(`?n core:verb <${verb}>`);
		const filterBlock = filters.join(" ;\n           ");
		const query = `
      PREFIX core: <${CORE}>
      ASK {
        GRAPH <${this.graph}> {
          ?n a core:Notification ;
             ${filterBlock} .
        }
      }
    `;
		return this.runSelect(query).then((data) => Boolean(data?.boolean));
	}

	private async deleteNotificationsByVerb(recipient: string, verb: string) {
		const update = `
      PREFIX core: <${CORE}>
      WITH <${this.graph}>
      DELETE { ?n ?p ?o }
      WHERE {
        ?n a core:Notification ;
           core:recipient <${recipient}> ;
           core:verb <${verb}> ;
           ?p ?o .
      }
    `;
		await this.runUpdate(update);
	}

	private async deleteNotificationsByVerbAndTarget(
		recipient: string,
		verb: string,
		target?: string
	) {
		const targetFilter = target ? `FILTER(?target = <${target}>)` : "";
		const update = `
      PREFIX core: <${CORE}>
      WITH <${this.graph}>
      DELETE { ?n ?p ?o }
      WHERE {
        ?n a core:Notification ;
           core:recipient <${recipient}> ;
           core:verb <${verb}> ;
           ?p ?o .
        OPTIONAL { ?n core:target ?target }
        ${targetFilter}
      }
    `;
		await this.runUpdate(update);
	}

	private async hasRecentNotification(
		recipient: string,
		verb: string,
		windowMinutes = 2,
		target?: string
	): Promise<boolean> {
		const targetFilter = target ? `?n core:target <${target}> .` : "";
		const query = `
      PREFIX core: <${CORE}>
      PREFIX xsd:  <${XSD}>
      ASK {
        GRAPH <${this.graph}> {
          ?n a core:Notification ;
             core:recipient <${recipient}> ;
             core:verb <${verb}> ;
             core:createdAt ?createdAt .
          ${targetFilter}
          FILTER(?createdAt >= (NOW() - "${windowMinutes}M"^^xsd:dayTimeDuration))
        }
      }
    `;
		const data = await this.runSelect(query);
		return Boolean(data?.boolean);
	}

	async notifyOntologyAccessGranted(params: {
		actorIri: string;
		ontologyIri: string;
		groupIris: string[];
	}) {
		const { actorIri, ontologyIri, groupIris } = params;
		if (!groupIris || groupIris.length === 0) return;
		const actorName = await this.getUserDisplayName(actorIri);
		const ontologyLabel =
			(await this.getResourceLabel(ontologyIri)) || "ontologie";
		const members = await this.getMembersOfGroups(groupIris);
		const uniqueRecipients = Array.from(
			new Set(members.filter((m) => m !== actorIri))
		);
		await Promise.all(
			uniqueRecipients.map(async (recipient) => {
				const verb = `${CORE}OntologyAccessGranted`;
				const hasRecent = await this.hasRecentNotification(
					recipient,
					verb,
					2,
					ontologyIri
				);
				if (hasRecent) return;
				await this.deleteNotificationsByVerbAndTarget(
					recipient,
					verb,
					ontologyIri
				);
				try {
					await this.createNotification({
						recipient,
						actor: actorIri,
						verb,
						target: ontologyIri,
						link: `/ontology?iri=${encodeURIComponent(ontologyIri)}`,
						content: `${actorName} a rendu l'ontologie ${ontologyLabel} accessible à votre groupe`,
					});
				} catch (error) {
					this.logger.warn(
						`notifyOntologyAccessGranted failed for ${recipient}: ${error}`
					);
				}
			})
		);
	}

	private async findResourceCreator(
		resourceIri: string,
		graphIri: string
	): Promise<string | null> {
		const query = `
      PREFIX core: <${CORE}>
      SELECT ?creator WHERE { GRAPH <${graphIri}> { <${resourceIri}> core:createdBy ?creator } } LIMIT 1
    `;
		const data = await this.runSelect(query);
		return data?.results?.bindings?.[0]?.creator?.value ?? null;
	}

	private async getSuperAdmins(): Promise<string[]> {
		const query = `
      PREFIX core: <${CORE}>
      SELECT ?u WHERE { ?u core:hasRole <${CORE}SuperAdminRole> }
    `;
		const data = await this.runSelect(query);
		return (data?.results?.bindings ?? []).map((b: any) => b.u.value);
	}

	private async getMembersOfGroups(groupIris: string[]): Promise<string[]> {
		if (groupIris.length === 0) return [];
		const groups = groupIris.map((g) => `<${g}>`).join(" ");
		const query = `
      PREFIX core: <${CORE}>
      SELECT DISTINCT ?u WHERE {
        VALUES ?g { ${groups} }
        { ?g core:hasMember ?u }
        UNION { GRAPH ?ng { ?g core:hasMember ?u } }
      }
    `;
		const data = await this.runSelect(query);
		return (data?.results?.bindings ?? []).map((b: any) => b.u.value);
	}
}
