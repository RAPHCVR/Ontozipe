import axios from "axios";

export interface Property {
	predicate: string;
	predicateLabel?: string;
	value: string;
	valueLabel?: string;
	isLiteral: boolean;
}

export interface IndividualNode {
	id: string;
	label: string;
	classId: string;
	properties: Property[];
	children: IndividualNode[];

	/** Méta‑données */
	createdBy?: string;
	createdAt?: string; // xsd:dateTime ISO
	updatedBy?: string;
	updatedAt?: string;
	visibleTo?: string[]; // liste des groupes core:visibleTo
	groups?: { iri: string; label?: string }[];
}

/** Commentaire attaché à une ressource (core:Comment) */
export interface CommentNode {
	id: string;
	body: string; // texte du commentaire
	onResource: string; // IRI de l’individu ou ressource ciblée
	replyTo?: string; // IRI du commentaire parent (optionnel)

	/** Méta‑données */
	createdBy: string;
	createdAt: string;
	updatedBy?: string;
	updatedAt?: string;
	visibleTo?: string[];
}

/**
 * Convert JS value to Turtle term.
 * If `isLiteral` true → multiline‑safe string literal.
 * Otherwise treat as IRI (<…>).
 */
function toRDF(value: string, isLiteral: boolean): string {
    return isLiteral
        ? `"""${value.replace(/"/g, '\\"')}"""`
        : `<${value}>`;
}

