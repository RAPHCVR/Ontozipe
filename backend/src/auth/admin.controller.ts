import {
	Controller,
	Get,
	Query,
	UseGuards,
	Req,
	Patch,
	Param,
	Body,
	Delete,
} from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiConflictResponse,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Request } from "express";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AuthService } from "./auth.service";
import {
	AdminListUsersQueryDto,
	AdminUsersListResponseDto,
	AdminUpdateUserDto,
} from "./dto/admin-user.dto";
import { OkResponseDto } from "../common/dto/standard-response.dto";
import { ApiErrorDto } from "../common/dto/api-error.dto";

interface AuthRequest extends Request {
	user: { sub: string; email?: string };
}

const normalizeEncodedIri = (value: string): string => {
	let iri = value;

	// First, decode once if the string does not look like a full IRI yet.
	if (!iri.includes("://")) {
		try {
			iri = decodeURIComponent(iri);
		} catch {
			// ignore decoding errors, fall back to raw value
		}
	}

	// Then, repeatedly decode while we still see an encoded percent sign.
	let previous: string | null = null;
	while (iri.includes("%25") && iri !== previous) {
		previous = iri;
		try {
			iri = decodeURIComponent(iri);
		} catch {
			break;
		}
	}

	// Finally, make sure the fragment part (after the last slash) is consistently encoded
	const lastSlash = iri.lastIndexOf("/");
	if (lastSlash >= 0 && lastSlash < iri.length - 1) {
		const prefix = iri.slice(0, lastSlash + 1);
		const suffix = iri.slice(lastSlash + 1);
		try {
			const decodedSuffix = decodeURIComponent(suffix);
			iri = prefix + encodeURIComponent(decodedSuffix.toLowerCase());
		} catch {
			// If decoding fails we still ensure it is percent-encoded
			iri = prefix + encodeURIComponent(suffix.toLowerCase());
		}
	}

	return iri;
};

@ApiTags("Users")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto })
@UseGuards(JwtAuthGuard)
@Controller("auth/admin/users")
export class AdminUsersController {
	constructor(private readonly authService: AuthService) {}

	@Get()
	@ApiOperation({
		summary: "Lister les utilisateurs (admin)",
		description: "Necessite le role SuperAdmin.",
	})
	@ApiOkResponse({ type: AdminUsersListResponseDto })
	@ApiBadRequestResponse({ type: ApiErrorDto })
	@ApiQuery({ name: "page", required: false, type: Number, example: 1 })
	@ApiQuery({ name: "pageSize", required: false, type: Number, example: 20 })
	@ApiQuery({ name: "search", required: false, type: String, example: "doe" })
	@ApiQuery({ name: "onlyUnverified", required: false, type: Boolean, example: true })
	@ApiQuery({
		name: "role",
		required: false,
		type: String,
		example: "http://example.org/core#AdminRole",
	})
	listUsers(@Req() req: AuthRequest, @Query() query: AdminListUsersQueryDto) {
		return this.authService.adminListUsers(req.user.sub, {
			page: query.page ?? 1,
			pageSize: query.pageSize ?? 20,
			search: query.search,
			onlyUnverified: query.onlyUnverified ?? false,
			role: query.role,
		});
	}

	@Patch(":encodedIri")
	@ApiOperation({
		summary: "Mettre a jour un utilisateur (admin)",
		description: "Necessite le role SuperAdmin.",
	})
	@ApiOkResponse({ type: OkResponseDto })
	@ApiParam({
		name: "encodedIri",
		description: "IRI encode (URL-encoded) de l'utilisateur",
		example: "http%3A%2F%2Fexample.org%2Fuser%2Falice",
	})
	@ApiBadRequestResponse({ type: ApiErrorDto })
	@ApiConflictResponse({ type: ApiErrorDto })
	@ApiNotFoundResponse({ type: ApiErrorDto })
	async updateUser(
		@Req() req: AuthRequest,
		@Param("encodedIri") encodedIri: string,
		@Body() body: AdminUpdateUserDto
	) {
		const targetIri = normalizeEncodedIri(encodedIri);
		await this.authService.adminUpdateUser(req.user.sub, targetIri, body);
		return { ok: true };
	}

	@Delete(":encodedIri")
	@ApiOperation({
		summary: "Supprimer un utilisateur (admin)",
		description: "Necessite le role SuperAdmin.",
	})
	@ApiOkResponse({ type: OkResponseDto })
	@ApiParam({
		name: "encodedIri",
		description: "IRI encode (URL-encoded) de l'utilisateur",
		example: "http%3A%2F%2Fexample.org%2Fuser%2Falice",
	})
	@ApiBadRequestResponse({ type: ApiErrorDto })
	@ApiNotFoundResponse({ type: ApiErrorDto })
	async deleteUser(
		@Req() req: AuthRequest,
		@Param("encodedIri") encodedIri: string
	) {
		const targetIri = normalizeEncodedIri(encodedIri);
		await this.authService.adminDeleteUser(req.user.sub, targetIri);
		return { ok: true };
	}
}
