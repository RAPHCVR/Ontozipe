import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { escapeSparqlLiteral } from "../utils/sparql.utils";

const CORE = "http://example.org/core#";
const FOAF = "http://xmlns.com/foaf/0.1/";

interface UserAccountRow {
    userIri: string;
    accountIri: string | null;
    hash?: string | null;
    email?: string | null;
    isVerified?: string | null;
    name?: string | null;
    avatar?: string | null;
    roles?: string[];
}

@Injectable()
export class AuthService {
    private readonly fusekiBase = (
        process.env.FUSEKI_URL ?? "http://fuseki:3030/autonomy"
    ).replace(/\/$/, "");
    private readonly fusekiUrl = `${this.fusekiBase}/sparql`;
    private readonly fusekiUpdate = `${this.fusekiBase}/update`;
    private FUSEKI_USER = process.env.FUSEKI_USER || "admin";
    private FUSEKI_PASS = process.env.FUSEKI_PASSWORD || "Pass123";
    private JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

    constructor(private readonly http: HttpService) {}

    /** ---------- Utils ---------- */
    private async askBoolean(ask: string): Promise<boolean> {
        const params = new URLSearchParams({ query: ask });
        const res = await lastValueFrom(
            this.http.get(this.fusekiUrl, {
                params,
                headers: { Accept: "application/sparql-results+json" },
            })
        );
        return res.data.boolean === true;
    }

    private async runUpdate(update: string) {
        await lastValueFrom(
            this.http.post(this.fusekiUpdate, new URLSearchParams({ update }), {
                auth: { username: this.FUSEKI_USER, password: this.FUSEKI_PASS },
            })
        );
    }

    private iriFromEmail(email: string) {
        return `http://example.org/user/${encodeURIComponent(email)}`;
    }

    private normalizeEmail(email: string): string {
        return email.trim().toLowerCase();
    }

    private async userExistsWithEmail(email: string): Promise<boolean> {
        const normalized = this.normalizeEmail(email);
        const ask = `PREFIX core: <${CORE}>
            ASK { ?u core:email """${escapeSparqlLiteral(normalized)}""" }`;
        return this.askBoolean(ask);
    }

    /** RÃƒÆ’Ã‚Â©cupÃƒÆ’Ã‚Â¨re la liste des rÃƒÆ’Ã‚Â´les d'un utilisateur de maniÃƒÆ’Ã‚Â¨re efficace. */
    private async _getUserRoles(userIri: string): Promise<string[]> {
        const sparql = `
            PREFIX core: <${CORE}>
            SELECT ?role WHERE { <${userIri}> core:hasRole ?role . }
        `;
        const params = new URLSearchParams({ query: sparql });
        const res = await lastValueFrom(this.http.get(this.fusekiUrl, {
            params,
            headers: { "Accept": "application/sparql-results+json" }
        }));
        return res.data.results.bindings.map((b: any) => b.role.value);
    }

    async isSuperAdmin(userIri: string): Promise<boolean> {
        const roles = await this._getUserRoles(userIri);
        return roles.includes(`${CORE}SuperAdminRole`);
    }

    private async assertSuperAdmin(userIri: string) {
        if (!(await this.isSuperAdmin(userIri))) {
            throw new ForbiddenException("Super admin role required");
        }
    }

