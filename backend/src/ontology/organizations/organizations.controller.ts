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

import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { AddOrganizationMemberDto } from "./dto/add-organization-member.dto";
import { IriLabelDto, OrganizationInfoDto } from "../common/dto/ontology-response.dto";
import { ApiErrorDto } from "../../common/dto/api-error.dto";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@ApiTags("Organizations")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto })
@UseGuards(JwtAuthGuard)
@Controller("organizations")
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) {}

    @Get()
    @ApiOperation({ summary: "Lister les organisations" })
    @ApiOkResponse({ type: [OrganizationInfoDto] })
    @ApiQuery({
        name: "mine",
        required: false,
        type: String,
        example: "true",
        description: "Filtrer sur les organisations dont l'utilisateur est owner.",
    })
    getOrganizations(@Req() req: AuthRequest, @Query("mine") mine?: string) {
        if (mine === "true") {
            return this.organizationsService.getOrganizationsForUser(req.user.sub);
        }
        return this.organizationsService.getOrganizations();
    }

    @Post()
    @ApiOperation({
        summary: "Creer une organisation",
        description: "Necessite le role SuperAdmin.",
    })
    @ApiCreatedResponse({
        schema: {
            type: "string",
            example: "http://example.org/org/acme",
        },
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    createOrganization(@Req() req: AuthRequest, @Body() dto: CreateOrganizationDto) {
        return this.organizationsService.createOrganization(req.user.sub, dto);
    }

    @Patch(":iri")
    @ApiOperation({
        summary: "Mettre a jour une organisation",
        description: "Necessite le role SuperAdmin.",
    })
    @ApiOkResponse({ description: "Organisation mise à jour." })
    @ApiParam({
        name: "iri",
        description: "IRI encode (URL-encoded) de l'organisation",
        example: "http%3A%2F%2Fexample.org%2Forg%2Facme",
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
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
    @ApiOperation({
        summary: "Supprimer une organisation",
        description: "Necessite le role SuperAdmin.",
    })
    @ApiOkResponse({ description: "Organisation supprimée." })
    @ApiParam({
        name: "iri",
        description: "IRI encode (URL-encoded) de l'organisation",
        example: "http%3A%2F%2Fexample.org%2Forg%2Facme",
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    deleteOrganization(@Req() req: AuthRequest, @Param("iri") iri: string) {
        return this.organizationsService.deleteOrganization(req.user.sub, decodeURIComponent(iri));
    }

    @Post(":iri/members")
    @ApiOperation({
        summary: "Ajouter un membre a une organisation",
        description: "SuperAdmin ou owner requis.",
    })
    @ApiCreatedResponse({ description: "Membre ajouté." })
    @ApiParam({
        name: "iri",
        description: "IRI encode (URL-encoded) de l'organisation",
        example: "http%3A%2F%2Fexample.org%2Forg%2Facme",
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
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
    @ApiOperation({
        summary: "Retirer un membre d'une organisation",
        description: "SuperAdmin ou owner requis.",
    })
    @ApiOkResponse({ description: "Membre retiré." })
    @ApiParam({
        name: "iri",
        description: "IRI encode (URL-encoded) de l'organisation",
        example: "http%3A%2F%2Fexample.org%2Forg%2Facme",
    })
    @ApiParam({
        name: "userIri",
        description: "IRI encode (URL-encoded) de l'utilisateur",
        example: "http%3A%2F%2Fexample.org%2Fuser%2Falice",
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
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
    @ApiOperation({ summary: "Lister les membres d'une organisation" })
    @ApiOkResponse({ type: [IriLabelDto] })
    @ApiParam({
        name: "iri",
        description: "IRI encode (URL-encoded) de l'organisation",
        example: "http%3A%2F%2Fexample.org%2Forg%2Facme",
    })
    getOrganizationMembers(@Param("iri") iri: string) {
        return this.organizationsService.getOrganizationMembers(decodeURIComponent(iri));
    }
}
