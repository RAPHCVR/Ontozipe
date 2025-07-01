import {
	Injectable,
	UnauthorizedException,
	ConflictException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";

const CORE = "http://example.org/core#";
const FOAF = "http://xmlns.com/foaf/0.1/";

@Injectable()
export class AuthService {
	private fusekiUrl =
		process.env.FUSEKI_SPARQL || "http://localhost:3030/autonomy/sparql";
	private fusekiUpdate = this.fusekiUrl.replace("/sparql", "/update");
	private FUSEKI_USER = process.env.FUSEKI_USER || "admin";
	private FUSEKI_PASS = process.env.FUSEKI_PASSWORD || "Pass123";
	private JWT_SECRET = "qM5P1eXaNufP+5W6EVWwJ86SLUkHUMolnrfsj/3Tz==";

	constructor(private readonly http: HttpService) {}

	/** ---------- Utils ---------- */
	private async askBoolean(ask: string): Promise<boolean> {
		const params = new URLSearchParams({ query: ask });
		const res = await lastValueFrom(this.http.get(this.fusekiUrl, { params }));
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

	/** ---------- Public API ---------- */

	/** Inscription classique (email + password hash) */
	async register(email: string, password: string, name: string) {
		const iri = this.iriFromEmail(email);
		const accIri = `${iri}#local`;

		// refuse doublons
		if (await this.askBoolean(`ASK { <${iri}> ?p ?o }`)) {
			throw new ConflictException("User already exists");
		}

		// Attribuer automatiquement le rôle Super‑Admin à l’adresse
		// « superAdmin@admin.com »
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
                 foaf:name """${name.replace(/"/g, '\\"')}""" ;
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
			insertPart += `<${userIri}> foaf:name """${fields.name.replace(/"/g, '\\"')}""" .`;
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

	/** Récupère profil minimal */
	async getProfile(userIri: string) {
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
		return res.data.results.bindings[0] ?? {};
	}
}
