import {
	Body,
	Controller,
	Get,
	Patch,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

/* ---------- DTOs ---------- */
class RegisterDto {
	email!: string;
	password!: string;
	name!: string;
}

class LoginDto {
	email!: string;
	password!: string;
}

class ProfileDto {
	name?: string;
	avatar?: string;
}

class ChangePwdDto {
	oldPassword!: string;
	newPassword!: string;
}

class LinkGoogleDto {
	/** ID token retourné par Google OAuth */
	idToken!: string;
	/** email principal envoyé par Google */
	email!: string;
	/** sub (identifiant Google) */
	sub!: string;
	/** nom affiché Google */
	name!: string;
}

/* ---------- Controller ---------- */
@Controller("auth")
export class AuthController {
	constructor(private readonly auth: AuthService) {}

	/** ---------- Inscription classique ---------- */
	@Post("register")
	async register(@Body() dto: RegisterDto) {
		await this.auth.register(dto.email, dto.password, dto.name);
		// auto‑login après inscription
		return this.auth.login(dto.email, dto.password);
	}

	/** ---------- Connexion ---------- */
	@Post("login")
	login(@Body() dto: LoginDto) {
		return this.auth.login(dto.email, dto.password);
	}

	/** ---------- Profil courant ---------- */
	@UseGuards(JwtAuthGuard)
	@Get("me")
	async me(@Req() req: any) {
		const iri: string = req.user.sub;
		return this.auth.getProfile(iri); // voir méthode à ajouter dans AuthService
	}

	/** ---------- Mise à jour du profil ---------- */
	@UseGuards(JwtAuthGuard)
	@Patch("me")
	async updateProfile(@Req() req: any, @Body() body: ProfileDto) {
		await this.auth.updateProfile(req.user.sub, body);
		return { ok: true };
	}

	/** ---------- Changement de mot de passe ---------- */
	@UseGuards(JwtAuthGuard)
	@Post("change-password")
	async changePwd(@Req() req: any, @Body() dto: ChangePwdDto) {
		// vérification du mot de passe actuel
		await this.auth.login(req.user.email, dto.oldPassword);
		await this.auth.changePassword(req.user.email, dto.newPassword);
		return { ok: true };
	}
}
