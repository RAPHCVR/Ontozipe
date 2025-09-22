import { Injectable, ForbiddenException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";

@Injectable()
export abstract class OntologyBaseService {
    protected readonly fusekiBase: string;
    protected readonly fusekiUrl: string;
    protected readonly fusekiUpdateUrl: string;
    protected readonly CORE = "http://example.org/core#";
    protected readonly XSD = "http://www.w3.org/2001/XMLSchema#";
    protected readonly PROJECTS_GRAPH: string;
    protected readonly ROLE_SUPER_ADMIN: string;
    protected readonly ROLE_ADMIN: string;
    protected readonly ROLE_REGULAR: string;

    protected readonly adminAuth = {
        username: process.env.FUSEKI_USER || "admin",
        password: process.env.FUSEKI_PASSWORD || "Pass123",
    };

    protected constructor(protected readonly httpService: HttpService) {
        this.fusekiBase = (process.env.FUSEKI_URL ?? "http://fuseki:3030/autonomy").replace(/\/$/, "");
        this.fusekiUrl = `${this.fusekiBase}/sparql`;
        this.fusekiUpdateUrl = `${this.fusekiBase}/update`;
        this.PROJECTS_GRAPH = `${this.fusekiBase}#projects`;
        this.ROLE_SUPER_ADMIN = `${this.CORE}SuperAdminRole`;
        this.ROLE_ADMIN = `${this.CORE}AdminRole`;
        this.ROLE_REGULAR = `${this.CORE}RegularRole`;
    }

    protected async runUpdate(update: string): Promise<void> {
        await lastValueFrom(
            this.httpService.post(
                this.fusekiUpdateUrl,
                new URLSearchParams({ update }),
                { auth: this.adminAuth }
            )
        );
    }

    protected async runSelect(query: string): Promise<any> {
        const params = new URLSearchParams({
            query,
            format: "application/sparql-results+json",
        });
        const { data } = await lastValueFrom(this.httpService.get(this.fusekiUrl, { params }));
        return data;
    }

    protected async runAsk(query: string): Promise<boolean> {
        const params = new URLSearchParams({ query });
        const { data } = await lastValueFrom(this.httpService.get(this.fusekiUrl, { params }));
        return Boolean(data.boolean);
    }

    protected async getUserGroups(userIri: string): Promise<string[]> {
        const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            SELECT DISTINCT ?g WHERE {
              { ?g core:hasMember <${userIri}> }
              UNION { ?ms core:member <${userIri}> ; core:group ?g }
              UNION { GRAPH ?ng { ?g core:hasMember <${userIri}> } }
              UNION { GRAPH ?ng { ?ms core:member <${userIri}> ; core:group ?g } }
            }
        `);
        return (data.results?.bindings ?? []).map((b: any) => b.g.value);
    }

    protected async getUserRoles(userIri: string): Promise<string[]> {
        const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            SELECT ?r WHERE {
              { <${userIri}> core:hasRole ?r }
              UNION { GRAPH ?g { <${userIri}> core:hasRole ?r } }
            }
        `);
        return (data.results?.bindings ?? []).map((b: any) => b.r.value);
    }

    protected async isSuperAdmin(userIri: string): Promise<boolean> {
        const roles = await this.getUserRoles(userIri);
        return roles.includes(this.ROLE_SUPER_ADMIN);
    }

    protected async isOrganizationOwner(userIri: string, organizationIri: string): Promise<boolean> {
        return this.runAsk(`
            PREFIX core: <${this.CORE}>
            ASK { GRAPH <${this.PROJECTS_GRAPH}> { <${organizationIri}> core:ownedBy <${userIri}> } }
        `);
    }

    protected async isProjectOwner(userIri: string, projectIri: string): Promise<boolean> {
        return this.runAsk(`
            PREFIX core: <${this.CORE}>
            ASK { GRAPH <${this.PROJECTS_GRAPH}> { <${projectIri}> core:createdBy <${userIri}> } }
        `);
    }

    protected async isGroupOwner(userIri: string, groupIri: string): Promise<boolean> {
        return this.runAsk(`
            PREFIX core: <${this.CORE}>
            ASK {
              { <${groupIri}> core:createdBy <${userIri}> }
              UNION { GRAPH ?g { <${groupIri}> core:createdBy <${userIri}> } }
            }
        `);
    }

    protected async individualExists(iri: string): Promise<boolean> {
        return this.runAsk(`ASK { GRAPH ?g { <${iri}> ?p ?o } }`);
    }

    protected async commentExistsInGraph(iri: string, graphIri: string): Promise<boolean> {
        return this.runAsk(`ASK { GRAPH <${graphIri}> { <${iri}> ?p ?o } }`);
    }

    protected async enforceWritePermission(userIri: string, ontologyIri: string): Promise<void> {
        if (await this.isSuperAdmin(userIri)) return;
        const isOwner = await this.isProjectOwner(userIri, ontologyIri);
        if (!isOwner) {
            throw new ForbiddenException("Accès refusé. Vous n'avez pas les droits d'écriture sur cette ontologie.");
        }
    }
}
