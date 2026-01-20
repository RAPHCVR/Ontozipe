import {
	Body,
	Controller,
	Get,
	Patch,
	Post,
	Req,
	UseGuards,
	BadRequestException,
} from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiConflictResponse,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiNotFoundResponse,
	ApiProperty,
	ApiPropertyOptional,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import {
	IsEmail,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUrl,
	MinLength,
} from "class-validator";
import { AuthTokenResponseDto, UserProfileResponseDto } from "./dto/auth-response.dto";
import { OkResponseDto } from "../common/dto/standard-response.dto";
import { ApiErrorDto } from "../common/dto/api-error.dto";

/* ---------- DTOs ---------- */
class RegisterDto {
	@ApiProperty({ example: "jane@example.org" })
	@IsEmail()
	email!: string;

	@ApiProperty({ example: "SuperSecret123" })
	@IsString()
	@MinLength(8, {
		message: "Le mot de passe doit faire au moins 8 caractères.",
	})
	password!: string;

	@ApiProperty({ example: "Jane Doe" })
	@IsString()
	@IsNotEmpty()
	name!: string;
}

class LoginDto {
	@ApiProperty({ example: "jane@example.org" })
	@IsEmail()
	email!: string;

	@ApiProperty({ example: "SuperSecret123" })
	@IsString()
	@IsNotEmpty()
	password!: string;
}

class ProfileDto {
	@ApiPropertyOptional({ example: "Jane Doe" })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	name?: string;

	@ApiPropertyOptional({
		example: "https://cdn.example.com/avatars/jane.png",
	})
	@IsOptional()
	@IsUrl()
	avatar?: string;
}

class ChangePwdDto {
	@ApiProperty({ example: "OldPassword123" })
	@IsString()
	@IsNotEmpty()
	oldPassword!: string;

	@ApiProperty({ example: "NewPassword123" })
	@IsString()
	@MinLength(8, {
		message: "Le nouveau mot de passe doit faire au moins 8 caractères.",
	})
	newPassword!: string;
}

class LinkGoogleDto {
	/** ID token retourné par Google OAuth */
	@ApiProperty({ example: "eyJhbGciOi..." })
	idToken!: string;
	/** email principal envoyé par Google */
	@ApiProperty({ example: "jane@example.org" })
	email!: string;
	/** sub (identifiant Google) */
	@ApiProperty({ example: "google-sub-123" })
	sub!: string;
	/** nom affiché Google */
	@ApiProperty({ example: "Jane Doe" })
	name!: string;
}

/* ---------- Controller ---------- */
@ApiTags("Auth")
@Controller("auth")
export class AuthController {
	constructor(private readonly auth: AuthService) {}

	/** ---------- Inscription classique ---------- */
	@Post("register")
	@ApiOperation({ summary: "Inscription classique" })
	@ApiCreatedResponse({ type: AuthTokenResponseDto })
	@ApiBadRequestResponse({ type: ApiErrorDto })
	@ApiConflictResponse({ type: ApiErrorDto })
	async register(@Body() dto: RegisterDto) {
		await this.auth.register(dto.email, dto.password, dto.name);
		// auto‑login après inscription
		return this.auth.login(dto.email, dto.password);
	}

	/** ---------- Connexion ---------- */
	@Post("login")
	@ApiOperation({ summary: "Connexion" })
	@ApiCreatedResponse({ type: AuthTokenResponseDto })
	@ApiUnauthorizedResponse({ type: ApiErrorDto })
	@ApiBadRequestResponse({ type: ApiErrorDto })
	login(@Body() dto: LoginDto) {
		return this.auth.login(dto.email, dto.password);
	}

	/** ---------- Profil courant ---------- */
	@UseGuards(JwtAuthGuard)
	@Get("me")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Profil courant" })
	@ApiOkResponse({ type: UserProfileResponseDto })
	@ApiUnauthorizedResponse({ type: ApiErrorDto })
	async me(@Req() req: any) {
		const iri: string = req.user.sub;
		return this.auth.getProfile(iri);
	}

	/** ---------- Mise à jour du profil ---------- */
	@UseGuards(JwtAuthGuard)
	@Patch("me")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Mise a jour du profil" })
	@ApiOkResponse({ type: OkResponseDto })
	@ApiBadRequestResponse({ type: ApiErrorDto })
	@ApiUnauthorizedResponse({ type: ApiErrorDto })
	async updateProfile(@Req() req: any, @Body() body: ProfileDto) {
		await this.auth.updateProfile(req.user.sub, body);
		return { ok: true };
	}

	/** ---------- Changement de mot de passe ---------- */
	@UseGuards(JwtAuthGuard)
	@Post("change-password")
	@ApiBearerAuth()
	@ApiOperation({ summary: "Changement de mot de passe" })
	@ApiOkResponse({ type: OkResponseDto })
	@ApiBadRequestResponse({ type: ApiErrorDto })
	@ApiUnauthorizedResponse({ type: ApiErrorDto })
	@ApiNotFoundResponse({ type: ApiErrorDto })
	async changePwd(@Req() req: any, @Body() dto: ChangePwdDto) {
		// vérification du mot de passe actuel
		if (dto.newPassword === dto.oldPassword) {
			throw new BadRequestException(
				"Le nouveau mot de passe doit etre different de l'ancien."
			);
		}
		await this.auth.login(req.user.email, dto.oldPassword);
		await this.auth.changePassword(req.user.email, dto.newPassword);
		return { ok: true };
	}
}
