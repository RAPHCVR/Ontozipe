import { Injectable, ForbiddenException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";

import { OntologyBaseService } from "../common/base-ontology.service";
import { OrganizationInfo } from "../common/types";
import { escapeSparqlLiteral } from "../../utils/sparql.utils";
import { NotificationsService } from "../../notifications/notifications.service";

@Injectable()
export class OrganizationsService extends OntologyBaseService {
    constructor(httpService: HttpService, private readonly notifications: NotificationsService) {
        super(httpService);
    }

    async getOrganizations(): Promise<OrganizationInfo[]> {
        const data = await this.runSelect(`
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX core: <${this.CORE}>
            SELECT ?org ?lbl ?owner ?createdAt WHERE {
              GRAPH <${this.PROJECTS_GRAPH}> {
                ?org a core:Organization ;
                     core:ownedBy ?owner ;
                     core:createdAt ?createdAt .
                OPTIONAL { ?org rdfs:label ?lbl }
              }
            }
        `);

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

    async getOrganizationsForUser(userIri: string): Promise<OrganizationInfo[]> {
        const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            SELECT DISTINCT ?org ?lbl ?owner ?createdAt WHERE {
              GRAPH <${this.PROJECTS_GRAPH}> {
                ?org a core:Organization ;
                     core:ownedBy ?owner ;
                     core:createdAt ?createdAt .
                OPTIONAL { ?org rdfs:label ?lbl }
              }
              FILTER(?owner = <${userIri}>)
            }
        `);

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

    async getOrganizationMembers(orgIri: string): Promise<{ iri: string; label?: string }[]> {
        const data = await this.runSelect(`
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
        `);

        type Row = { u: { value: string }; lbl?: { value: string } };

        return (data.results.bindings as Row[]).map((row) => ({
            iri: row.u.value,
            label: row.lbl?.value,
        }));
    }

    async createOrganization(
        requesterIri: string,
        { label, ownerIri }: { label: string; ownerIri: string }
    ): Promise<string> {
        if (!(await this.isSuperAdmin(requesterIri))) {
            throw new ForbiddenException("Seuls les super‑admins peuvent créer une organisation");
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
                         rdfs:label """${escapeSparqlLiteral(label)}""" ;
                         core:ownedBy <${ownerIri}> ;
                         core:createdBy <${requesterIri}> ;
                         core:createdAt "${now}"^^xsd:dateTime .
              }
            }
        `;

        await this.runUpdate(update);
        this.invalidateOrganizationOwnership();
        this.invalidateUserGroups(ownerIri);
        if (ownerIri !== requesterIri) {
            try {
                await this.notifications.notifyOrganizationMembershipChange({
                    actorIri: requesterIri,
                    memberIri: ownerIri,
                    organizationIri: iri,
                    action: "add",
                });
            } catch (error) {
                console.error("Failed to notify organization owner assignment", error);
            }
        }
        return iri;
    }

    async updateOrganization(
        requesterIri: string,
        orgIri: string,
        { newLabel, newOwner }: { newLabel?: string; newOwner?: string }
    ): Promise<void> {
        if (!(await this.isSuperAdmin(requesterIri))) {
            throw new ForbiddenException("Seul un super‑admin peut modifier l’organisation");
        }

        let previousOwner: string | null = null;
        if (newOwner !== undefined) {
            const data = await this.runSelect(`
                PREFIX core: <${this.CORE}>
                SELECT ?o WHERE {
                  GRAPH <${this.PROJECTS_GRAPH}> {
                    <${orgIri}> core:ownedBy ?o .
                  }
                } LIMIT 1
            `);
            previousOwner = data?.results?.bindings?.[0]?.o?.value ?? null;
        }

        let deletePart = "";
        let insertPart = "";

        if (newLabel !== undefined) {
            deletePart += `<${orgIri}> rdfs:label ?l .\n`;
            insertPart += `<${orgIri}> rdfs:label """${escapeSparqlLiteral(newLabel)}""" .\n`;
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
            WHERE  { OPTIONAL { GRAPH <${this.PROJECTS_GRAPH}> { ${deletePart} } } }
        `;

        await this.runUpdate(update);
        this.invalidateOrganizationOwnership(orgIri);
        if (newOwner) this.invalidateUserGroups(newOwner);
        if (previousOwner && newOwner && previousOwner !== newOwner) {
            this.invalidateUserGroups(previousOwner);
            try {
                await this.notifications.notifyOrganizationOwnerChanged({
                    actorIri: requesterIri,
                    organizationIri: orgIri,
                    previousOwnerIri: previousOwner,
                    newOwnerIri: newOwner,
                });
            } catch (error) {
                console.error("Failed to notify organization owner change", error);
            }
        }
    }

    async deleteOrganization(requesterIri: string, orgIri: string): Promise<void> {
        if (!(await this.isSuperAdmin(requesterIri))) {
            throw new ForbiddenException("Seul un super‑admin peut supprimer une organisation");
        }
        const update = `DELETE WHERE { GRAPH <${this.PROJECTS_GRAPH}> { <${orgIri}> ?p ?o . } }`;
        await this.runUpdate(update);
        this.invalidateOrganizationOwnership(orgIri);
        this.invalidateUserGroups();
    }

    async addOrganizationMember(requesterIri: string, orgIri: string, userIri: string): Promise<void> {
        const allowed =
            (await this.isSuperAdmin(requesterIri)) ||
            (await this.isOrganizationOwner(requesterIri, orgIri));
        if (!allowed) {
            throw new ForbiddenException("Seul le super‑admin ou l’owner peut ajouter un membre");
        }

        const update = `
            PREFIX core: <${this.CORE}>
            INSERT DATA {
                GRAPH <${this.PROJECTS_GRAPH}> {
                    <${userIri}> core:belongsToOrganization <${orgIri}> .
                }
            }
        `;
        await this.runUpdate(update);
        this.invalidateOrganizationOwnership(orgIri);
        this.invalidateUserGroups(userIri);
        try {
            await this.notifications.notifyOrganizationMembershipChange({
                actorIri: requesterIri,
                memberIri: userIri,
                organizationIri: orgIri,
                action: "add",
            });
        } catch (error) {
            console.error("Failed to notify organization add", error);
        }
    }

    async removeOrganizationMember(requesterIri: string, orgIri: string, userIri: string): Promise<void> {
        const allowed =
            (await this.isSuperAdmin(requesterIri)) ||
            (await this.isOrganizationOwner(requesterIri, orgIri));
        if (!allowed) {
            throw new ForbiddenException("Seul le super-admin ou l’owner peut retirer un membre");
        }

        const update = `
            PREFIX core: <${this.CORE}>

            WITH <${this.PROJECTS_GRAPH}>
            DELETE { <${userIri}> core:belongsToOrganization <${orgIri}> . }
            WHERE  { <${userIri}> core:belongsToOrganization <${orgIri}> . } ;

            DELETE { ?grp core:hasMember <${userIri}> . }
            WHERE  {
              { ?grp core:inOrganization <${orgIri}> ; core:hasMember <${userIri}> . }
              UNION
              { GRAPH ?g { ?grp core:inOrganization <${orgIri}> ; core:hasMember <${userIri}> . } }
            } ;

            DELETE { ?ms core:member <${userIri}> ; core:group ?grp . }
            WHERE  {
              { ?grp core:inOrganization <${orgIri}> .
                ?ms  core:member <${userIri}> ; core:group ?grp . }
              UNION {
                GRAPH ?g {
                  ?grp core:inOrganization <${orgIri}> .
                  ?ms  core:member <${userIri}> ; core:group ?grp .
                }
              }
            }
        `;

        await this.runUpdate(update);
        this.invalidateOrganizationOwnership(orgIri);
        this.invalidateUserGroups(userIri);
        try {
            await this.notifications.notifyOrganizationMembershipChange({
                actorIri: requesterIri,
                memberIri: userIri,
                organizationIri: orgIri,
                action: "remove",
            });
        } catch (error) {
            console.error("Failed to notify organization removal", error);
        }
    }
}
