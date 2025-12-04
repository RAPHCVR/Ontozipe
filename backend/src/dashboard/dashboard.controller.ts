import { Controller, Get, Query, Req, UseGuards, BadRequestException } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";
import { Request } from "express";

type AuthRequest = Request & { user: { sub: string; email?: string } };

type DashboardQuery = {
    start?: string;
    end?: string;
    scopeType?: "all" | "ontology" | "organization" | "group";
    scopeId?: string;
};

@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get()
    async getDashboard(@Req() req: AuthRequest, @Query() query: DashboardQuery) {
        const { start, end, scopeType = "all", scopeId } = query;
        const parsedStart = start ? this.parseDate(start, "start") : undefined;
        const parsedEnd = end ? this.parseDate(end, "end") : undefined;

        if (parsedStart && parsedEnd && parsedStart.getTime() > parsedEnd.getTime()) {
            throw new BadRequestException("start must be before or equal to end");
        }

        return this.dashboardService.getDashboardSummary(req.user.sub, {
            start: parsedStart,
            end: parsedEnd,
            scopeType,
            scopeId,
        });
    }

    private parseDate(value: string, field: "start" | "end"): Date {
        const trimmed = value.trim();
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
            throw new BadRequestException(`Invalid ${field} date, expected ISO format`);
        }
        return parsed;
    }
}
