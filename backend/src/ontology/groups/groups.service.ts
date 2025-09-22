import { Injectable, ForbiddenException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";

import { OntologyBaseService } from "../common/base-ontology.service";
import { GroupInfo } from "../common/types";
import { escapeSparqlLiteral } from "../../utils/sparql.utils";

@Injectable()
export class GroupsService extends OntologyBaseService {
    constructor(httpService: HttpService) {
        super(httpService);
    }

    async getGroups(userIri: string): Promise<GroupInfo[]> {
        const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?g ?lbl ?creator ?member ?org WHERE {
              ?g a core:Group ;
                 core:createdBy ?creator .
              <${userIri}> ^core:hasMember ?g .
              OPTIONAL { ?g rdfs:label ?lbl }
              OPTIONAL { ?g core:hasMember ?member }
              OPTIONAL { ?g core:inOrganization ?org }
            }
        `);

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
                const entry = map.get(iri)!;
                if (!entry.members.includes(row.member.value)) {
                    entry.members.push(row.member.value);
                }
            }
            if (row.org?.value) {
                map.get(iri)!.organizationIri = row.org.value;
            }
        });

        return Array.from(map.values()).sort((a, b) =>
            (a.label || a.iri).localeCompare(b.label || b.iri)
        );
    }

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
            rdfs:label """${escapeSparqlLiteral(label)}""" ;
            core:inOrganization <${organizationIri}> ;
            core:createdBy <${creatorIri}> ;
            core:createdAt "${new Date().toISOString()}"^^xsd:dateTime .\n`;
        for (const member of members) {
            triples += `<${iri}> core:hasMember <${member}> .\n`;
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

    async addGroupMember(requesterIri: string, groupIri: string, memberIri: string): Promise<void> {
        if (!(await this.isGroupOwner(requesterIri, groupIri))) {
            throw new ForbiddenException("Vous n’êtes pas propriétaire de ce groupe");
        }
        const update = `
            PREFIX core: <${this.CORE}>
            INSERT DATA { <${groupIri}> core:hasMember <${memberIri}> . }
        `;
        await this.runUpdate(update);
    }

    async removeGroupMember(requesterIri: string, groupIri: string, memberIri: string): Promise<void> {
        if (!(await this.isGroupOwner(requesterIri, groupIri))) {
            throw new ForbiddenException("Vous n’êtes pas propriétaire de ce groupe");
        }
        const update = `
            PREFIX core: <${this.CORE}>
            DELETE DATA { <${groupIri}> core:hasMember <${memberIri}> . }
        `;
        await this.runUpdate(update);
    }

    async updateGroupLabel(requesterIri: string, groupIri: string, newLabel?: string): Promise<void> {
        if (!(await this.isGroupOwner(requesterIri, groupIri))) {
            throw new ForbiddenException("Vous n’êtes pas propriétaire de ce groupe");
        }
        if (newLabel === undefined) return;

        const update = `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            DELETE { <${groupIri}> rdfs:label ?l . }
            INSERT { <${groupIri}> rdfs:label """${escapeSparqlLiteral(newLabel)}""" . }
            WHERE  { OPTIONAL { <${groupIri}> rdfs:label ?l . } }
        `;
        await this.runUpdate(update);
    }

    async updateGroupOrganization(requesterIri: string, groupIri: string, newOrgIri: string): Promise<void> {
        if (!(await this.isGroupOwner(requesterIri, groupIri))) {
            throw new ForbiddenException("Vous n’êtes pas propriétaire de ce groupe");
        }
        const update = `
            PREFIX core: <${this.CORE}>
            DELETE { <${groupIri}> core:inOrganization ?o . }
            INSERT { <${groupIri}> core:inOrganization <${newOrgIri}> . }
            WHERE  { OPTIONAL { <${groupIri}> core:inOrganization ?o . } }
        `;
        await this.runUpdate(update);
    }

    async deleteGroup(requesterIri: string, groupIri: string): Promise<void> {
        if (!(await this.isGroupOwner(requesterIri, groupIri))) {
            throw new ForbiddenException("Vous n’êtes pas propriétaire de ce groupe");
        }
        const update = `DELETE WHERE { <${groupIri}> ?p ?o . }`;
        await this.runUpdate(update);
    }
}