    private async fetchLocalAccountByEmail(email: string): Promise<UserAccountRow | null> {
        const normalized = this.normalizeEmail(email);
        const sparql = `
            PREFIX core: <${CORE}>
            PREFIX foaf: <${FOAF}>
            SELECT ?user ?acc ?hash ?storedEmail ?verified ?name ?avatar (GROUP_CONCAT(?role;separator="||") AS ?roles)
            WHERE {
              ?user a core:User ;
                    core:email ?storedEmail .
              FILTER(LCASE(STR(?storedEmail)) = LCASE("${escapeSparqlLiteral(normalized)}"))
              OPTIONAL { ?user foaf:name ?name }
              OPTIONAL { ?user foaf:img ?avatar }
              OPTIONAL { ?user core:isVerified ?verified }
              OPTIONAL {
                ?user core:hasAccount ?acc .
                ?acc core:provider "local" ;
                     core:email ?accEmail .
                OPTIONAL { ?acc core:hashedPwd ?hash }
                OPTIONAL { ?acc core:isVerified ?accVerified }
              }
              OPTIONAL { ?user core:hasRole ?role }
            }
            GROUP BY ?user ?acc ?hash ?storedEmail ?verified ?name ?avatar
            LIMIT 1
        `;
        const params = new URLSearchParams({ query: sparql, format: "application/sparql-results+json" });
        const res = await lastValueFrom(this.http.get(this.fusekiUrl, { params }));
        const row = res.data.results.bindings[0];
        if (!row) return null;
        return {
            userIri: row.user.value,
            accountIri: row.acc?.value ?? null,
            hash: row.hash?.value ?? null,
            email: row.storedEmail?.value ?? null,
            isVerified: row.verified?.value ?? null,
            name: row.name?.value ?? null,
            avatar: row.avatar?.value ?? null,
            roles: row.roles?.value ? row.roles.value.split("||").filter(Boolean) : [],
        };
    }

    private async getAccountsForUser(userIri: string): Promise<string[]> {
        const sparql = `PREFIX core: <${CORE}>
            SELECT ?acc WHERE { <${userIri}> core:hasAccount ?acc }`;
        const params = new URLSearchParams({ query: sparql, format: "application/sparql-results+json" });
        const res = await lastValueFrom(this.http.get(this.fusekiUrl, { params }));
        return res.data.results.bindings.map((b: any) => b.acc.value);
    }

    /** ---------- Public API ---------- */

    /** Inscription classique (email + password hash) */
    async register(email: string, password: string, name: string) {
        const normalizedEmail = this.normalizeEmail(email);
        if (await this.userExistsWithEmail(normalizedEmail)) {
            throw new ConflictException("User already exists");
        }

        const iri = this.iriFromEmail(normalizedEmail);
        const accIri = `${iri}#local`;

        // Attribuer automatiquement le rÃƒÂ´le SuperÃ¢â‚¬â€˜Admin ÃƒÂ  lÃ¢â‚¬â„¢adresse Ã‚Â« superadmin@admin.com Ã‚Â»
        const baseRoleTriple = `<${iri}> core:hasRole <${CORE}RegularRole> .`;
        let extraRoleTriple = "";
        if (normalizedEmail === "superadmin@admin.com") {
            extraRoleTriple = `<${iri}> core:hasRole <${CORE}SuperAdminRole> .`;
        }

        const hash = await bcrypt.hash(password, 10);

        const ttl = `
      PREFIX core: <${CORE}>
      PREFIX foaf: <${FOAF}>
      INSERT DATA {
        <${iri}> a core:User ;
                 foaf:name """${escapeSparqlLiteral(name)}""" ;
                 core:email """${normalizedEmail}""" ;
                 core:isVerified false .
        ${baseRoleTriple}
        ${extraRoleTriple}

        <${accIri}> a core:Account ;
                core:provider "local" ;
                core:email """${normalizedEmail}""" ;
                core:isVerified false ;
                core:hashedPwd """${hash}""" .

        <${iri}> core:hasAccount <${accIri}> .
      }`;

        await this.runUpdate(ttl);
        return { iri };
    }

    /** VÃƒÆ’Ã‚Â©rifie email+password, renvoie JWT si ok */
    async login(email: string, password: string) {
        const row = await this.fetchLocalAccountByEmail(email);
        if (!row || !row.accountIri || !row.hash) {
            throw new UnauthorizedException("Unknown user");
        }

        const ok = await bcrypt.compare(password, row.hash);
        if (!ok) throw new UnauthorizedException("Bad credentials");

        const token = jwt.sign({ sub: row.userIri, email: this.normalizeEmail(email) }, this.JWT_SECRET, {
            expiresIn: "12h",
        });
        return { token };
    }

