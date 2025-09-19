import {
    Injectable,
    UnauthorizedException,
    ConflictException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { escapeSparqlLiteral } from "../utils/sparql.utils";

const CORE = "http://example.org/core#";
const FOAF = "http://xmlns.com/foaf/0.1/";

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

    /** Récupère la liste des rôles d'un utilisateur de manière efficace. */
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


    /** ---------- Public API ---------- */

    /** Inscription classique (email + password hash) */
    async register(email: string, password: string, name: string) {
        const iri = this.iriFromEmail(email);
        const accIri = `${iri}#local`;

        // refuse doublons
        if (await this.askBoolean(`ASK { <${iri}> ?p ?o }`)) {
            throw new ConflictException("User already exists");
        }

        // Attribuer automatiquement le rôle Super‑Admin à l’adresse « superAdmin@admin.com »
        let roleTriple = "";
        if (email.toLowerCase() === "superadmin@admin.com") {
            roleTriple = `<${iri}> core:hasRole <${CORE}SuperAdminRole> .`;
        }

        const hash = await bcrypt.hash(password, 10);

        const ttl = `
      PREFIX core: <${CORE}>
      PREFIX foaf: <${FOAF}>
      INSERT DATA {
        <${iri}> a core:User ;
                 foaf:name """${escapeSparqlLiteral(name)}""" ;
                 core:email """${email}""" ;
                 core:isVerified false .
        ${roleTriple}

        <${accIri}> a core:Account ;
                core:provider "local" ;
                core:email """${email}""" ;
                core:isVerified false ;
                core:hashedPwd """${hash}""" .

        <${iri}> core:hasAccount <${accIri}> .
      }`;

        await this.runUpdate(ttl);
        return { iri };
    }

    /** Vérifie email+password, renvoie JWT si ok */
    async login(email: string, password: string) {
        const iri = this.iriFromEmail(email);

        // récupérer le hash stocké
        const params = new URLSearchParams({
            query: `
        PREFIX core: <${CORE}>
        SELECT ?hash WHERE {
          <${iri}> core:hasAccount ?acc .
          ?acc core:provider "local" ;
               core:hashedPwd ?hash .
        } LIMIT 1`,
            format: "application/sparql-results+json",
        });

        const res = await lastValueFrom(this.http.get(this.fusekiUrl, { params }));
        const bindings = res.data.results.bindings;
        if (bindings.length === 0) throw new UnauthorizedException("Unknown user");

        const hash = bindings[0].hash.value;
        const ok = await bcrypt.compare(password, hash);
        if (!ok) throw new UnauthorizedException("Bad credentials");

        const token = jwt.sign({ sub: iri, email }, this.JWT_SECRET, {
            expiresIn: "12h",
        });
        return { token };
    }

    /** Mise à jour du profil (nom, avatar…) */
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
            insertPart += `<${userIri}> foaf:img <${fields.avatar}> .`;
        }

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
        const gAcc = `${userIri}#google`;
        const update = `
      PREFIX core: <${CORE}>
      INSERT DATA {
        <${gAcc}> a core:Account ;
          core:provider "google" ;
          core:email """${email}""" ;
          core:isVerified true ;
          core:googleSub """${googleSub}""" .
        <${userIri}> core:hasAccount <${gAcc}> .
      }`;
        await this.runUpdate(update);
    }

    /** Remplacer password local */
    async changePassword(email: string, newPwd: string) {
        const iri = this.iriFromEmail(email);
        const hash = await bcrypt.hash(newPwd, 10);
        const update = `
      PREFIX core: <${CORE}>
      DELETE { <${iri}#local> core:hashedPwd ?h . }
      INSERT { <${iri}#local> core:hashedPwd """${hash}""" . }
      WHERE  { OPTIONAL { <${iri}#local> core:hashedPwd ?h . } }`;
        await this.runUpdate(update);
    }

    /** Récupère profil minimal ET les rôles de l'utilisateur. */
    async getProfile(userIri: string) {
        // 1. Récupérer les rôles
        const roles = await this._getUserRoles(userIri);

        // 2. Récupérer les infos de profil
        const params = new URLSearchParams({
            query: `
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX core: <http://example.org/core#>
      SELECT ?name ?avatar WHERE {
        OPTIONAL { <${userIri}> foaf:name ?name }
        OPTIONAL { <${userIri}> foaf:img ?avatar }
      }`,
            format: "application/sparql-results+json",
        });
        const res = await lastValueFrom(this.http.get(this.fusekiUrl, { params }));
        const bindings = res.data.results.bindings[0];

        // 3. Combiner les résultats
        return {
            name: bindings?.name?.value,
            avatar: bindings?.avatar?.value,
            roles: roles,
        };
    }
}