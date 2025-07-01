import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor() {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: "qM5P1eXaNufP+5W6EVWwJ86SLUkHUMolnrfsj/3Tz==",
		});
	}

	/**
	 * Le payload arrive ici après vérification de la signature.
	 * On le passe tel quel dans `request.user`.
	 */
	validate(payload: { sub: string; email: string }) {
		return payload; // { sub, email }
	}
}