    /** Mise ÃƒÆ’Ã‚Â  jour du profil (nom, avatarÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦) */
    async updateProfile(
        userIri: string,
        fields: { name?: string; avatar?: string }
    ) {
        let deletePart = "";
        let insertPart = "";

        if (fields.name !== undefined) {
            deletePart += `<${userIri}> foaf:name ?n .`;
            insertPart += `<${userIri}> foaf:name """${escapeSparqlLiteral(fields.name)}""" .`;
        }
        if (fields.avatar !== undefined) {
            deletePart += `<${userIri}> foaf:img ?img .`;
            if (fields.avatar) {
                insertPart += `<${userIri}> foaf:img <${fields.avatar}> .`;
            }
        }

        if (!deletePart && !insertPart) return;

        const update = `
      PREFIX foaf: <${FOAF}>
      DELETE { ${deletePart} }
      INSERT { ${insertPart} }
      WHERE  { OPTIONAL { ${deletePart} } }`;

        await this.runUpdate(update);
    }

    /** Lier un compte Google OAuth au User */
    async linkGoogle(
        userIri: string,
        googleSub: string,
        email: string,
        name: string
    ) {
        const normalizedEmail = this.normalizeEmail(email);
        const gAcc = `${userIri}#google`;
        const update = `
      PREFIX core: <${CORE}>
      INSERT DATA {
        <${gAcc}> a core:Account ;
          core:provider "google" ;
          core:email """${normalizedEmail}""" ;
          core:isVerified true ;
          core:googleSub """${googleSub}""" .
        <${userIri}> core:hasAccount <${gAcc}> .
      }`;
        await this.runUpdate(update);
    }

    /** Remplacer password local */
    async changePassword(email: string, newPwd: string) {
        const row = await this.fetchLocalAccountByEmail(email);
        if (!row || !row.accountIri) {
            throw new NotFoundException("User or local account not found");
        }
        const hash = await bcrypt.hash(newPwd, 10);
        const update = `
      PREFIX core: <${CORE}>
      DELETE { <${row.accountIri}> core:hashedPwd ?h . }
      INSERT { <${row.accountIri}> core:hashedPwd """${hash}""" . }
      WHERE  { OPTIONAL { <${row.accountIri}> core:hashedPwd ?h . } }`;
        await this.runUpdate(update);
    }

    /** Fetch minimal profile information along with roles. */
    async getProfile(userIri: string) {
        const roles = await this._getUserRoles(userIri);
        const params = new URLSearchParams({
            query: `
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX core: <http://example.org/core#>
      SELECT ?name ?avatar ?email ?verified WHERE {
        OPTIONAL { <${userIri}> foaf:name ?name }
        OPTIONAL { <${userIri}> foaf:img ?avatar }
        OPTIONAL { <${userIri}> core:email ?email }
        OPTIONAL { <${userIri}> core:isVerified ?verified }
      }`,
            format: "application/sparql-results+json",
        });
        const res = await lastValueFrom(this.http.get(this.fusekiUrl, { params }));
        const bindings = res.data.results.bindings[0];
        const email = bindings?.email?.value;
        const verifiedValue = bindings?.verified?.value;
        const isVerified = verifiedValue === "true" || verifiedValue === "1";
        return {
            name: bindings?.name?.value,
            avatar: bindings?.avatar?.value,
            email,
            isVerified,
            roles: roles,
        };
    }

    /** ---------- Admin operations ---------- */