import { Injectable, ForbiddenException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";

export interface NodeData {
	id: string;
	label: string | undefined;
	title: string;
}
export interface EdgeData {
	from: string;
	to: string;
}
export interface Individual {
	id: string;
	label: string;
	classId: string;
}

export interface FullSnapshot {
    graph: { nodes: NodeData[]; edges: EdgeData[] };
    individuals: IndividualNode[];
    persons: IndividualNode[];
}

/** Group descriptor returned by getGroups() */
export interface GroupInfo {
    iri: string;
    label?: string;
    createdBy: string;
    members: string[];
    organizationIri?: string;
}

/** Organization descriptor */
export interface OrganizationInfo {
	iri: string;
	label?: string;
	owner: string; // IRI du super‑admin / admin désigné
	createdAt: string;
}

@Injectable()
export class OntologyService {
    private readonly fusekiBase = (
        process.env.FUSEKI_URL ?? "http://fuseki:3030/autonomy"
    ).replace(/\/$/, "");
    private readonly fusekiUrl = `${this.fusekiBase}/sparql`;
    private readonly fusekiUpdateUrl = `${this.fusekiBase}/update`;
    private readonly fuseki = this.fusekiBase;

    private adminAuth = {
        username: process.env.FUSEKI_USER || "admin",
        password: process.env.FUSEKI_PASSWORD || "Pass123",
    };
	private FUSEKI_USER = process.env.FUSEKI_USER || "admin";
	private FUSEKI_PASS = process.env.FUSEKI_PASSWORD || "Pass123";

	private readonly ROOT_CLASS = "http://www.w3.org/2002/07/owl#Class";
	private readonly ROOT_ONTOLOGY = "http://www.w3.org/2002/07/owl#Ontology";

	private readonly CORE = "http://example.org/core#";
	private readonly XSD = "http://www.w3.org/2001/XMLSchema#";
	/** Graph dédié aux métadonnées des projets */
	private readonly PROJECTS_GRAPH = this.fuseki + "#projects";

	/** Rôles – IRIs fixes (déclarés dans core.ttl) */
	private readonly ROLE_SUPER_ADMIN = this.CORE + "SuperAdminRole";
	private readonly ROLE_ADMIN = this.CORE + "AdminRole";
	private readonly ROLE_REGULAR = this.CORE + "RegularRole";

	constructor(private readonly httpService: HttpService) {}

	/** Envoie une requête UPDATE SPARQL à Fuseki. */
	private async runUpdate(update: string): Promise<void> {
		await lastValueFrom(
			this.httpService.post(
				this.fusekiUpdateUrl,
				new URLSearchParams({ update }),
				{ auth: { username: this.FUSEKI_USER, password: this.FUSEKI_PASS } }
			)
		);
	}

	/** Récupère la liste des groupes auxquels appartient un user (default + named graphs). */
	private async getUserGroups(userIri: string): Promise<string[]> {
		const askGroups = `
        PREFIX core: <${this.CORE}>
        SELECT DISTINCT ?g WHERE {
          {
            ?g core:hasMember <${userIri}> .
          } UNION {
            ?ms core:member <${userIri}> ; core:group ?g .
          } UNION {
            GRAPH ?ng {
              ?g core:hasMember <${userIri}> .
            }
          } UNION {
            GRAPH ?ng {
              ?ms core:member <${userIri}> ; core:group ?g .
            }
          }
        }`;
		const params = new URLSearchParams({
			query: askGroups,
			format: "application/sparql-results+json",
		});
		const res = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params })
		);
		return res.data.results.bindings.map((b: any) => b.g.value);
	}

	/** Récupère la liste des rôles détenus par un utilisateur */
	private async getUserRoles(userIri: string): Promise<string[]> {
		const sparql = `
			PREFIX core: <${this.CORE}>
			SELECT ?r WHERE {
			  { <${userIri}> core:hasRole ?r }
			  UNION { GRAPH ?g { <${userIri}> core:hasRole ?r } }
			}`;
		const params = new URLSearchParams({
			query: sparql,
			format: "application/sparql-results+json",
		});
		const res = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params })
		);
		return res.data.results.bindings.map((b: any) => b.r.value);
	}

	/** Vérifie si l’utilisateur est Super‑admin */
	private async isSuperAdmin(userIri: string): Promise<boolean> {
		const roles = await this.getUserRoles(userIri);
		return roles.includes(this.ROLE_SUPER_ADMIN);
	}

	/** Vérifie si l’utilisateur est propriétaire (admin) d’une organisation */
	private async isOrganizationOwner(
		userIri: string,
		orgIri: string
	): Promise<boolean> {
		const ask = `
			PREFIX core: <${this.CORE}>
			ASK { GRAPH <${this.PROJECTS_GRAPH}> { <${orgIri}> core:ownedBy <${userIri}> } }
		`;
		const res = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params: { query: ask } })
		);
		return res.data.boolean === true;
	}

	/**
	 * Renvoie les ontologies (core:OntologyProject) accessibles.
	 */
	async getProjects(): Promise<{ iri: string; label?: string }[]> {
		const sparql = `
			PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
			PREFIX core: <${this.CORE}>
			SELECT ?proj ?lbl WHERE {
				GRAPH <${this.PROJECTS_GRAPH}> {
					?proj a core:OntologyProject .
					OPTIONAL { ?proj rdfs:label ?lbl }
				}
			}
			ORDER BY ?lbl`;

		const params = new URLSearchParams({
			query: sparql,
			format: "application/sparql-results+json",
		});

		const res = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params })
		);
		return res.data.results.bindings.map((b: any) => ({
			iri: b.proj.value,
			label: b.lbl?.value,
		}));
	}

	/**
	 * Vérifie si un IRI existe déjà dans le triplestore.
	 */
	private async individualExists(iri: string): Promise<boolean> {
		const ask = `ASK { GRAPH ?g { <${iri}> ?p ?o } }`;
		const params = new URLSearchParams({
			query: ask,
		});
		const res = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params })
		);
		return res.data.boolean === true;
	}

	/** Vérifie si un commentaire (ou n’importe quel IRI) existe déjà dans un graph précis. */
	private async commentExistsInGraph(
		iri: string,
		graphIri: string
	): Promise<boolean> {
		const ask = `ASK { GRAPH <${graphIri}> { <${iri}> ?p ?o } }`;
		const res = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params: { query: ask } })
		);
		return res.data.boolean === true;
	}

	/** Vérifie que l'utilisateur est le créateur d'un projet */
	private async isOwner(userIri: string, projectIri: string): Promise<boolean> {
		const ask = `
			PREFIX core: <${this.CORE}>
			ASK { GRAPH <${this.PROJECTS_GRAPH}> { <${projectIri}> core:createdBy <${userIri}> } }`;
		const res = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params: { query: ask } })
		);
		return res.data.boolean === true;
	}

	/** Vérifie que l'utilisateur est le créateur d'un groupe */
	private async isGroupOwner(
		userIri: string,
		groupIri: string
	): Promise<boolean> {
		// search BOTH the default graph and any named graphs
		const ask = `
        PREFIX core: <${this.CORE}>
        ASK {
          { <${groupIri}> core:createdBy <${userIri}> }
          UNION
          { GRAPH ?g { <${groupIri}> core:createdBy <${userIri}> } }
        }`;
		const res = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params: { query: ask } })
		);
		return res.data.boolean === true;
	}

	/**
	 * Crée un individu complet :
	 *   • rdf:type + rdfs:label
	 *   • core:inProject            (ontologie à laquelle il appartient)
	 *   • core:createdBy / createdAt
	 *   • core:updatedBy / updatedAt
	 *   • core:visibleTo            (ACL par groupes)
	 *
	 * @param node              Structure de l’individu (id, label, props…)
	 * @param requesterIri      IRI de l’utilisateur créateur
	 * @param ontologyIri       IRI du projet / de l’ontologie courante
	 * @param visibleToGroups   Liste de groupes autorisés à voir la ressource
	 */
	async createIndividual(
		node: IndividualNode,
		requesterIri: string,
		ontologyIri: string,
		visibleToGroups: string[] = []
	): Promise<void> {
		if (await this.individualExists(node.id)) {
			throw new Error("IRI already exists");
		}
		console.log("Creating individual:", node.id, "in ontology", ontologyIri);
		const now = new Date().toISOString();

		let triples = `<${node.id}> rdf:type <${node.classId}> ;\n`;
		triples += `\trdfs:label """${node.label.replace(/"/g, '\\"')}""" ;\n`;
		triples += `\tcore:inProject <${ontologyIri}> ;\n`;
		triples += `\tcore:createdBy <${requesterIri}> ;\n`;
		triples += `\tcore:createdAt "${now}"^^xsd:dateTime ;\n`;
		triples += `\tcore:updatedBy <${requesterIri}> ;\n`;
		triples += `\tcore:updatedAt "${now}"^^xsd:dateTime .\n`;

		// Propriétés utilisateur
		for (const prop of node.properties) {
			triples += `<${node.id}> <${prop.predicate}> ${toRDF(
				prop.value,
				prop.isLiteral
			)} .\n`;
		}

		// Visibilités par groupe
		for (const g of visibleToGroups) {
			triples += `<${node.id}> core:visibleTo <${g}> .\n`;
		}

		const update = `
			PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
			PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
			PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
			PREFIX core: <${this.CORE}>
			INSERT DATA {
				GRAPH <${ontologyIri}> {
					${triples}
				}
			}`;
		await this.runUpdate(update);
	}

	/**
	 * Met à jour un individu :
	 *  - `addProps` : propriétés à insérer
	 *  - `delProps` : propriétés à supprimer
	 */
    async updateIndividual(
        iri: string,
        addProps: Property[] = [],
        _delProps: Property[] = [],
        requesterIri?: string,
        newVisibleToGroups?: string[],
        ontologyIri?: string
    ) {
        if (!ontologyIri) throw new Error("ontologyIri manquant");
        const now = new Date().toISOString();

        const mkVal = (v: string, isLit: boolean) =>
            isLit ? `"""${v.replace(/"/g, '\\"')}"""` : `<${v}>`;

        // 1) remplacements propriété par propriété (DELETE old, INSERT new)
        const perPropUpdates = addProps.map((p) => `
          WITH <${ontologyIri}>
          DELETE { <${iri}> <${p.predicate}> ?old . }
          ${p.value === "" || p.value == null
                    ? ""
                    : `INSERT { <${iri}> <${p.predicate}> ${mkVal(p.value, p.isLiteral)} . }`}
          WHERE  { OPTIONAL { <${iri}> <${p.predicate}> ?old . } }
        `).join(" ;\n");
        // 2) ACL: remplacement complet si la liste est fournie
        const aclUpdate = Array.isArray(newVisibleToGroups) ? `
            WITH <${ontologyIri}>
            DELETE { <${iri}> <http://example.org/core#visibleTo> ?g . }
            INSERT { ${newVisibleToGroups.map((g) => `<${iri}> <http://example.org/core#visibleTo> <${g}> .`).join("\n")} }
            WHERE  { OPTIONAL { <${iri}> <http://example.org/core#visibleTo> ?g . } }
          ` : "";

        // 3) méta
        const metaUpdate = `
            PREFIX core: <http://example.org/core#>
            PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
            WITH <${ontologyIri}>
            DELETE { <${iri}> core:updatedBy ?ub ; core:updatedAt ?ua . }
            INSERT { <${iri}> core:updatedBy <${requesterIri}> ;
                            core:updatedAt "${now}"^^xsd:dateTime . }
            WHERE  { OPTIONAL { <${iri}> core:updatedBy ?ub ; core:updatedAt ?ua . } }
          `;

        const update = [perPropUpdates, aclUpdate, metaUpdate].filter(Boolean).join(" ;\n");
        await this.runUpdate(update);
    }


	/* ============================================================
	 *                 CRUD – core:Comment
	 * ============================================================
	 */

	/**
	 * Crée un commentaire sur une ressource.
	 */
	async createComment(
		{
			id,
			body,
			onResource,
			replyTo,
			visibleTo = [],
		}: {
			id: string;
			body: string;
			onResource: string; // IRI de la ressource *obligatoire*
			replyTo?: string; // IRI du commentaire parent (optionnel)
			visibleTo?: string[];
		},
		requesterIri: string,
		ontologyIri: string
	): Promise<void> {
		if (await this.commentExistsInGraph(id, ontologyIri)) {
			throw new Error("Comment ID already exists in this ontology");
		}
		if (!onResource) {
			throw new Error(
				"A comment must reference a target resource (onResource)"
			);
		}
		if (replyTo && !(await this.commentExistsInGraph(replyTo, ontologyIri))) {
			throw new Error("Parent comment (replyTo) not found in this ontology");
		}
		const now = new Date().toISOString();
		let triples = `<${id}> a core:Comment ;
			core:body """${body.replace(/"/g, '\\"')}""" ;
			core:onResource <${onResource}> ;
			${replyTo ? `core:replyTo <${replyTo}> ;` : ""}
			core:createdBy <${requesterIri}> ;
			core:createdAt "${now}"^^xsd:dateTime ;
			core:updatedBy <${requesterIri}> ;
			core:updatedAt "${now}"^^xsd:dateTime .\n`;

		for (const g of visibleTo) {
			triples += `<${id}> core:visibleTo <${g}> .\n`;
		}

		const update = `
			PREFIX core: <${this.CORE}>
			PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
			INSERT DATA { GRAPH <${ontologyIri}> { ${triples} } }`;
		await this.runUpdate(update);
	}

	/**
	 * Met à jour le corps ou l’ACL d’un commentaire.
	 */
	async updateComment(
		iri: string,
		{ newBody, visibleTo }: { newBody?: string; visibleTo?: string[] },
		requesterIri: string,
		ontologyIri: string
	): Promise<void> {
		if (!(await this.commentExistsInGraph(iri, ontologyIri))) {
			throw new Error("Comment not found");
		}
		const now = new Date().toISOString();
		let deletePart = "";
		let insertPart = "";

		if (newBody !== undefined) {
			deletePart += `<${iri}> core:body ?b .\n`;
			insertPart += `<${iri}> core:body """${newBody.replace(/"/g, '\\"')}""" .\n`;
		}
		if (Array.isArray(visibleTo)) {
			deletePart += `<${iri}> core:visibleTo ?g .\n`;
			insertPart += visibleTo
				.map((g) => `<${iri}> core:visibleTo <${g}> .\n`)
				.join("");
		}

		// meta
		deletePart += `<${iri}> core:updatedBy ?ub ; core:updatedAt ?ua .\n`;
		insertPart += `<${iri}> core:updatedBy <${requesterIri}> ;
		                    core:updatedAt "${now}"^^xsd:dateTime .\n`;

		const update = `
			PREFIX core: <${this.CORE}>
			PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
			DELETE { GRAPH <${ontologyIri}> { ${deletePart} } }
			INSERT { GRAPH <${ontologyIri}> { ${insertPart} } }
			WHERE  { OPTIONAL { GRAPH <${ontologyIri}> { ${deletePart} } } }`;
		await this.runUpdate(update);
	}

	/** Supprime complètement un commentaire. */
	async deleteComment(iri: string, ontologyIri: string): Promise<void> {
		const update = `DELETE WHERE { GRAPH <${ontologyIri}> { <${iri}> ?p ?o . } }`;
		await this.runUpdate(update);
	}

	/**
	 * Renvoie les commentaires d’une ressource visibles pour un utilisateur.
	 */
	async getCommentsForResource(
		userIri: string,
		resourceIri: string,
		ontologyIri: string
	): Promise<CommentNode[]> {
		const userGroups = await this.getUserGroups(userIri);
		const groupsList = userGroups.map((g) => `<${g}>`).join(", ");
		const aclFilter = `
		  EXISTS { ?c core:createdBy <${userIri}> } ||
		  ${
				userGroups.length > 0
					? `(!BOUND(?vg) || ?vg IN (${groupsList}))`
					: `(!BOUND(?vg))`
			}
		`.trim();

		const sparql = `
			PREFIX core: <${this.CORE}>
			PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

			SELECT ?c ?body ?createdBy ?createdAt ?updatedBy ?updatedAt ?vg ?replyTo WHERE {
			  GRAPH <${ontologyIri}> {
				?c a core:Comment ;
				   core:onResource <${resourceIri}> ;
				   core:body ?body .
				OPTIONAL { ?c core:createdBy ?createdBy }
				OPTIONAL { ?c core:createdAt ?createdAt }
				OPTIONAL { ?c core:updatedBy ?updatedBy }
				OPTIONAL { ?c core:updatedAt ?updatedAt }
				OPTIONAL { ?c core:replyTo ?replyTo }
				OPTIONAL { ?c core:visibleTo ?vg }
				FILTER( ${aclFilter} )
			  }
			}
			ORDER BY DESC(?createdAt)
		`;

		const params = new URLSearchParams({
			query: sparql,
			format: "application/sparql-results+json",
		});
		const { data } = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params })
		);

		type Row = {
			c: { value: string };
			body: { value: string };
			createdBy?: { value: string };
			createdAt?: { value: string };
			updatedBy?: { value: string };
			updatedAt?: { value: string };
			vg?: { value: string };
			replyTo?: { value: string };
		};

		const list: CommentNode[] = [];

		(data.results.bindings as Row[]).forEach((row) => {
			const existing = list.find((cm) => cm.id === row.c.value);
			let entry: CommentNode;
			if (existing) {
				entry = existing;
			} else {
				entry = {
					id: row.c.value,
					body: row.body.value,
					onResource: resourceIri,
					createdBy: row.createdBy?.value || "",
					createdAt: row.createdAt?.value || "",
					replyTo: row.replyTo?.value,
				};
				list.push(entry);
			}
			if (row.updatedBy?.value) entry.updatedBy = row.updatedBy.value;
			if (row.updatedAt?.value) entry.updatedAt = row.updatedAt.value;
			if (row.vg?.value) {
				if (!entry.visibleTo) entry.visibleTo = [];
				if (!entry.visibleTo.includes(row.vg.value))
					entry.visibleTo.push(row.vg.value);
			}
			if (row.replyTo?.value) entry.replyTo = row.replyTo.value;
		});

		return list;
	}

	/**
	 * Renvoie tous les individus (avec leurs propriétés) appartenant à l’ontologie
	 * demandée et visibles pour l’utilisateur courant.
	 */
    async getIndividualsForOntology(userIri: string, ontologyIri: string): Promise<IndividualNode[]> {
        const userGroups = await this.getUserGroups(userIri);
        const groupsList = userGroups.map((g) => `<${g}>`).join(", ");
        const aclFilter = `
            EXISTS { ?s core:createdBy <${userIri}> } ||
            ${userGroups.length > 0 ? `(!BOUND(?vg) || ?vg IN (${groupsList}))` : `(!BOUND(?vg))`}
          `.trim();

        const sparql = `
            PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX owl:  <http://www.w3.org/2002/07/owl#>
            PREFIX core: <${this.CORE}>
            PREFIX foaf: <http://xmlns.com/foaf/0.1/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX schema: <http://schema.org/>
            PREFIX dct: <http://purl.org/dc/terms/>
            
            SELECT ?s ?sLabel ?clsEff ?createdBy ?createdAt ?updatedBy ?updatedAt ?vg
                   ?pred ?predLabel ?val ?valLabel ?vCls
            WHERE {
              GRAPH <${ontologyIri}> {
                { ?s core:inProject <${ontologyIri}> . }
                UNION
                { ?s rdf:type ?cls0 . }
            
                OPTIONAL { ?s rdf:type ?cls }
                BIND(COALESCE(?cls, ?cls0) AS ?clsEff)
            
                # Exclure le schéma
                FILTER NOT EXISTS { ?s a owl:Class }
                FILTER NOT EXISTS { ?s a owl:ObjectProperty }
                FILTER NOT EXISTS { ?s a owl:DatatypeProperty }
                FILTER NOT EXISTS { ?s a owl:Ontology }
            
                OPTIONAL { ?s rdfs:label ?sLabel }
                OPTIONAL { ?s core:visibleTo ?vg }
                OPTIONAL { ?s core:createdBy ?createdBy }
                OPTIONAL { ?s core:createdAt ?createdAt }
                OPTIONAL { ?s core:updatedBy ?updatedBy }
                OPTIONAL { ?s core:updatedAt ?updatedAt }
            
                # Propriétés "utilisateur"
                ?s ?pred ?val .
                FILTER(
                  ?pred != rdf:type &&
                  ?pred != core:inProject &&
                  ?pred != core:createdBy &&
                  ?pred != core:createdAt &&
                  ?pred != core:updatedBy &&
                  ?pred != core:updatedAt &&
                  ?pred != core:visibleTo
                )
                OPTIONAL { ?pred rdfs:label ?predLabel }
              }
            
              # Label de la valeur, où qu'elle soit
              OPTIONAL {
                { ?val (rdfs:label|foaf:name|skos:prefLabel|schema:name|dct:title) ?_vLabel1 }
                UNION
                { GRAPH ?g { ?val (rdfs:label|foaf:name|skos:prefLabel|schema:name|dct:title) ?_vLabel2 } }
              }
              BIND(COALESCE(?_vLabel1, ?_vLabel2) AS ?valLabel)
            
              # Type de la valeur, si connu (graph courant ou autre)
              OPTIONAL {
                { ?val rdf:type ?_vCls1 }
                UNION
                { GRAPH ?gx { ?val rdf:type ?_vCls2 } }
              }
              BIND(COALESCE(?_vCls1, ?_vCls2) AS ?vCls)
            
              FILTER( ${aclFilter} )
            }`;
        const params = new URLSearchParams({
            query: sparql,
            format: "application/sparql-results+json",
        });
        const { data } = await lastValueFrom(this.httpService.get(this.fusekiUrl, { params }));

        type Row = {
            s: { value: string };
            sLabel?: { value: string };
            clsEff?: { value: string };
            createdBy?: { value: string };
            createdAt?: { value: string };
            updatedBy?: { value: string };
            updatedAt?: { value: string };
            vg?: { value: string };
            pred: { value: string };
            predLabel?: { value: string };
            val: { value: string; type: string };
            valLabel?: { value: string };
            vCls?: { value: string };
        };

        const map = new Map<string, IndividualNode>();

        (data.results.bindings as Row[]).forEach((row) => {
            // 1) Sujet: comme avant
            const id = row.s.value;
            if (!map.has(id)) {
                map.set(id, {
                    id,
                    label: row.sLabel?.value || id.split(/[#/]/).pop() || "",
                    classId: row.clsEff?.value || "http://www.w3.org/2002/07/owl#Thing",
                    properties: [],
                    children: [],
                });
            }
            const entry = map.get(id)!;
            if (row.createdBy?.value) entry.createdBy = row.createdBy.value;
            if (row.createdAt?.value) entry.createdAt = row.createdAt.value;
            if (row.updatedBy?.value) entry.updatedBy = row.updatedBy.value;
            if (row.updatedAt?.value) entry.updatedAt = row.updatedAt.value;
            if (row.vg?.value) {
                entry.visibleTo ??= [];
                if (!entry.visibleTo.includes(row.vg.value)) entry.visibleTo.push(row.vg.value);
            }
            const isUri = row.val?.type === "uri";

            entry.properties.push({
                predicate: row.pred.value,
                predicateLabel: row.predLabel?.value,
                value: row.val.value,
                valueLabel: row.valLabel?.value,
                isLiteral: !isUri,
            });

            // 2) CIBLE: on l'ajoute au snapshot si c'est un IRI,
            //    même si elle n'a aucune propriété propre → chip cliquable.
            if (row.val?.type === "uri" && !map.has(row.val.value)) {
                map.set(row.val.value, {
                    id: row.val.value,
                    label: row.valLabel?.value || row.val.value.split(/[#/]/).pop() || row.val.value,
                    classId: row.vCls?.value || "http://www.w3.org/2002/07/owl#Thing",
                    properties: [],
                    children: [],
                });
            }
        });

        for (const node of map.values()) {
            if (!node.properties || node.properties.length <= 1) continue;

            const uniq = new Map<string, Property>(); // key = predicate||value
            for (const p of node.properties) {
                const key = `${p.predicate}||${p.isLiteral ? "L" : "R"}||${p.value}`;
                const prev = uniq.get(key);

                if (!prev) {
                    uniq.set(key, p);
                } else {
                    // Conserver la version la plus informative
                    const better: Property = {
                        predicate: p.predicate,
                        predicateLabel: p.predicateLabel || prev.predicateLabel,
                        value: p.value,
                        valueLabel: p.valueLabel || prev.valueLabel,
                        isLiteral: p.isLiteral,
                    };
                    uniq.set(key, better);
                }
            }
            node.properties = Array.from(uniq.values());
        }

        return Array.from(map.values());
    }

	async getFullSnapshot(
		userIri: string,
		ontologyIri: string
	): Promise<FullSnapshot> {
		const [graph, individuals, persons] = await Promise.all([
			this.getGraph(ontologyIri),
			this.getIndividualsForOntology(userIri, ontologyIri),
			this.getAllPersons(),
		]);
		return { graph, individuals, persons };
	}

    async getGraph(
        ontologyIri: string
    ): Promise<{ nodes: NodeData[]; edges: EdgeData[] }> {
        const sparql = `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX owl:  <http://www.w3.org/2002/07/owl#>
            SELECT ?s ?sLabel ?o ?oLabel WHERE {
              GRAPH <${ontologyIri}> {
                ?s rdfs:subClassOf ?o .
                FILTER(isIRI(?s) && isIRI(?o))
                OPTIONAL { ?s rdfs:label ?sLabel }
                OPTIONAL { ?o rdfs:label ?oLabel }
              }
            }`;
        const params = new URLSearchParams({
            query: sparql,
            format: "application/sparql-results+json",
        });
        const response = await lastValueFrom(
            this.httpService.get(this.fusekiUrl, { params })
        );
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

	/**
	 * Retourne les DataProperties & ObjectProperties applicables à une classe
	 * (via rdfs:domain sur la classe ou l’une de ses super‑classes).
	 */
    async getClassProperties(
        classIri: string,
        userIri: string,
        ontologyIri: string
    ): Promise<{
        dataProps: { iri: string; label: string }[];
        objectProps: {
            iri: string;
            label: string;
            range?: { iri: string; label: string };
        }[];
    }> {
        const sparql = `
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
                  OPTIONAL { ?p rdfs:range ?range .
                             OPTIONAL { ?range rdfs:label ?rangeLabel } }
                }
                ?p rdfs:domain ?d .
                <${classIri}> rdfs:subClassOf* ?d .
                OPTIONAL { ?p rdfs:label ?pLabel }
              }
            }`;
        const params = new URLSearchParams({
            query: sparql,
            format: "application/sparql-results+json",
        });
        const { data } = await lastValueFrom(
            this.httpService.get(this.fusekiUrl, { params })
        );

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
                            label:
                                row.rangeLabel?.value ||
                                row.range.value.split(/[#/]/).pop(),
                        }
                        : undefined,
                });
            }
        });

        return { dataProps, objectProps };
    }

	/**
	 * Retourne tous les utilisateurs de la plateforme (core:User) avec
	 * l’ensemble de leurs propriétés (email, provider, etc.).
	 * On exploite ici le schéma Core : un utilisateur est une instance
	 * de `core:User`, sous‑classe de foaf:Person ; la présence d’un
	 * `core:hasAccount` matérialise le fait qu’il dispose d’identifiants.
	 */
	async getAllPersons(/* userIri non utilisé ici */): Promise<
		IndividualNode[]
	> {
		const sparql = `
			PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
			PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>
			PREFIX core:  <${this.CORE}>

			SELECT ?u ?uLabel ?pred ?predLabel ?val ?valLabel ?grp ?grpLabel WHERE {
			  ?u rdf:type core:User .             # toutes les instances de core:User
			  OPTIONAL { ?u core:hasAccount ?acc } # présence d’un compte (facultatif)
			  OPTIONAL { ?u rdfs:label ?uLabel }
			  OPTIONAL {
				{ ?grp core:hasMember ?u }
				UNION
				{ GRAPH ?ng { ?grp core:hasMember ?u } }
				OPTIONAL { ?grp rdfs:label ?grpLabel }
			  }
			  ?u ?pred ?val .
			  FILTER (?pred != rdf:type)

			  OPTIONAL { ?pred rdfs:label ?predLabel }
			  OPTIONAL { ?val  rdfs:label ?valLabel }
			}
		`;
		const params = new URLSearchParams({
			query: sparql,
			format: "application/sparql-results+json",
		});
		const { data } = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params })
		);
		type Row = {
			u: { value: string };
			uLabel?: { value: string };
			pred: { value: string };
			predLabel?: { value: string };
            val: { value: string; type: string };
			valLabel?: { value: string };
			grp?: { value: string };
			grpLabel?: { value: string };
		};

		const USER_CLASS_IRI = this.CORE + "User";
		const personMap = new Map<string, IndividualNode>();

		(data.results.bindings as Row[]).forEach((row) => {
			const id = row.u.value;
			const label = row.uLabel?.value || id.split(/[#/]/).pop();
			if (!personMap.has(id)) {
				personMap.set(id, {
					id,
					label: label || "Unknown",
					classId: USER_CLASS_IRI,
					properties: [],
					children: [],
				});
			}
			if (row.grp?.value) {
				if (!personMap.get(id)!.groups) personMap.get(id)!.groups = [];
				const list = personMap.get(id)!.groups!;
				if (!list.some((g) => g.iri === row.grp!.value)) {
					list.push({
						iri: row.grp.value,
						label: row.grpLabel?.value,
					});
				}
			}
            personMap.get(id)!.properties.push({
                predicate: row.pred.value,
                predicateLabel: row.predLabel?.value,
                value: row.val.value,
                valueLabel: row.valLabel?.value,
                isLiteral: row.val.type !== "uri",
            });
		});
		return Array.from(personMap.values());
	}

	/**
	 * Retourne la fiche détaillée d’un utilisateur précis (core:User).
	 * On récupère toutes ses propriétés ainsi que les groupes auxquels il appartient.
	 * Si aucun utilisateur n’est trouvé, la fonction renvoie null.
	 */
    async getPerson(
        _requesterIri: string, // réservé pour ACL futures
        personIri: string
    ): Promise<IndividualNode | null> {
        const sparql = `
            PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX core:  <${this.CORE}>
        
            SELECT ?uLabel ?pred ?predLabel ?val ?valLabel ?grp ?grpLabel WHERE {
              BIND(<${personIri}> AS ?u)
              ?u rdf:type core:User .
        
              OPTIONAL { ?u rdfs:label ?uLabel }
        
              # Groupes d’appartenance (direct + named graphs)
              OPTIONAL {
                { ?grp core:hasMember ?u }
                UNION { GRAPH ?ng { ?grp core:hasMember ?u } }
                OPTIONAL { ?grp rdfs:label ?grpLabel }
              }
        
              # Toutes les propriétés de l’utilisateur (sauf rdf:type)
              OPTIONAL {
                ?u ?pred ?val .
                FILTER(?pred != rdf:type)
                OPTIONAL { ?pred rdfs:label ?predLabel }
                OPTIONAL { ?val  rdfs:label ?valLabel }
              }
            }
          `;

        const params = new URLSearchParams({
            query: sparql,
            format: "application/sparql-results+json",
        });
        const { data } = await lastValueFrom(
            this.httpService.get(this.fusekiUrl, { params })
        );

        type Row = {
            uLabel?: { value: string };
            pred?: { value: string };
            predLabel?: { value: string };
            val?: { value: string; type: string };
            valLabel?: { value: string };
            grp?: { value: string };
            grpLabel?: { value: string };
        };

        if (data.results.bindings.length === 0) return null;

        const USER_CLASS_IRI = this.CORE + "User";
        const person: IndividualNode = {
            id: personIri,
            label:
                data.results.bindings[0].uLabel?.value ||
                personIri.split(/[#/]/).pop() ||
                "Unknown",
            classId: USER_CLASS_IRI,
            properties: [],
            children: [],
        };

        (data.results.bindings as Row[]).forEach((row) => {
            // Groupes
            if (row.grp?.value) {
                if (!person.groups) person.groups = [];
                if (!person.groups.some((g) => g.iri === row.grp!.value)) {
                    person.groups.push({
                        iri: row.grp.value,
                        label: row.grpLabel?.value,
                    });
                }
            }

            // Propriétés
            if (row.pred && row.val) {
                const isLiteral = row.val.type !== "uri";
                person.properties.push({
                    predicate: row.pred.value,
                    predicateLabel: row.predLabel?.value,
                    value: row.val.value,
                    valueLabel: row.valLabel?.value,
                    isLiteral,
                });
            }
        });

        // Déduplication (clé = prédicat + nature littérale/IRI + valeur)
        if (person.properties.length > 1) {
            const uniq = new Map<string, Property>();
            for (const p of person.properties) {
                const key = `${p.predicate}||${p.isLiteral ? "L" : "R"}||${p.value}`;
                const prev = uniq.get(key);
                if (!prev) {
                    uniq.set(key, p);
                } else {
                    const better: Property = {
                        predicate: p.predicate,
                        predicateLabel: p.predicateLabel || prev.predicateLabel,
                        value: p.value,
                        valueLabel: p.valueLabel || prev.valueLabel,
                        isLiteral: p.isLiteral,
                    };
                    uniq.set(key, better);
                }
            }
            person.properties = Array.from(uniq.values());
        }

        return person;
    }

	/**
	 * Supprime totalement un individu : toutes les triples où il apparaît
	 * comme sujet sont retirées du store.
	 */
    async deleteIndividual(iri: string, ontologyIri?: string): Promise<void> {
        const update = ontologyIri
            ? `DELETE WHERE { GRAPH <${ontologyIri}> { <${iri}> ?p ?o . } }`
            : `DELETE WHERE { <${iri}> ?p ?o . }`;
        await this.runUpdate(update);
    }

	/* ============================================================
	 *                 CRUD – core:Organization
	 * ============================================================
	 */

	/** Liste toutes les organisations (label + owner) */
	async getOrganizations(): Promise<OrganizationInfo[]> {
		const sparql = `
			PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
			PREFIX core: <${this.CORE}>
			SELECT ?org ?lbl ?owner ?createdAt WHERE {
			  GRAPH <${this.PROJECTS_GRAPH}> {
			    ?org a core:Organization ;
			         core:ownedBy ?owner ;
			         core:createdAt ?createdAt .
			    OPTIONAL { ?org rdfs:label ?lbl }
			  }
			}`;
		const params = new URLSearchParams({
			query: sparql,
			format: "application/sparql-results+json",
		});
		const { data } = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params })
		);
		type Row = {
			org: { value: string };
			lbl?: { value: string };
			owner: { value: string };
			createdAt: { value: string };
		};
		return (data.results.bindings as Row[]).map((row) => ({
			iri: row.org.value,
			label: row.lbl?.value,
			owner: row.owner.value,
			createdAt: row.createdAt.value,
		}));
	}

	/**
	 * Renvoie les organisations dont l’utilisateur est :
	 *   • propriétaire (core:ownedBy)
	 *   • OU membre via l’un de ses groupes appartenant à l’organisation.
	 *   • OU membre direct via core:belongsToOrganization.
	 */
	async getOrganizationsForUser(userIri: string): Promise<OrganizationInfo[]> {
		const sparql = `
			PREFIX core: <${this.CORE}>
			PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

			SELECT DISTINCT ?org ?lbl ?owner ?createdAt WHERE {
			  GRAPH <${this.PROJECTS_GRAPH}> {
			    ?org a core:Organization ;
			         core:ownedBy ?owner ;
			         core:createdAt ?createdAt .
			    OPTIONAL { ?org rdfs:label ?lbl }
			  }
			  FILTER(
			    ?owner = <${userIri}>
			  )
			}`;
		const params = new URLSearchParams({
			query: sparql,
			format: "application/sparql-results+json",
		});
		const { data } = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params })
		);

		type Row = {
			org: { value: string };
			lbl?: { value: string };
			owner: { value: string };
			createdAt: { value: string };
		};

		return (data.results.bindings as Row[]).map((row) => ({
			iri: row.org.value,
			label: row.lbl?.value,
			owner: row.owner.value,
			createdAt: row.createdAt.value,
		}));
	}

	/**
	 * Renvoie les IRIs (et labels) des utilisateurs appartenant à une organisation
	 * soit via core:belongsToOrganization, soit en tant que membres d’un groupe de l’orga.
	 */
	async getOrganizationMembers(
		orgIri: string
	): Promise<{ iri: string; label?: string }[]> {
		const sparql = `
			PREFIX core: <${this.CORE}>
			PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

			SELECT DISTINCT ?u ?lbl WHERE {
			  {
			    GRAPH <${this.PROJECTS_GRAPH}> {
			      ?u core:belongsToOrganization <${orgIri}> .
			    }
			  } UNION {
			    ?grp core:inOrganization <${orgIri}> ;
			         core:hasMember ?u .
			  } UNION {
			    GRAPH ?ng {
			      ?grp core:inOrganization <${orgIri}> ;
			           core:hasMember ?u .
			    }
			  }
			  OPTIONAL { ?u rdfs:label ?lbl }
			}
		`;
		const params = new URLSearchParams({
			query: sparql,
			format: "application/sparql-results+json",
		});
		const { data } = await lastValueFrom(
			this.httpService.get(this.fusekiUrl, { params })
		);

		type Row = { u: { value: string }; lbl?: { value: string } };

		return (data.results.bindings as Row[]).map((row) => ({
			iri: row.u.value,
			label: row.lbl?.value,
		}));
	}

	/**
	 * Crée une organisation – uniquement par un Super‑Admin.
	 * L’owner (admin) est désigné via `ownerIri`.
	 * Retourne l’IRI de l’organisation.
	 */
	async createOrganization(
		requesterIri: string,
		{ label, ownerIri }: { label: string; ownerIri: string }
	): Promise<string> {
		if (!(await this.isSuperAdmin(requesterIri))) {
			throw new ForbiddenException(
				"Seuls les super‑admins peuvent créer une organisation"
			);
		}
		const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const iri = `http://example.org/org/${slug}-${Date.now()}`;

		const now = new Date().toISOString();
		const update = `
			PREFIX core: <${this.CORE}>
			PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
			PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
			INSERT DATA {
			  GRAPH <${this.PROJECTS_GRAPH}> {
			    <${iri}> a core:Organization ;
			             rdfs:label """${label.replace(/"/g, '\\"')}""" ;
			             core:ownedBy <${ownerIri}> ;
			             core:createdBy <${requesterIri}> ;
			             core:createdAt "${now}"^^xsd:dateTime .
			  }
			}`;
		await this.runUpdate(update);
		return iri;
	}

	/** Modifie le label ou le propriétaire d’une organisation */
	async updateOrganization(
		requesterIri: string,
		orgIri: string,
		{ newLabel, newOwner }: { newLabel?: string; newOwner?: string }
	): Promise<void> {
		if (!(await this.isSuperAdmin(requesterIri))) {
			throw new ForbiddenException(
				"Seul un super‑admin peut modifier l’organisation"
			);
		}
		let deletePart = "";
		let insertPart = "";
		if (newLabel !== undefined) {
			deletePart += `<${orgIri}> rdfs:label ?l .\n`;
			insertPart += `<${orgIri}> rdfs:label """${newLabel.replace(/"/g, '\\"')}""" .\n`;
		}
		if (newOwner !== undefined) {
			deletePart += `<${orgIri}> core:ownedBy ?o .\n`;
			insertPart += `<${orgIri}> core:ownedBy <${newOwner}> .\n`;
		}
		const update = `
			PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
			PREFIX core: <${this.CORE}>
			DELETE { GRAPH <${this.PROJECTS_GRAPH}> { ${deletePart} } }
			INSERT { GRAPH <${this.PROJECTS_GRAPH}> { ${insertPart} } }
			WHERE  { OPTIONAL { GRAPH <${this.PROJECTS_GRAPH}> { ${deletePart} } } }`;
		await this.runUpdate(update);
	}

	/** Supprime une organisation (Super‑admin only) */
	async deleteOrganization(
		requesterIri: string,
		orgIri: string
	): Promise<void> {
		if (!(await this.isSuperAdmin(requesterIri))) {
			throw new ForbiddenException(
				"Seul un super‑admin peut supprimer une organisation"
			);
		}
		const update = `DELETE WHERE { GRAPH <${this.PROJECTS_GRAPH}> { <${orgIri}> ?p ?o . } }`;
		await this.runUpdate(update);
	}

	/* ---------- Organisation members ---------- */

	/** Ajoute un utilisateur à l’organisation (Super‑admin ou owner) */
	async addOrganizationMember(
		requesterIri: string,
		orgIri: string,
		userIri: string
	): Promise<void> {
		const allowed =
			(await this.isSuperAdmin(requesterIri)) ||
			(await this.isOrganizationOwner(requesterIri, orgIri));
		if (!allowed)
			throw new ForbiddenException(
				"Seul le super‑admin ou l’owner peut ajouter un membre"
			);

		const update = `
			PREFIX core: <${this.CORE}>
			INSERT DATA {
				GRAPH <${this.PROJECTS_GRAPH}> {
					<${userIri}> core:belongsToOrganization <${orgIri}> .
				}
			}`;
		await this.runUpdate(update);
	}

	/** Retire un utilisateur de l’organisation */
	async removeOrganizationMember(
		requesterIri: string,
		orgIri: string,
		userIri: string
	): Promise<void> {
		const allowed =
			(await this.isSuperAdmin(requesterIri)) ||
			(await this.isOrganizationOwner(requesterIri, orgIri));

		if (!allowed) {
			throw new ForbiddenException(
				"Seul le super-admin ou l’owner peut retirer un membre"
			);
		}
		const update = `
			PREFIX core: <${this.CORE}>

			WITH <${this.PROJECTS_GRAPH}>
			DELETE { <${userIri}> core:belongsToOrganization <${orgIri}> . }
			WHERE  { <${userIri}> core:belongsToOrganization <${orgIri}> . } ;

			DELETE { ?grp core:hasMember <${userIri}> . }
			WHERE  {
			{ ?grp core:inOrganization <${orgIri}> ;
					core:hasMember       <${userIri}> . }
			UNION {
				GRAPH ?g {
				?grp core:inOrganization <${orgIri}> ;
					core:hasMember       <${userIri}> .
				}
			}
			} ;

			DELETE { ?ms core:member <${userIri}> ; core:group ?grp . }
			WHERE  {
			{ ?grp core:inOrganization <${orgIri}> .
				?ms  core:member <${userIri}> ;
					core:group  ?grp . }
			UNION {
				GRAPH ?g {
				?grp core:inOrganization <${orgIri}> .
				?ms  core:member <${userIri}> ;
					core:group  ?grp .
				}
			}
			}`;
		await this.runUpdate(update);
	}

	/* ============================================================
	 *             CRUD  –  core:OntologyProject
	 * ============================================================
	 */

	async createProject(
		requesterIri: string,
		{
			iri,
			label,
			visibleToGroups = [],
		}: { iri: string; label: string; visibleToGroups?: string | string[] },
		file?: Express.Multer.File
	) {
		// normalise « visibleToGroups » pour être toujours un tableau
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
               rdfs:label """${label.replace(/"/g, '\\"')}""" ;
               core:createdBy <${requesterIri}> .
      ${groups.map((g) => `<${iri}> core:visibleTo <${g}> .`).join("\n      ")}
    }
  }`;

		await this.runUpdate(metaTriples);

		/* 2. Si un fichier RDF a été fourni : push direct dans le graph utilisateur */
		if (file) {
			await axios.post(
				`${this.fuseki.replace(/\/?$/, "/data")}?graph=${encodeURIComponent(iri)}`,
				file.buffer,
				{
					auth: this.adminAuth,
					headers: { "Content-Type": file.mimetype || "application/rdf+xml" },
					maxBodyLength: Infinity, // important pour > 10 Mio
				}
			);
		}
	}
	/** Met à jour le label et/ou la visibilité d'un projet */
	async updateProject(
		requesterIri: string,
		iri: string,
		newLabel?: string,
		visibleToGroups?: string[]
	): Promise<void> {
		if (!(await this.isOwner(requesterIri, iri))) {
			throw new ForbiddenException("Vous n’êtes pas propriétaire de ce projet");
		}
		let deletePart = "";
		let insertPart = "";

		if (newLabel !== undefined) {
			deletePart += `<${iri}> rdfs:label ?lbl .\n`;
			insertPart += `<${iri}> rdfs:label """${newLabel.replace(/"/g, '\\"')}""" .\n`;
		}

		if (Array.isArray(visibleToGroups)) {
			deletePart += `<${iri}> core:visibleTo ?g .\n`;
			insertPart += visibleToGroups
				.map((g) => `<${iri}> core:visibleTo <${g}> .\n`)
				.join("");
		}

		const update = `
			PREFIX core: <${this.CORE}>
			PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
			DELETE { GRAPH <${this.PROJECTS_GRAPH}> { ${deletePart} } }
			INSERT { GRAPH <${this.PROJECTS_GRAPH}> { ${insertPart} } }
			WHERE  { OPTIONAL { GRAPH <${this.PROJECTS_GRAPH}> { ${deletePart} } } }`;
		await this.runUpdate(update);
	}

	/** Supprime définitivement un projet (et toutes ses triples sujet) */
	async deleteProject(requesterIri: string, iri: string): Promise<void> {
		if (!(await this.isOwner(requesterIri, iri))) {
			throw new ForbiddenException("Vous n’êtes pas propriétaire de ce projet");
		}
		const update = `DELETE WHERE { GRAPH <${this.PROJECTS_GRAPH}> { <${iri}> ?p ?o . } }`;
		await this.runUpdate(update);
	}

	/* ============================================================
	 *                   Groupes  –  core:Group
	 * ============================================================
	 */

	/**
	 * Retourne la liste des groupes auxquels appartient l’utilisateur.
	 * Pour chaque groupe on renvoie : IRI, label, créateur et la liste
	 * complète des membres (IRIs).
	 */
    async getGroups(userIri: string): Promise<GroupInfo[]> {
        const sparql = `
            PREFIX core: <${this.CORE}>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?g ?lbl ?creator ?member ?org WHERE {
              ?g a core:Group ;
                 core:createdBy ?creator ;
                 core:hasMember <${userIri}> .
              OPTIONAL { ?g rdfs:label ?lbl }
              OPTIONAL { ?g core:hasMember ?member }
              OPTIONAL { ?g core:inOrganization ?org }
            }
            `;
        const params = new URLSearchParams({
            query: sparql,
            format: "application/sparql-results+json",
        });
        const { data } = await lastValueFrom(
            this.httpService.get(this.fusekiUrl, { params })
        );

        type Row = {
            g: { value: string };
            lbl?: { value: string };
            creator: { value: string };
            member?: { value: string };
            org?: { value: string };
        };

        const map = new Map<string, GroupInfo>();
        (data.results.bindings as Row[]).forEach((row) => {
            const iri = row.g.value;
            if (!map.has(iri)) {
                map.set(iri, {
                    iri,
                    label: row.lbl?.value,
                    createdBy: row.creator.value,
                    members: [],
                    organizationIri: row.org?.value,
                });
            }
            if (row.member) {
                const grp = map.get(iri)!;
                if (!grp.members.includes(row.member.value))
                    grp.members.push(row.member.value);
            }
            // si la valeur org arrive sur une ligne suivante, garder la dernière vue
            if (row.org?.value) {
                map.get(iri)!.organizationIri = row.org.value;
            }
        });

        return Array.from(map.values()).sort((a, b) =>
            (a.label || a.iri).localeCompare(b.label || b.iri)
        );
    }
	/** Crée un groupe (rattachement à une organisation) et retourne son IRI */
	async createGroup(
		label: string,
		creatorIri: string,
		organizationIri: string,
		members: string[] = []
	): Promise<string> {
		const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const iri = `http://example.org/group/${slug}-${Date.now()}`;
		if (!members.includes(creatorIri)) members.push(creatorIri);
		let triples = `<${iri}> a core:Group ;
			rdfs:label """${label.replace(/"/g, '\\"')}""" ;
			core:inOrganization <${organizationIri}> ;
			core:createdBy <${creatorIri}> ;
			core:createdAt "${new Date().toISOString()}"^^xsd:dateTime .\n`;
		for (const m of members) {
			triples += `<${iri}> core:hasMember <${m}> .\n`;
		}
		const update = `
			PREFIX core: <${this.CORE}>
			PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
			PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
			INSERT DATA { ${triples} }
		`;
		await this.runUpdate(update);
		return iri;
	}

	/** Ajoute un membre à un groupe */
	// No signature change needed below; just ensure parameter name is requesterIri (already so)
	async addGroupMember(
		requesterIri: string,
		groupIri: string,
		memberIri: string
	): Promise<void> {
		if (!(await this.isGroupOwner(requesterIri, groupIri))) {
			throw new ForbiddenException("Vous n’êtes pas propriétaire de ce groupe");
		}

		const update = `
			PREFIX core: <${this.CORE}>
			# Ajout dans le graph par défaut
			INSERT { <${groupIri}> core:hasMember <${memberIri}> . }
			WHERE  {};

			# Ajout dans tous les graphs qui contiennent déjà le groupe (si besoin)
			INSERT {
			  GRAPH ?g { <${groupIri}> core:hasMember <${memberIri}> . }
			}
			WHERE  {
			  GRAPH ?g { <${groupIri}> ?p ?o }
			};`;
		await this.runUpdate(update);
	}

	/** Retire un membre d'un groupe */
	async removeGroupMember(
		requesterIri: string,
		groupIri: string,
		memberIri: string
	): Promise<void> {
		if (!(await this.isGroupOwner(requesterIri, groupIri))) {
			throw new ForbiddenException("Vous n’êtes pas propriétaire de ce groupe");
		}
		const update = `
PREFIX core: <${this.CORE}>

# -- 1. Direct membership triple (default & named graphs) ---------------------
DELETE { <${groupIri}> core:hasMember <${memberIri}> . }
WHERE  {
  { <${groupIri}> core:hasMember <${memberIri}> }
  UNION { GRAPH ?g { <${groupIri}> core:hasMember <${memberIri}> } }
} ;

# -- 2. Reified membership statements -----------------------------------------
DELETE { ?ms core:member <${memberIri}> ; core:group <${groupIri}> . }
WHERE  {
  { ?ms core:member <${memberIri}> ; core:group <${groupIri}> }
  UNION { GRAPH ?g { ?ms core:member <${memberIri}> ; core:group <${groupIri}> } }
}`;
		await this.runUpdate(update);
	}
	/** Change le label d'un groupe */
    async updateGroupLabel(
        requesterIri: string,
        groupIri: string,
        newLabel?: string
    ): Promise<void> {
        if (!(await this.isGroupOwner(requesterIri, groupIri))) {
            throw new ForbiddenException("Vous n’êtes pas propriétaire de ce groupe");
        }
        if (newLabel === undefined) return;

        const update = `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            DELETE { <${groupIri}> rdfs:label ?l . }
            INSERT { <${groupIri}> rdfs:label """${newLabel.replace(/"/g, '\\"')}""" . }
            WHERE  { OPTIONAL { <${groupIri}> rdfs:label ?l . } }`;
        await this.runUpdate(update);
    }

    async updateGroupOrganization(
        requesterIri: string,
        groupIri: string,
        newOrgIri: string
    ): Promise<void> {
        if (!(await this.isGroupOwner(requesterIri, groupIri))) {
            throw new ForbiddenException("Vous n’êtes pas propriétaire de ce groupe");
        }
        const update = `
            PREFIX core: <${this.CORE}>
            # Supprime le rattachement existant (défaut + named graphs)
            DELETE { <${groupIri}> core:inOrganization ?o . }
            WHERE  { <${groupIri}> core:inOrganization ?o . } ;
            DELETE { GRAPH ?g { <${groupIri}> core:inOrganization ?o . } }
            WHERE  { GRAPH ?g { <${groupIri}> core:inOrganization ?o . } } ;
            # Insère le nouveau rattachement dans le graphe par défaut
            INSERT DATA { <${groupIri}> core:inOrganization <${newOrgIri}> . }`;
        await this.runUpdate(update);
    }

	/** Supprime complètement un groupe */
	async deleteGroup(requesterIri: string, groupIri: string): Promise<void> {
		if (!(await this.isGroupOwner(requesterIri, groupIri))) {
			throw new ForbiddenException("Vous n’êtes pas propriétaire de ce groupe");
		}
		const update = `DELETE WHERE { <${groupIri}> ?p ?o . }`;
		await this.runUpdate(update);
	}
}
