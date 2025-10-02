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

    private static readonly CACHE_TTL_MS = Number(process.env.ONTOLOGY_CACHE_TTL_MS ?? 10_000);

    private readonly userGroupsCache = new Map<string, CacheEntry<string[]>>();
    private readonly userRolesCache = new Map<string, CacheEntry<string[]>>();
    private readonly projectOwnerCache = new Map<string, CacheEntry<boolean>>();
    private readonly organizationOwnerCache = new Map<string, CacheEntry<boolean>>();
    private readonly groupOwnerCache = new Map<string, CacheEntry<boolean>>();
    private static readonly LANG_TAG_REGEX = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;

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
        const cached = this.getCachedValue(this.userGroupsCache, userIri);
        if (cached) return cached;

        const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            SELECT DISTINCT ?g WHERE {
              { ?g core:hasMember <${userIri}> }
              UNION { ?ms core:member <${userIri}> ; core:group ?g }
              UNION { GRAPH ?ng { ?g core:hasMember <${userIri}> } }
              UNION { GRAPH ?ng { ?ms core:member <${userIri}> ; core:group ?g } }
            }
        `);
        const groups = (data.results?.bindings ?? []).map((b: any) => b.g.value);
        this.setCachedValue(this.userGroupsCache, userIri, groups);
        return groups;
    }

    protected async getUserRoles(userIri: string): Promise<string[]> {
        const cached = this.getCachedValue(this.userRolesCache, userIri);
        if (cached) return cached;

        const data = await this.runSelect(`
            PREFIX core: <${this.CORE}>
            SELECT ?r WHERE {
              { <${userIri}> core:hasRole ?r }
              UNION { GRAPH ?g { <${userIri}> core:hasRole ?r } }
            }
        `);
        const roles = (data.results?.bindings ?? []).map((b: any) => b.r.value);
        this.setCachedValue(this.userRolesCache, userIri, roles);
        return roles;
    }

    protected async isSuperAdmin(userIri: string): Promise<boolean> {
        const roles = await this.getUserRoles(userIri);
        return roles.includes(this.ROLE_SUPER_ADMIN);
    }

    protected async isOrganizationOwner(userIri: string, organizationIri: string): Promise<boolean> {
        const cacheKey = this.makeCompositeKey(userIri, organizationIri);
        const cached = this.getCachedBoolean(this.organizationOwnerCache, cacheKey);
        if (cached !== undefined) return cached;

        const result = await this.runAsk(`
            PREFIX core: <${this.CORE}>
            ASK { GRAPH <${this.PROJECTS_GRAPH}> { <${organizationIri}> core:ownedBy <${userIri}> } }
        `);
        this.setCachedBoolean(this.organizationOwnerCache, cacheKey, result);
        return result;
    }

    protected async isProjectOwner(userIri: string, projectIri: string): Promise<boolean> {
        const cacheKey = this.makeCompositeKey(userIri, projectIri);
        const cached = this.getCachedBoolean(this.projectOwnerCache, cacheKey);
        if (cached !== undefined) return cached;

        const result = await this.runAsk(`
            PREFIX core: <${this.CORE}>
            ASK { GRAPH <${this.PROJECTS_GRAPH}> { <${projectIri}> core:createdBy <${userIri}> } }
        `);
        this.setCachedBoolean(this.projectOwnerCache, cacheKey, result);
        return result;
    }

    protected async isGroupOwner(userIri: string, groupIri: string): Promise<boolean> {
        const cacheKey = this.makeCompositeKey(userIri, groupIri);
        const cached = this.getCachedBoolean(this.groupOwnerCache, cacheKey);
        if (cached !== undefined) return cached;

        const result = await this.runAsk(`
            PREFIX core: <${this.CORE}>
            ASK {
              { <${groupIri}> core:createdBy <${userIri}> }
              UNION { GRAPH ?g { <${groupIri}> core:createdBy <${userIri}> } }
            }
        `);
        this.setCachedBoolean(this.groupOwnerCache, cacheKey, result);
        return result;
    }

    protected async individualExists(iri: string): Promise<boolean> {
        return this.runAsk(`ASK { GRAPH ?g { <${iri}> ?p ?o } }`);
    }

    protected async commentExistsInGraph(iri: string, graphIri: string): Promise<boolean> {
        return this.runAsk(`ASK { GRAPH <${graphIri}> { <${iri}> ?p ?o } }`);
    }

    protected resolveLang(preferred?: string, acceptLanguage?: string): string | undefined {
        const first = this.sanitizeLang(preferred);
        if (first) return first;
        if (!acceptLanguage) return undefined;
        for (const part of acceptLanguage.split(',')) {
            const value = part.split(';')[0]?.trim();
            const lang = this.sanitizeLang(value);
            if (lang) return lang;
        }
        return undefined;
    }

    protected buildLabelSelection(resourceVar: string, alias: string, preferredLang?: string): string {
        const safeAlias = alias.replace(/[^A-Za-z0-9_]/g, '');
        const chunks: string[] = [];
        const coalesceOrder: string[] = [];
        if (preferredLang) {
            chunks.push(`OPTIONAL { ${resourceVar} rdfs:label ?${safeAlias}Preferred . FILTER(LANGMATCHES(LANG(?${safeAlias}Preferred), "${preferredLang}")) }`);
            coalesceOrder.push(`?${safeAlias}Preferred`);
        }
        chunks.push(`OPTIONAL { ${resourceVar} rdfs:label ?${safeAlias}NoLang . FILTER(LANG(?${safeAlias}NoLang) = "") }`);
        coalesceOrder.push(`?${safeAlias}NoLang`);
        chunks.push(`OPTIONAL { ${resourceVar} rdfs:label ?${safeAlias}Any }`);
        coalesceOrder.push(`?${safeAlias}Any`);
        chunks.push(`BIND(COALESCE(${coalesceOrder.join(', ')}) AS ?${alias})`);
        chunks.push(`BIND(LANG(?${alias}) AS ?${alias}Lang)`);
        return chunks.join('\n');
    }

    protected sanitizeLang(lang?: string | null): string | undefined {
        if (!lang) return undefined;
        const trimmed = lang.trim();
        if (!trimmed) return undefined;
        const normalized = trimmed.toLowerCase();
        if (!OntologyBaseService.LANG_TAG_REGEX.test(normalized)) return undefined;
        return normalized;
    }

    protected async enforceWritePermission(userIri: string, ontologyIri: string): Promise<void> {
        if (await this.isSuperAdmin(userIri)) return;
        const isOwner = await this.isProjectOwner(userIri, ontologyIri);
        if (!isOwner) {
            throw new ForbiddenException("Accès refusé. Vous n'avez pas les droits d'écriture sur cette ontologie.");
        }
    }

    protected invalidateUserGroups(userIri?: string) {
        if (!userIri) {
            this.userGroupsCache.clear();
            return;
        }
        this.userGroupsCache.delete(userIri);
    }

    protected invalidateUserRoles(userIri?: string) {
        if (!userIri) {
            this.userRolesCache.clear();
            return;
        }
        this.userRolesCache.delete(userIri);
    }

    protected invalidateProjectOwnership(projectIri?: string) {
        this.invalidateCompositeCache(this.projectOwnerCache, projectIri);
    }

    protected invalidateOrganizationOwnership(organizationIri?: string) {
        this.invalidateCompositeCache(this.organizationOwnerCache, organizationIri);
    }

    protected invalidateGroupOwnership(groupIri?: string) {
        this.invalidateCompositeCache(this.groupOwnerCache, groupIri);
    }

    private getCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
        const entry = cache.get(key);
        if (!entry) return null;
        if (entry.expiresAt < Date.now()) {
            cache.delete(key);
            return null;
        }
        return entry.value;
    }

    private setCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
        cache.set(key, { value, expiresAt: Date.now() + OntologyBaseService.CACHE_TTL_MS });
    }

    private getCachedBoolean(cache: Map<string, CacheEntry<boolean>>, key: string): boolean | undefined {
        const entry = this.getCachedValue(cache, key);
        if (entry === null) return undefined;
        return entry;
    }

    private setCachedBoolean(cache: Map<string, CacheEntry<boolean>>, key: string, value: boolean): void {
        this.setCachedValue(cache, key, value);
    }

    private invalidateCompositeCache(cache: Map<string, CacheEntry<boolean>>, suffix?: string) {
        if (!suffix) {
            cache.clear();
            return;
        }
        const target = `::${suffix}`;
        for (const key of Array.from(cache.keys())) {
            if (key.endsWith(target)) {
                cache.delete(key);
            }
        }
    }

    private makeCompositeKey(...parts: string[]): string {
        return parts.join("::");
    }
}

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}