    async adminListUsers(
        adminIri: string,
        options: { page: number; pageSize: number; search?: string; onlyUnverified?: boolean; role?: string }
    ) {
        await this.assertSuperAdmin(adminIri);

        const page = Math.max(1, options.page || 1);
        const pageSize = Math.max(1, Math.min(100, options.pageSize || 20));
        const offset = (page - 1) * pageSize;
        const search = options.search?.trim();
        const onlyUnverified = options.onlyUnverified === true;

        const allowedRoles = new Set([
            `${CORE}SuperAdminRole`,
            `${CORE}AdminRole`,
            `${CORE}RegularRole`,
        ]);
        const selectedRole = options.role && allowedRoles.has(options.role) ? options.role : undefined;

        const searchFilter = search
            ? `FILTER(
                    CONTAINS(LCASE(STR(COALESCE(?name, ""))), LCASE("${escapeSparqlLiteral(search)}")) ||
                    CONTAINS(LCASE(STR(COALESCE(?email, ""))), LCASE("${escapeSparqlLiteral(search)}"))
                )`
            : "";
        const verifiedFilter = onlyUnverified
            ? `FILTER(!BOUND(?verified) || LCASE(STR(?verified)) = "false" || STR(?verified) = "0")`
            : "";
        const roleFilter = selectedRole
            ? `FILTER EXISTS { ?user core:hasRole <${selectedRole}> }`
            : "";

        const baseQuery = `
            PREFIX core: <${CORE}>
            PREFIX foaf: <${FOAF}>
            SELECT ?user ?name ?email ?avatar ?verified (GROUP_CONCAT(?role;separator="||") AS ?roles)
            WHERE {
              ?user a core:User .
              OPTIONAL { ?user foaf:name ?name }
              OPTIONAL { ?user core:email ?email }
              OPTIONAL { ?user foaf:img ?avatar }
              OPTIONAL { ?user core:isVerified ?verified }
              OPTIONAL { ?user core:hasRole ?role }
              ${searchFilter}
              ${verifiedFilter}
              ${roleFilter}
            }
            GROUP BY ?user ?name ?email ?avatar ?verified
            ORDER BY LCASE(STR(COALESCE(?name, ?email, STR(?user))))
            LIMIT ${pageSize}
            OFFSET ${offset}
        `;
        const params = new URLSearchParams({ query: baseQuery, format: "application/sparql-results+json" });
        const res = await lastValueFrom(this.http.get(this.fusekiUrl, { params }));
        const items = res.data.results.bindings.map((row: any) => ({
            iri: row.user.value,
            name: row.name?.value ?? null,
            email: row.email?.value ?? null,
            avatar: row.avatar?.value ?? null,
            isVerified: row.verified?.value === "true" || row.verified?.value === "1",
            roles: row.roles?.value ? row.roles.value.split("||").filter(Boolean) : [],
        }));

        const countQuery = `
            PREFIX core: <${CORE}>
            PREFIX foaf: <${FOAF}>
            SELECT (COUNT(DISTINCT ?user) AS ?total)
            WHERE {
              ?user a core:User .
              OPTIONAL { ?user foaf:name ?name }
              OPTIONAL { ?user core:email ?email }
              OPTIONAL { ?user core:isVerified ?verified }
              ${searchFilter}
              ${verifiedFilter}
              ${roleFilter}
            }
        `;
        const countParams = new URLSearchParams({ query: countQuery, format: "application/sparql-results+json" });
        const countRes = await lastValueFrom(this.http.get(this.fusekiUrl, { params: countParams }));
        const total = Number(countRes.data.results.bindings[0]?.total?.value ?? 0);

        return { items, page, pageSize, total };
    }
    async adminUpdateUser(
        adminIri: string,
        userIri: string,
        payload: {
            name?: string | null;
            email?: string | null;
            avatar?: string | null;
            isVerified?: boolean;
            roles?: string[];
        }
    ) {
        await this.assertSuperAdmin(adminIri);

        const exists = await this.askBoolean(`PREFIX core: <${CORE}> ASK { <${userIri}> a core:User }`);
        if (!exists) {
            throw new NotFoundException("User not found");
        }

        if (userIri === adminIri) {
            throw new BadRequestException("Use profile page to update your own account");
        }

        const normalizedEmail = payload.email ? this.normalizeEmail(payload.email) : undefined;
        if (normalizedEmail) {
            const emailTaken = await this.askBoolean(`PREFIX core: <${CORE}>
                ASK { ?u core:email """${escapeSparqlLiteral(normalizedEmail)}""" FILTER(?u != <${userIri}>) }`);
            if (emailTaken) {
                throw new ConflictException("Email already used by another account");
            }
        }

        const accounts = await this.getAccountsForUser(userIri);
        const updates: string[] = [];

        if (payload.name !== undefined) {
            updates.push(`
                PREFIX foaf: <${FOAF}>
                DELETE { <${userIri}> foaf:name ?n . }
                INSERT { ${payload.name ? `<${userIri}> foaf:name """${escapeSparqlLiteral(payload.name)}""" .` : ""} }
                WHERE  { OPTIONAL { <${userIri}> foaf:name ?n . } }
            `);
        }

        if (payload.avatar !== undefined) {
            updates.push(`
                PREFIX foaf: <${FOAF}>
                DELETE { <${userIri}> foaf:img ?img . }
                INSERT { ${payload.avatar ? `<${userIri}> foaf:img <${payload.avatar}> .` : ""} }
                WHERE  { OPTIONAL { <${userIri}> foaf:img ?img . } }
            `);
        }

        if (normalizedEmail !== undefined) {
            updates.push(`
                PREFIX core: <${CORE}>
                DELETE { <${userIri}> core:email ?e . }
                INSERT { <${userIri}> core:email """${escapeSparqlLiteral(normalizedEmail)}""" . }
                WHERE  { OPTIONAL { <${userIri}> core:email ?e . } }
            `);
            for (const acc of accounts) {
                updates.push(`
                    PREFIX core: <${CORE}>
                    DELETE { <${acc}> core:email ?old . }
                    INSERT { <${acc}> core:email """${escapeSparqlLiteral(normalizedEmail)}""" . }
                    WHERE  { OPTIONAL { <${acc}> core:email ?old . } }
                `);
            }
        }

        if (payload.isVerified !== undefined) {
            const boolLiteral = payload.isVerified ? "true" : "false";
            updates.push(`
                PREFIX core: <${CORE}>
                DELETE { <${userIri}> core:isVerified ?v . }
                INSERT { <${userIri}> core:isVerified ${boolLiteral} . }
                WHERE  { OPTIONAL { <${userIri}> core:isVerified ?v . } }
            `);
            for (const acc of accounts) {
                updates.push(`
                    PREFIX core: <${CORE}>
                    DELETE { <${acc}> core:isVerified ?v . }
                    INSERT { <${acc}> core:isVerified ${boolLiteral} . }
                    WHERE  { OPTIONAL { <${acc}> core:isVerified ?v . } }
                `);
            }
        }

        if (payload.roles !== undefined) {
            const sanitizedRoles = payload.roles.filter(Boolean);
            const insertPart = sanitizedRoles
                .map((role) => `<${userIri}> core:hasRole <${role}> .`)
                .join("\n");
            updates.push(`
                PREFIX core: <${CORE}>
                DELETE { <${userIri}> core:hasRole ?r . }
                INSERT { ${insertPart} }
                WHERE  { OPTIONAL { <${userIri}> core:hasRole ?r . } }
            `);
        }

        for (const update of updates) {
            const trimmed = update.trim();
            if (trimmed) await this.runUpdate(trimmed);
        }
    }

    async adminDeleteUser(adminIri: string, userIri: string) {
        await this.assertSuperAdmin(adminIri);

        const exists = await this.askBoolean(`PREFIX core: <${CORE}> ASK { <${userIri}> a core:User }`);
        if (!exists) {
            throw new NotFoundException("User not found");
        }

        if (userIri === adminIri) {
            throw new BadRequestException("You cannot delete your own account");
        }

        const accounts = await this.getAccountsForUser(userIri);
        const deletes: string[] = [];
        deletes.push(`DELETE WHERE { <${userIri}> ?p ?o . }`);
        deletes.push(`DELETE WHERE { ?s ?p <${userIri}> . }`);
        for (const acc of accounts) {
            deletes.push(`DELETE WHERE { <${acc}> ?p ?o . }`);
            deletes.push(`DELETE WHERE { ?s ?p <${acc}> . }`);
        }
        for (const query of deletes) {
            await this.runUpdate(query);
        }
    }
}






