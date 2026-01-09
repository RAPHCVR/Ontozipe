import {
	Controller,
	Get,
	Query,
	UseGuards,
	Req,
	Post,
	Param,
	Delete,
	Body,
	BadRequestException,
} from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
	constructor(private readonly notifications: NotificationsService) {}

	@Get()
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
	async markRead(@Req() req: AuthRequest, @Param("encodedId") encodedId: string) {
		const id = this.decodeId(encodedId);
		await this.notifications.markAsRead(req.user.sub, id);
		return { ok: true };
	}

	@Post("read-all")
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
