import {
	Controller,
	Get,
	Query,
	UseGuards,
	Req,
	Post,
	Param,
	Delete,
	BadRequestException,
} from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";
import { NotificationsListResponseDto, UnreadCountResponseDto } from "./dto/notification.dto";
import { OkResponseDto } from "../common/dto/standard-response.dto";
import { ApiErrorDto } from "../common/dto/api-error.dto";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@ApiTags("Notifications")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto })
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
	constructor(private readonly notifications: NotificationsService) {}

	@Get()
	@ApiOperation({ summary: "Lister les notifications" })
	@ApiOkResponse({ type: NotificationsListResponseDto })
	@ApiQuery({
		name: "status",
		required: false,
		enum: ["all", "unread"],
		example: "unread",
	})
	@ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
	@ApiQuery({ name: "offset", required: false, type: Number, example: 0 })
	@ApiQuery({
		name: "verb",
		required: false,
		type: String,
		example: "http://example.org/core#IndividualCreated",
	})
	@ApiQuery({ name: "category", required: false, type: String, example: "administration" })
	@ApiQuery({
		name: "scope",
		required: false,
		enum: ["personal", "group"],
		example: "personal",
	})
	async list(
		@Req() req: AuthRequest,
		@Query("status") status?: string,
		@Query("limit") limit?: string,
		@Query("offset") offset?: string,
		@Query("verb") verb?: string,
		@Query("category") category?: string,
		@Query("scope") scope?: string
	) {
		const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
		const parsedOffset = Math.max(0, Number(offset) || 0);
		const statusFilter = status === "unread" ? "unread" : "all";
		return this.notifications.listForUser(req.user.sub, {
			status: statusFilter as "all" | "unread",
			limit: parsedLimit,
			offset: parsedOffset,
			verb,
			category,
			scope: scope === "group" ? "group" : scope === "personal" ? "personal" : undefined,
		});
	}

	@Get("unread/count")
	@ApiOperation({ summary: "Compter les notifications non lues" })
	@ApiOkResponse({ type: UnreadCountResponseDto })
	@ApiQuery({
		name: "scope",
		required: false,
		enum: ["personal", "group"],
		example: "personal",
	})
	async unreadCount(
		@Req() req: AuthRequest,
		@Query("scope") scope?: string
	) {
		const unreadCount = await this.notifications.getUnreadCountForUser(
			req.user.sub,
			scope === "group" ? "group" : scope === "personal" ? "personal" : undefined
		);
		return { unreadCount };
	}

	@Post(":encodedId/read")
	@ApiOperation({ summary: "Marquer une notification comme lue" })
	@ApiCreatedResponse({ type: OkResponseDto })
	@ApiParam({
		name: "encodedId",
		description: "Identifiant encode (URL-encoded) de notification",
		example: "http%3A%2F%2Fexample.org%2Fnotification%2Fabc",
	})
	@ApiBadRequestResponse({ type: ApiErrorDto })
	async markRead(@Req() req: AuthRequest, @Param("encodedId") encodedId: string) {
		const id = this.decodeId(encodedId);
		await this.notifications.markAsRead(req.user.sub, id);
		return { ok: true };
	}

	@Post("read-all")
	@ApiOperation({ summary: "Marquer toutes les notifications comme lues" })
	@ApiCreatedResponse({ type: OkResponseDto })
	@ApiQuery({
		name: "scope",
		required: false,
		enum: ["personal", "group"],
		example: "group",
	})
	async markAllRead(
		@Req() req: AuthRequest,
		@Query("scope") scope?: string
	) {
		await this.notifications.markAllAsRead(
			req.user.sub,
			scope === "group" ? "group" : scope === "personal" ? "personal" : undefined
		);
		return { ok: true };
	}

	@Delete(":encodedId")
	@ApiOperation({ summary: "Supprimer une notification" })
	@ApiOkResponse({ type: OkResponseDto })
	@ApiParam({
		name: "encodedId",
		description: "Identifiant encode (URL-encoded) de notification",
		example: "http%3A%2F%2Fexample.org%2Fnotification%2Fabc",
	})
	@ApiBadRequestResponse({ type: ApiErrorDto })
	async delete(
		@Req() req: AuthRequest,
		@Param("encodedId") encodedId: string
	) {
		const id = this.decodeId(encodedId);
		await this.notifications.deleteForUser(req.user.sub, id);
		return { ok: true };
	}

	private decodeId(value: string): string {
		try {
			return decodeURIComponent(value);
		} catch (error) {
			throw new BadRequestException("Invalid notification identifier");
		}
	}
}
