import { Controller, Get, Query, Req, UseGuards, BadRequestException } from "@nestjs/common";
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiForbiddenResponse,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiTags,
    ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";
import { Request } from "express";
import { DashboardSummaryResponseDto } from "./dto/dashboard.dto";
import { ApiErrorDto } from "../common/dto/api-error.dto";

type AuthRequest = Request & { user: { sub: string; email?: string } };

type DashboardQuery = {
    start?: string;
    end?: string;
    scopeType?: "all" | "ontology" | "organization" | "group";
    scopeId?: string;
};

@ApiTags("Dashboard")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto })
@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get()
    @ApiOperation({ summary: "Resume du dashboard" })
    @ApiOkResponse({ type: DashboardSummaryResponseDto })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    @ApiQuery({
        name: "start",
        required: false,
        type: String,
        example: "2024-01-01T00:00:00.000Z",
    })
    @ApiQuery({
        name: "end",
        required: false,
        type: String,
        example: "2024-01-31T23:59:59.999Z",
    })
    @ApiQuery({
        name: "scopeType",
        required: false,
        enum: ["all", "ontology", "organization", "group"],
        example: "all",
    })
    @ApiQuery({
        name: "scopeId",
        required: false,
        type: String,
        example: "http://example.org/ontology/core",
    })
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
