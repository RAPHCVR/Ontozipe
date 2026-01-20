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
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
    ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Request } from "express";

import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { GroupsService } from "./groups.service";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import { AddMemberDto } from "./dto/add-member.dto";
import { GroupInfoDto } from "../common/dto/ontology-response.dto";
import { ApiErrorDto } from "../../common/dto/api-error.dto";
import { OkResponseDto } from "../../common/dto/standard-response.dto";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@ApiTags("Groups")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto })
@UseGuards(JwtAuthGuard)
@Controller("groups")
export class GroupsController {
    constructor(private readonly groupsService: GroupsService) {}

    @Get()
    @ApiOperation({ summary: "Lister les groupes" })
    @ApiOkResponse({ type: [GroupInfoDto] })
    getGroups(@Req() req: AuthRequest) {
        return this.groupsService.getGroups(req.user.sub);
    }

    @Post()
    @ApiOperation({ summary: "Creer un groupe" })
    @ApiCreatedResponse({
        schema: {
            type: "string",
            example: "http://example.org/group/research-123",
        },
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    createGroup(@Req() req: AuthRequest, @Body() dto: CreateGroupDto) {
        return this.groupsService.createGroup(
            dto.label,
            req.user.sub,
            dto.organizationIri,
            dto.members ?? []
        );
    }

    @Patch(":iri")
    @ApiOperation({
        summary: "Mettre à jour un groupe",
        description: "Proprietaire du groupe requis.",
    })
    @ApiOkResponse({ type: OkResponseDto })
    @ApiParam({
        name: "iri",
        description: "IRI encode (URL-encoded) du groupe",
        example: "http%3A%2F%2Fexample.org%2Fgroup%2Fresearch-123",
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
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
    @ApiOperation({
        summary: "Ajouter un membre à un groupe",
        description: "Proprietaire du groupe requis.",
    })
    @ApiCreatedResponse({ description: "Membre ajouté." })
    @ApiParam({
        name: "iri",
        description: "IRI encode (URL-encoded) du groupe",
        example: "http%3A%2F%2Fexample.org%2Fgroup%2Fresearch-123",
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    addGroupMember(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: AddMemberDto
    ) {
        return this.groupsService.addGroupMember(req.user.sub, decodeURIComponent(iri), dto.userIri);
    }

    @Delete(":iri/members/:user")
    @ApiOperation({
        summary: "Retirer un membre d'un groupe",
        description: "Proprietaire du groupe requis.",
    })
    @ApiOkResponse({ description: "Membre retiré." })
    @ApiParam({
        name: "iri",
        description: "IRI encode (URL-encoded) du groupe",
        example: "http%3A%2F%2Fexample.org%2Fgroup%2Fresearch-123",
    })
    @ApiParam({
        name: "user",
        description: "IRI encode (URL-encoded) du membre",
        example: "http%3A%2F%2Fexample.org%2Fuser%2Falice",
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
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
    @ApiOperation({
        summary: "Supprimer un groupe",
        description: "Proprietaire du groupe requis.",
    })
    @ApiOkResponse({ description: "Groupe supprimé." })
    @ApiParam({
        name: "iri",
        description: "IRI encode (URL-encoded) du groupe",
        example: "http%3A%2F%2Fexample.org%2Fgroup%2Fresearch-123",
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    deleteGroup(@Req() req: AuthRequest, @Param("iri") iri: string) {
        return this.groupsService.deleteGroup(req.user.sub, decodeURIComponent(iri));
    }
}
