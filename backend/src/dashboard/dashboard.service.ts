import { Injectable, ForbiddenException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { OntologyBaseService } from "../ontology/common/base-ontology.service";

type ScopeType = "all" | "ontology" | "organization" | "group";

type DashboardFilters = {
    start?: Date;
    end?: Date;
    scopeType?: ScopeType;
    scopeId?: string;
};

type OntologyMeta = {
    iri: string;
    label?: string;
    createdBy?: string;
    visibleTo: string[];
};

type GroupMeta = {
    iri: string;
    label?: string;
    organizationIri?: string;
    createdBy?: string;
    members: string[];
    createdAt?: string;
};

type OrganizationMeta = {
    iri: string;
    label?: string;
    owner?: string;
    createdAt?: string;
};

type IndividualEvent = {
    iri: string;
    ontologyIri: string;
    label?: string;
    classIri?: string;
    classLabel?: string;
    visibleTo?: string[];
    createdBy: string;
    createdAt?: string;
    updatedBy?: string;
    updatedAt?: string;
};

type CommentEvent = {
    iri: string;
    ontologyIri: string;
    onResource: string;
    body?: string;
    classIri?: string;
    classLabel?: string;
    createdBy: string;
    createdAt?: string;
    updatedBy?: string;
    updatedAt?: string;
    replyTo?: string;
};

type DashboardSection<T> = {
    data: T;
    meta?: Record<string, unknown>;
};

type CommentSummary = {
    comment: string;
    replies?: number;
    createdAt?: string;
    body?: string;
    onResource?: string;
    ontologyIri?: string;
    classIri?: string;
    classLabel?: string;
};

@Injectable()
export class DashboardService extends OntologyBaseService {
    constructor(httpService: HttpService) {
        super(httpService);
    }

    public async getDashboardSummary(userIri: string, filters: DashboardFilters) {
        const startIso = filters.start ? filters.start.toISOString() : undefined;
        const endIso = filters.end ? filters.end.toISOString() : undefined;

        const roles = await this.getUserRoles(userIri);
        const userGroups = await this.getUserGroups(userIri);
        const isSuperAdmin = roles.includes(this.ROLE_SUPER_ADMIN);
        const scopeType = filters.scopeType ?? "all";
        const scopeId = filters.scopeId;

        const ontologies = await this.listOntologyMeta();
        const organizations = await this.listOrganizationMeta();
        const groups = await this.listGroupMeta();

        const scoped = this.resolveScope({
            userIri,
            isSuperAdmin,
            userGroups,
            organizations,
            groups,
            ontologies,
            scopeType,
            scopeId,
        });

        const accessibleOntologies = scoped.ontologies;
        const accessibleGroups = scoped.groups;
        const accessibleOrganizations = scoped.organizations;

        const allowedGroups =
            scopeType === "group"
                ? accessibleGroups.map((g) => g.iri)
                : scopeType === "organization"
                    ? accessibleGroups.map((g) => g.iri)
                    : [];

        const individualEvents = await this.fetchIndividuals(accessibleOntologies, {
            viewerIri: userIri,
            viewerGroups: userGroups,
            isSuperAdmin,
            startIso,
            endIso,
            allowedGroups,
        });
        const commentEvents = await this.fetchComments(accessibleOntologies, {
            viewerIri: userIri,
            viewerGroups: userGroups,
            isSuperAdmin,
            startIso,
            endIso,
            allowedGroups,
        });

        const periodActiveAccounts = new Set<string>();
        individualEvents.forEach((ev) => {
            if (ev.createdBy) periodActiveAccounts.add(ev.createdBy);
            if (ev.updatedBy) periodActiveAccounts.add(ev.updatedBy);
        });
        commentEvents.forEach((ev) => {
            if (ev.createdBy) periodActiveAccounts.add(ev.createdBy);
            if (ev.updatedBy) periodActiveAccounts.add(ev.updatedBy);
        });

        const platform = this.buildPlatformSection({
            ontologies: accessibleOntologies,
            organizations: accessibleOrganizations,
            groups: accessibleGroups,
            individualEvents,
            commentEvents,
            activeAccounts: periodActiveAccounts,
        });

        const governance = this.buildGovernanceSection({
            userIri,
            groups: accessibleGroups,
            individualEvents,
            commentEvents,
            organizations: accessibleOrganizations,
        });

        const myActivity = this.buildMyActivitySection({
            userIri,
            individualEvents,
            commentEvents,
        });

        const comments = this.buildCommentsSection({
            commentEvents,
        });

        return {
            filters: {
                start: startIso,
                end: endIso,
                scopeType,
                scopeId,
            },
            platform,
            governance,
            myActivity,
            comments,
            meta: {
                accessibleOntologies: accessibleOntologies.length,
                accessibleGroups: accessibleGroups.length,
                accessibleOrganizations: accessibleOrganizations.length,
            },
        };
    }

    private resolveScope(params: {
        userIri: string;
        isSuperAdmin: boolean;
        userGroups: string[];
        organizations: OrganizationMeta[];
        groups: GroupMeta[];
        ontologies: OntologyMeta[];
        scopeType: ScopeType;
        scopeId?: string;
    }): { ontologies: OntologyMeta[]; groups: GroupMeta[]; organizations: OrganizationMeta[] } {
        const { scopeType, scopeId, isSuperAdmin, userIri, userGroups, organizations, groups, ontologies } = params;

        if (scopeType === "all" || !scopeId) {
            if (isSuperAdmin) {
                return { ontologies, groups, organizations };
            }
            // Non super-admin : restreindre aux ontologies visibles ou créées par l'utilisateur, groupes où il est membre.
            const filteredOntologies = ontologies.filter((o) => this.canSeeOntology(o, userIri, userGroups, isSuperAdmin));
            const filteredGroups = groups.filter((g) => g.members.includes(userIri));
            const orgFromGroups = new Set(filteredGroups.map((g) => g.organizationIri).filter(Boolean) as string[]);
            const filteredOrgs = organizations.filter((org) => orgFromGroups.has(org.iri) || org.owner === userIri);
            return { ontologies: filteredOntologies, groups: filteredGroups, organizations: filteredOrgs };
        }

        if (scopeType === "ontology") {
            const ontology = ontologies.find((o) => o.iri === scopeId);
            if (!ontology) {
                throw new ForbiddenException("Ontology not found or not accessible");
            }
            const allowed = isSuperAdmin || this.canSeeOntology(ontology, userIri, userGroups, isSuperAdmin);
            if (!allowed) {
                throw new ForbiddenException("Ontology not accessible");
            }
            return { ontologies: [ontology], groups, organizations };
        }

        if (scopeType === "group") {
            const group = groups.find((g) => g.iri === scopeId);
            if (!group) {
                throw new ForbiddenException("Group not found");
            }
            const allowed = isSuperAdmin || group.members.includes(userIri);
            if (!allowed) {
                throw new ForbiddenException("Group not accessible");
            }
            // Ontologies visibles par ce groupe
            const filteredOntologies = ontologies.filter((o) => o.visibleTo.includes(group.iri) || this.canSeeOntology(o, userIri, userGroups, isSuperAdmin));
            return {
                ontologies: filteredOntologies,
                groups: [group],
                organizations: organizations.filter((org) => org.iri === group.organizationIri),
            };
        }

        // scopeType === "organization"
        const organization = organizations.find((org) => org.iri === scopeId);
        if (!organization) {
            throw new ForbiddenException("Organization not found");
        }
        const isOwner = organization.owner === userIri;
        if (!isSuperAdmin && !isOwner) {
            throw new ForbiddenException("Organization not accessible");
        }
        const orgGroups = groups.filter((g) => g.organizationIri === organization.iri);
        const orgGroupIris = new Set(orgGroups.map((g) => g.iri));
        const filteredOntologies = ontologies.filter(
            (o) => o.visibleTo.some((g) => orgGroupIris.has(g)) || this.canSeeOntology(o, userIri, userGroups, isSuperAdmin)
        );
        return { ontologies: filteredOntologies, groups: orgGroups, organizations: [organization] };
    }

    private canSeeOntology(onto: OntologyMeta, userIri: string, userGroups: string[], isSuperAdmin: boolean): boolean {
        if (isSuperAdmin) return true;
        if (onto.createdBy === userIri) return true;
        if (onto.visibleTo.length === 0) return true;
        const userGroupSet = new Set(userGroups);
        return onto.visibleTo.some((g) => userGroupSet.has(g));
    }

    private dedupeIndividuals(list: IndividualEvent[]): IndividualEvent[] {
        const map = new Map<string, IndividualEvent>();
        list.forEach((ev) => {
            const existing = map.get(ev.iri);
            if (!existing) {
                map.set(ev.iri, { ...ev });
                return;
            }
            existing.label = existing.label ?? ev.label;
            existing.classIri = existing.classIri ?? ev.classIri;
            existing.classLabel = existing.classLabel ?? ev.classLabel;
            existing.updatedAt = existing.updatedAt ?? ev.updatedAt;
            existing.updatedBy = existing.updatedBy ?? ev.updatedBy;
        });
        return Array.from(map.values());
    }

    private dedupeComments(list: CommentEvent[]): CommentEvent[] {
        const map = new Map<string, CommentEvent>();
        list.forEach((ev) => {
            const existing = map.get(ev.iri);
            if (!existing) {
                map.set(ev.iri, { ...ev });
                return;
            }
            existing.body = existing.body ?? ev.body;
            existing.classIri = existing.classIri ?? ev.classIri;
            existing.classLabel = existing.classLabel ?? ev.classLabel;
            existing.updatedAt = existing.updatedAt ?? ev.updatedAt;
            existing.updatedBy = existing.updatedBy ?? ev.updatedBy;
        });
        return Array.from(map.values());
    }

    private async listOntologyMeta(): Promise<OntologyMeta[]> {
        const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?proj ?lbl ?creator ?vg WHERE {
              GRAPH <${this.PROJECTS_GRAPH}> {
                ?proj a core:OntologyProject .
                OPTIONAL { ?proj rdfs:label ?lbl }
                OPTIONAL { ?proj core:createdBy ?creator }
                OPTIONAL { ?proj core:visibleTo ?vg }
              }
            }
        `);

        type Row = { proj: { value: string }; lbl?: { value: string }; creator?: { value: string }; vg?: { value: string } };
        const map = new Map<string, OntologyMeta>();
        (data.results?.bindings as Row[]).forEach((row) => {
            const iri = row.proj.value;
            if (!map.has(iri)) {
                map.set(iri, { iri, label: row.lbl?.value, createdBy: row.creator?.value, visibleTo: [] });
            }
            if (row.lbl?.value) map.get(iri)!.label = row.lbl.value;
            if (row.creator?.value) map.get(iri)!.createdBy = row.creator.value;
            if (row.vg?.value && !map.get(iri)!.visibleTo.includes(row.vg.value)) {
                map.get(iri)!.visibleTo.push(row.vg.value);
            }
        });
        return Array.from(map.values());
    }

    private async listGroupMeta(): Promise<GroupMeta[]> {
        const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?g ?lbl ?org ?member ?creator ?createdAt WHERE {
              ?g a core:Group .
              OPTIONAL { ?g rdfs:label ?lbl }
              OPTIONAL { ?g core:inOrganization ?org }
              OPTIONAL { ?g core:hasMember ?member }
              OPTIONAL { ?g core:createdBy ?creator }
              OPTIONAL { ?g core:createdAt ?createdAt }
            }
        `);

        type Row = {
            g: { value: string };
            lbl?: { value: string };
            org?: { value: string };
            member?: { value: string };
            creator?: { value: string };
            createdAt?: { value: string };
        };

        const map = new Map<string, GroupMeta>();
        (data.results?.bindings as Row[]).forEach((row) => {
            const iri = row.g.value;
            if (!map.has(iri)) {
                map.set(iri, {
                    iri,
                    label: row.lbl?.value,
                    organizationIri: row.org?.value,
                    createdBy: row.creator?.value,
                    members: [],
                    createdAt: row.createdAt?.value,
                });
            }
            const entry = map.get(iri)!;
            if (row.member?.value && !entry.members.includes(row.member.value)) {
                entry.members.push(row.member.value);
            }
            if (row.org?.value) entry.organizationIri = row.org.value;
            if (row.lbl?.value) entry.label = row.lbl.value;
            if (row.creator?.value) entry.createdBy = row.creator.value;
            if (row.createdAt?.value) entry.createdAt = row.createdAt.value;
        });
        return Array.from(map.values());
    }

    private async listOrganizationMeta(): Promise<OrganizationMeta[]> {
        const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?org ?lbl ?owner ?createdAt WHERE {
              GRAPH <${this.PROJECTS_GRAPH}> {
                ?org a core:Organization .
                OPTIONAL { ?org rdfs:label ?lbl }
                OPTIONAL { ?org core:ownedBy ?owner }
                OPTIONAL { ?org core:createdAt ?createdAt }
              }
            }
        `);

        type Row = {
            org: { value: string };
            lbl?: { value: string };
            owner?: { value: string };
            createdAt?: { value: string };
        };

        return (data.results?.bindings as Row[]).map((row) => ({
            iri: row.org.value,
            label: row.lbl?.value,
            owner: row.owner?.value,
            createdAt: row.createdAt?.value,
        }));
    }

    private async fetchIndividuals(
        ontologies: OntologyMeta[],
        params: {
            viewerIri: string;
            viewerGroups: string[];
            isSuperAdmin: boolean;
            startIso?: string;
            endIso?: string;
            allowedGroups?: string[];
        }
    ): Promise<IndividualEvent[]> {
        if (ontologies.length === 0) return [];
        const values = ontologies.map((o) => `<${o.iri}>`).join(" ");
        const effectiveViewerGroups =
            params.isSuperAdmin || (params.viewerGroups.length === 0 && (!params.allowedGroups || params.allowedGroups.length === 0))
                ? []
                : Array.from(new Set([...(params.viewerGroups ?? []), ...(params.allowedGroups ?? [])]));
        const aclFilter =
            params.isSuperAdmin || effectiveViewerGroups.length === 0
                ? ""
                : `OPTIONAL { ?s core:visibleTo ?vg }
                   FILTER(!BOUND(?vg) || ?vg IN (${effectiveViewerGroups.map((g) => `<${g}>`).join(", ")}) || ?createdBy = <${params.viewerIri}>)`;
        const scopeGroups = params.allowedGroups && params.allowedGroups.length > 0 ? params.allowedGroups : [];
        const scopeFilter =
            scopeGroups.length > 0
                ? `OPTIONAL { ?s core:visibleTo ?vgScope }
                   FILTER(!BOUND(?vgScope) || ?vgScope IN (${scopeGroups.map((g) => `<${g}>`).join(", ")}))`
                : "";

        const createdFilter = params.startIso
            ? `FILTER(?createdAt >= "${params.startIso}"^^xsd:dateTime)`
            : "";
        const endFilter = params.endIso ? `FILTER(?createdAt <= "${params.endIso}"^^xsd:dateTime)` : "";
        const updateStart = params.startIso ? `FILTER(!BOUND(?updatedAt) || ?updatedAt >= "${params.startIso}"^^xsd:dateTime)` : "";
        const updateEnd = params.endIso ? `FILTER(!BOUND(?updatedAt) || ?updatedAt <= "${params.endIso}"^^xsd:dateTime)` : "";

        const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX xsd: <${this.XSD}>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX owl:  <http://www.w3.org/2002/07/owl#>
            SELECT ?g ?s ?sLabel ?cls ?clsLabel ?createdBy ?createdAt ?updatedBy ?updatedAt WHERE {
              VALUES ?g { ${values} }
              GRAPH ?g {
                ?s core:inProject ?g ;
                   core:createdBy ?createdBy ;
                   core:createdAt ?createdAt .
                OPTIONAL { ?s core:updatedBy ?updatedBy }
                OPTIONAL { ?s core:updatedAt ?updatedAt }
                OPTIONAL { ?s rdfs:label ?sLabel }
                OPTIONAL { ?s rdf:type ?cls FILTER(?cls != owl:NamedIndividual) }
                OPTIONAL { ?cls rdfs:label ?clsLabel }
                ${aclFilter}
                ${scopeFilter}
                ${createdFilter}
                ${endFilter}
                ${updateStart}
                ${updateEnd}
              }
            }
        `);

        type Row = {
            g: { value: string };
            s: { value: string };
            sLabel?: { value: string };
            cls?: { value: string };
            clsLabel?: { value: string };
            createdBy: { value: string };
            createdAt?: { value: string };
            updatedBy?: { value: string };
            updatedAt?: { value: string };
        };

        const mapped = (data.results?.bindings as Row[]).map((row) => ({
            iri: row.s.value,
            ontologyIri: row.g.value,
            label: row.sLabel?.value,
            classIri: row.cls?.value,
            classLabel: row.clsLabel?.value,
            createdBy: row.createdBy.value,
            createdAt: row.createdAt?.value,
            updatedBy: row.updatedBy?.value,
            updatedAt: row.updatedAt?.value,
        }));
        return this.dedupeIndividuals(mapped);
    }

    private async fetchComments(
        ontologies: OntologyMeta[],
        params: {
            viewerIri: string;
            viewerGroups: string[];
            isSuperAdmin: boolean;
            startIso?: string;
            endIso?: string;
            allowedGroups?: string[];
        }
    ): Promise<CommentEvent[]> {
        if (ontologies.length === 0) return [];
        const values = ontologies.map((o) => `<${o.iri}>`).join(" ");
        const effectiveViewerGroups =
            params.isSuperAdmin || (params.viewerGroups.length === 0 && (!params.allowedGroups || params.allowedGroups.length === 0))
                ? []
                : Array.from(new Set([...(params.viewerGroups ?? []), ...(params.allowedGroups ?? [])]));
        const aclFilter =
            params.isSuperAdmin || effectiveViewerGroups.length === 0
                ? ""
                : `OPTIONAL { ?c core:visibleTo ?vg }
                   FILTER(!BOUND(?vg) || ?vg IN (${effectiveViewerGroups.map((g) => `<${g}>`).join(", ")}) || ?createdBy = <${params.viewerIri}>)`;
        const scopeGroups = params.allowedGroups && params.allowedGroups.length > 0 ? params.allowedGroups : [];
        const scopeFilter =
            scopeGroups.length > 0
                ? `OPTIONAL { ?on core:visibleTo ?vgScope }
                   FILTER(!BOUND(?vgScope) || ?vgScope IN (${scopeGroups.map((g) => `<${g}>`).join(", ")}))`
                : "";

        const createdFilter = params.startIso
            ? `FILTER(?createdAt >= "${params.startIso}"^^xsd:dateTime)`
            : "";
        const endFilter = params.endIso ? `FILTER(?createdAt <= "${params.endIso}"^^xsd:dateTime)` : "";
        const updateStart = params.startIso ? `FILTER(!BOUND(?updatedAt) || ?updatedAt >= "${params.startIso}"^^xsd:dateTime)` : "";
        const updateEnd = params.endIso ? `FILTER(!BOUND(?updatedAt) || ?updatedAt <= "${params.endIso}"^^xsd:dateTime)` : "";

        const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX xsd: <${this.XSD}>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?g ?c ?on ?body ?cls ?clsLabel ?createdBy ?createdAt ?updatedBy ?updatedAt ?replyTo WHERE {
              VALUES ?g { ${values} }
              GRAPH ?g {
                ?c a core:Comment ;
                   core:onResource ?on ;
                   core:createdBy ?createdBy ;
                   core:createdAt ?createdAt .
                OPTIONAL { ?c core:body ?body }
                OPTIONAL { ?c core:updatedBy ?updatedBy }
                OPTIONAL { ?c core:updatedAt ?updatedAt }
                OPTIONAL { ?c core:replyTo ?replyTo }
                OPTIONAL { ?on rdf:type ?cls }
                OPTIONAL { ?cls rdfs:label ?clsLabel }
                ${aclFilter}
                ${scopeFilter}
                ${createdFilter}
                ${endFilter}
                ${updateStart}
                ${updateEnd}
              }
            }
        `);

        type Row = {
            g: { value: string };
            c: { value: string };
            on: { value: string };
            body?: { value: string };
            cls?: { value: string };
            clsLabel?: { value: string };
            createdBy: { value: string };
            createdAt?: { value: string };
            updatedBy?: { value: string };
            updatedAt?: { value: string };
            replyTo?: { value: string };
        };

        const mapped = (data.results?.bindings as Row[]).map((row) => ({
            iri: row.c.value,
            ontologyIri: row.g.value,
            onResource: row.on.value,
            body: row.body?.value,
            classIri: row.cls?.value,
            classLabel: row.clsLabel?.value,
            createdBy: row.createdBy.value,
            createdAt: row.createdAt?.value,
            updatedBy: row.updatedBy?.value,
            updatedAt: row.updatedAt?.value,
            replyTo: row.replyTo?.value,
        }));
        return this.dedupeComments(mapped);
    }

    private buildPlatformSection(params: {
        ontologies: OntologyMeta[];
        organizations: OrganizationMeta[];
        groups: GroupMeta[];
        individualEvents: IndividualEvent[];
        commentEvents: CommentEvent[];
        activeAccounts: Set<string>;
    }): DashboardSection<any> {
        const { ontologies, organizations, groups, individualEvents, commentEvents, activeAccounts } = params;
        const contributionsByUser = new Map<string, number>();
        individualEvents.forEach((ev) => {
            contributionsByUser.set(ev.createdBy, (contributionsByUser.get(ev.createdBy) || 0) + 1);
            if (ev.updatedBy) {
                contributionsByUser.set(ev.updatedBy, (contributionsByUser.get(ev.updatedBy) || 0) + 1);
            }
        });
        commentEvents.forEach((ev) => {
            contributionsByUser.set(ev.createdBy, (contributionsByUser.get(ev.createdBy) || 0) + 1);
            if (ev.updatedBy) {
                contributionsByUser.set(ev.updatedBy, (contributionsByUser.get(ev.updatedBy) || 0) + 1);
            }
        });

        const topContributors = Array.from(contributionsByUser.entries())
            .map(([user, score]) => ({ user, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        const activity = {
            individualsCreated: individualEvents.length,
            commentsCreated: commentEvents.length,
            updates: individualEvents.filter((ev) => ev.updatedAt).length + commentEvents.filter((ev) => ev.updatedAt).length,
        };

        const projectHealth = {
            individualGrowth: individualEvents.length,
            commentGrowth: commentEvents.length,
        };

        return {
            data: {
                kpis: {
                    ontologies: ontologies.length,
                    organizations: organizations.length,
                    groups: groups.length,
                    activeAccounts: activeAccounts.size,
                },
                activity,
                topContributors,
                projectHealth,
            },
        };
    }

    private buildGovernanceSection(params: {
        userIri: string;
        groups: GroupMeta[];
        organizations: OrganizationMeta[];
        individualEvents: IndividualEvent[];
        commentEvents: CommentEvent[];
    }): DashboardSection<any> {
        const { groups, individualEvents, commentEvents, organizations } = params;

        const activeMembers = new Set<string>();
        individualEvents.forEach((ev) => {
            activeMembers.add(ev.createdBy);
            if (ev.updatedBy) activeMembers.add(ev.updatedBy);
        });
        commentEvents.forEach((ev) => {
            activeMembers.add(ev.createdBy);
            if (ev.updatedBy) activeMembers.add(ev.updatedBy);
        });

        const repliesPerComment = new Map<string, number>();
        commentEvents.forEach((ev) => {
            if (ev.replyTo) {
                repliesPerComment.set(ev.replyTo, (repliesPerComment.get(ev.replyTo) || 0) + 1);
            }
        });

        const resourceOntology = new Map<string, string>();
        const resourceLabel = new Map<string, string | undefined>();
        const resourceClass = new Map<string, { iri?: string; label?: string }>();
        const interactionsByIndividual = new Map<string, number>();

        commentEvents.forEach((ev) => {
            interactionsByIndividual.set(ev.onResource, (interactionsByIndividual.get(ev.onResource) || 0) + 1);
            resourceOntology.set(ev.onResource, ev.ontologyIri);
            if (ev.classIri || ev.classLabel) resourceClass.set(ev.onResource, { iri: ev.classIri, label: ev.classLabel });
        });
        individualEvents.forEach((ev) => {
            interactionsByIndividual.set(ev.iri, (interactionsByIndividual.get(ev.iri) || 0) + 1);
            resourceOntology.set(ev.iri, ev.ontologyIri);
            if (ev.label) resourceLabel.set(ev.iri, ev.label);
            if (ev.classIri || ev.classLabel) resourceClass.set(ev.iri, { iri: ev.classIri, label: ev.classLabel });
        });

        const commentIndex = new Map<string, CommentEvent>();
        commentEvents.forEach((ev) => commentIndex.set(ev.iri, ev));

        const topThreads = Array.from(repliesPerComment.entries())
            .map(([comment, replies]) => {
                const base = commentIndex.get(comment);
                return {
                    comment,
                    replies,
                    onResource: base?.onResource,
                    ontologyIri: base?.ontologyIri,
                    body: base?.body,
                };
            })
            .sort((a, b) => b.replies - a.replies)
            .slice(0, 5);

        const topIndividuals = Array.from(interactionsByIndividual.entries())
            .map(([iri, score]) => ({
                iri,
                score,
                ontologyIri: resourceOntology.get(iri),
                label: resourceLabel.get(iri),
                classIri: resourceClass.get(iri)?.iri,
                classLabel: resourceClass.get(iri)?.label,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        const classActivity = new Map<string, { score: number; label?: string; ontologyIri?: string }>();
        individualEvents.forEach((ev) => {
            if (!ev.classIri) return;
            const prev = classActivity.get(ev.classIri) ?? { score: 0, label: ev.classLabel, ontologyIri: ev.ontologyIri };
            prev.score += 1;
            if (ev.classLabel) prev.label = ev.classLabel;
            prev.ontologyIri = prev.ontologyIri ?? ev.ontologyIri;
            classActivity.set(ev.classIri, prev);
        });
        commentEvents.forEach((ev) => {
            if (!ev.classIri) return;
            const prev = classActivity.get(ev.classIri) ?? { score: 0, label: ev.classLabel, ontologyIri: ev.ontologyIri };
            prev.score += 1;
            if (ev.classLabel) prev.label = ev.classLabel;
            prev.ontologyIri = prev.ontologyIri ?? ev.ontologyIri;
            classActivity.set(ev.classIri, prev);
        });
        const topClasses = Array.from(classActivity.entries())
            .map(([iri, info]) => ({ iri, score: info.score, label: info.label, ontologyIri: info.ontologyIri }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        const topUsers = this.buildTopUsers(individualEvents, commentEvents, 5);

        return {
            data: {
                kpis: {
                    groups: groups.length,
                    organizations: organizations.length,
                    activeMembers: activeMembers.size,
                    recentComments: commentEvents.length,
                },
                topUsers,
                topThreads,
                topIndividuals,
                topClasses,
            },
        };
    }

    private buildMyActivitySection(params: { userIri: string; individualEvents: IndividualEvent[]; commentEvents: CommentEvent[] }): DashboardSection<any> {
        const mineIndividuals = params.individualEvents.filter(
            (ev) => ev.createdBy === params.userIri || ev.updatedBy === params.userIri
        );
        const mineComments = params.commentEvents.filter((ev) => ev.createdBy === params.userIri || ev.updatedBy === params.userIri);

        const lastIndividuals = [...mineIndividuals]
            .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""))
            .slice(0, 5)
            .map((ev) => ({
                iri: ev.iri,
                ontologyIri: ev.ontologyIri,
                label: ev.label,
                updatedAt: ev.updatedAt,
                createdAt: ev.createdAt,
            }));
        const lastComments = [...mineComments]
            .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""))
            .slice(0, 5)
            .map((ev) => ({
                iri: ev.iri,
                body: ev.body,
                ontologyIri: ev.ontologyIri,
                onResource: ev.onResource,
                createdAt: ev.createdAt,
                updatedAt: ev.updatedAt,
            }));

        return {
            data: {
                kpis: {
                    createdOrEdited: mineIndividuals.length,
                    comments: mineComments.length,
                },
                lastIndividuals,
                lastComments,
            },
        };
    }

    private buildCommentsSection(params: { commentEvents: CommentEvent[] }): DashboardSection<any> {
        const { commentEvents } = params;
        const repliesPerComment = new Map<string, number>();
        commentEvents.forEach((ev) => {
            if (ev.replyTo) {
                repliesPerComment.set(ev.replyTo, (repliesPerComment.get(ev.replyTo) || 0) + 1);
            }
        });

        const commentIndex = new Map<string, CommentEvent>();
        commentEvents.forEach((ev) => commentIndex.set(ev.iri, ev));

        const toSummary = (comment: string, replies?: number): CommentSummary => {
            const base = commentIndex.get(comment);
            return {
                comment,
                replies,
                createdAt: base?.createdAt,
                body: base?.body,
                onResource: base?.onResource,
                ontologyIri: base?.ontologyIri,
                classIri: base?.classIri,
                classLabel: base?.classLabel,
            };
        };

        const topThreads = Array.from(repliesPerComment.entries())
            .map(([comment, replies]) => toSummary(comment, replies))
            .sort((a, b) => (b.replies || 0) - (a.replies || 0))
            .slice(0, 10);

        const threadsWithoutReply = commentEvents
            .filter((ev) => !ev.replyTo && !repliesPerComment.has(ev.iri))
            .map((ev) => toSummary(ev.iri, 0));

        const recentThreads = commentEvents
            .filter((ev) => !ev.replyTo)
            .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
            .slice(0, 10)
            .map((ev) => toSummary(ev.iri, repliesPerComment.get(ev.iri)));

        return {
            data: {
                topThreads,
                threadsWithoutReply,
                recentThreads,
            },
        };
    }

    private buildTopUsers(individualEvents: IndividualEvent[], commentEvents: CommentEvent[], limit: number) {
        const contributions = new Map<string, number>();
        individualEvents.forEach((ev) => {
            contributions.set(ev.createdBy, (contributions.get(ev.createdBy) || 0) + 1);
            if (ev.updatedBy) contributions.set(ev.updatedBy, (contributions.get(ev.updatedBy) || 0) + 1);
        });
        commentEvents.forEach((ev) => {
            contributions.set(ev.createdBy, (contributions.get(ev.createdBy) || 0) + 1);
            if (ev.updatedBy) contributions.set(ev.updatedBy, (contributions.get(ev.updatedBy) || 0) + 1);
        });
        return Array.from(contributions.entries())
            .map(([user, score]) => ({ user, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
}
