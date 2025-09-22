import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from "@nestjs/common";
import { Request } from "express";

import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { AddOrganizationMemberDto } from "./dto/add-organization-member.dto";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@UseGuards(JwtAuthGuard)
@Controller("organizations")
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) {}

    @Get()
    getOrganizations(@Req() req: AuthRequest, @Query("mine") mine?: string) {
        if (mine === "true") {
            return this.organizationsService.getOrganizationsForUser(req.user.sub);
        }
        return this.organizationsService.getOrganizations();
    }

    @Post()
    createOrganization(@Req() req: AuthRequest, @Body() dto: CreateOrganizationDto) {
        return this.organizationsService.createOrganization(req.user.sub, dto);
    }

    @Patch(":iri")
    updateOrganization(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: UpdateOrganizationDto
    ) {
        return this.organizationsService.updateOrganization(
            req.user.sub,
            decodeURIComponent(iri),
            { newLabel: dto.label, newOwner: dto.ownerIri }
        );
    }

    @Delete(":iri")
    deleteOrganization(@Req() req: AuthRequest, @Param("iri") iri: string) {
        return this.organizationsService.deleteOrganization(req.user.sub, decodeURIComponent(iri));
    }

    @Post(":iri/members")
    addOrganizationMember(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: AddOrganizationMemberDto
    ) {
        return this.organizationsService.addOrganizationMember(
            req.user.sub,
            decodeURIComponent(iri),
            dto.userIri
        );
    }

    @Delete(":iri/members/:userIri")
    removeOrganizationMember(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Param("userIri") userIri: string
    ) {
        return this.organizationsService.removeOrganizationMember(
            req.user.sub,
            decodeURIComponent(iri),
            userIri
        );
    }

    @Get(":iri/members")
    getOrganizationMembers(@Param("iri") iri: string) {
        return this.organizationsService.getOrganizationMembers(decodeURIComponent(iri));
    }
}

