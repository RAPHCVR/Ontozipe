import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
} from "@nestjs/common";
import { Request } from "express";

import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { GroupsService } from "./groups.service";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import { AddMemberDto } from "./dto/add-member.dto";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@UseGuards(JwtAuthGuard)
@Controller("groups")
export class GroupsController {
    constructor(private readonly groupsService: GroupsService) {}

    @Get()
    getGroups(@Req() req: AuthRequest) {
        return this.groupsService.getGroups(req.user.sub);
    }

    @Post()
    createGroup(@Req() req: AuthRequest, @Body() dto: CreateGroupDto) {
        return this.groupsService.createGroup(
            dto.label,
            req.user.sub,
            dto.organizationIri,
            dto.members ?? []
        );
    }

    @Patch(":iri")
    async updateGroup(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: UpdateGroupDto
    ) {
        if (dto.label === undefined && dto.organizationIri === undefined) {
            throw new BadRequestException("Aucun champ à mettre à jour");
        }

        const groupIri = decodeURIComponent(iri);

        if (dto.label !== undefined) {
            await this.groupsService.updateGroupLabel(req.user.sub, groupIri, dto.label);
        }

        if (dto.organizationIri !== undefined) {
            await this.groupsService.updateGroupOrganization(
                req.user.sub,
                groupIri,
                dto.organizationIri
            );
        }

        return { ok: true };
    }

    @Post(":iri/members")
    addGroupMember(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: AddMemberDto
    ) {
        return this.groupsService.addGroupMember(req.user.sub, decodeURIComponent(iri), dto.userIri);
    }

    @Delete(":iri/members/:user")
    removeGroupMember(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Param("user") userIri: string
    ) {
        return this.groupsService.removeGroupMember(
            req.user.sub,
            decodeURIComponent(iri),
            userIri
        );
    }

    @Delete(":iri")
    deleteGroup(@Req() req: AuthRequest, @Param("iri") iri: string) {
        return this.groupsService.deleteGroup(req.user.sub, decodeURIComponent(iri));
    }
}

