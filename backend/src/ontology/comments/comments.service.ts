import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";

import { OntologyBaseService } from "../common/base-ontology.service";
import { CommentNode } from "../common/types";
import { escapeSparqlLiteral } from "../../utils/sparql.utils";

@Injectable()
export class CommentsService extends OntologyBaseService {
    constructor(httpService: HttpService) {
        super(httpService);
    }

    async getCommentsForResource(
        userIri: string,
        resourceIri: string,
        ontologyIri: string
    ): Promise<CommentNode[]> {
        const userGroups = await this.getUserGroups(userIri);
        const groupsList = userGroups.map((g) => `<${g}>`).join(", ");
        const aclFilter = `
          EXISTS { ?c core:createdBy <${userIri}> } ||
          ${userGroups.length > 0 ? `(!BOUND(?vg) || ?vg IN (${groupsList}))` : `(!BOUND(?vg))`}
        `.trim();

        const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
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
        `);

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
            let entry = list.find((cm) => cm.id === row.c.value);
            if (!entry) {
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
                entry.visibleTo ??= [];
                if (!entry.visibleTo.includes(row.vg.value)) {
                    entry.visibleTo.push(row.vg.value);
                }
            }
            if (row.replyTo?.value) entry.replyTo = row.replyTo.value;
        });

        return list;
    }

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
            onResource: string;
            replyTo?: string;
            visibleTo?: string[];
        },
        requesterIri: string,
        ontologyIri: string
    ): Promise<void> {
        await this.enforceWritePermission(requesterIri, ontologyIri);

        if (await this.commentExistsInGraph(id, ontologyIri)) {
            throw new Error("Comment ID already exists in this ontology");
        }
        if (!onResource) {
            throw new Error("A comment must reference a target resource (onResource)");
        }
        if (replyTo && !(await this.commentExistsInGraph(replyTo, ontologyIri))) {
            throw new Error("Parent comment (replyTo) not found in this ontology");
        }

        const now = new Date().toISOString();
        let triples = `<${id}> a core:Comment ;
            core:body """${escapeSparqlLiteral(body)}""" ;
            core:onResource <${onResource}> ;
            ${replyTo ? `core:replyTo <${replyTo}> ;` : ""}
            core:createdBy <${requesterIri}> ;
            core:createdAt "${now}"^^xsd:dateTime ;
            core:updatedBy <${requesterIri}> ;
            core:updatedAt "${now}"^^xsd:dateTime .\n`;

        for (const groupIri of visibleTo) {
            triples += `<${id}> core:visibleTo <${groupIri}> .\n`;
        }

        const update = `
            PREFIX core: <${this.CORE}>
            PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
            INSERT DATA { GRAPH <${ontologyIri}> { ${triples} } }
        `;

        await this.runUpdate(update);
    }

    async updateComment(
        iri: string,
        { newBody, visibleTo }: { newBody?: string; visibleTo?: string[] },
        requesterIri: string,
        ontologyIri: string
    ): Promise<void> {
        await this.enforceWritePermission(requesterIri, ontologyIri);

        if (!(await this.commentExistsInGraph(iri, ontologyIri))) {
            throw new Error("Comment not found");
        }

        const now = new Date().toISOString();
        let deletePart = "";
        let insertPart = "";

        if (newBody !== undefined) {
            deletePart += `<${iri}> core:body ?b .\n`;
            insertPart += `<${iri}> core:body """${escapeSparqlLiteral(newBody)}""" .\n`;
        }
        if (Array.isArray(visibleTo)) {
            deletePart += `<${iri}> core:visibleTo ?g .\n`;
            insertPart += visibleTo
                .map((g) => `<${iri}> core:visibleTo <${g}> .\n`)
                .join("");
        }

        deletePart += `<${iri}> core:updatedBy ?ub ; core:updatedAt ?ua .\n`;
        insertPart += `<${iri}> core:updatedBy <${requesterIri}> ;
                        core:updatedAt "${now}"^^xsd:dateTime .\n`;

        const update = `
            PREFIX core: <${this.CORE}>
            PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
            DELETE { GRAPH <${ontologyIri}> { ${deletePart} } }
            INSERT { GRAPH <${ontologyIri}> { ${insertPart} } }
            WHERE  { OPTIONAL { GRAPH <${ontologyIri}> { ${deletePart} } } }
        `;

        await this.runUpdate(update);
    }

    async deleteComment(iri: string, ontologyIri: string, requesterIri: string): Promise<void> {
        await this.enforceWritePermission(requesterIri, ontologyIri);
        const update = `DELETE WHERE { GRAPH <${ontologyIri}> { <${iri}> ?p ?o . } }`;
        await this.runUpdate(update);
    }
}

