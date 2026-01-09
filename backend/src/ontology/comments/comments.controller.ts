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
import { CommentsService } from "./comments.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";
import { CommentNodeDto } from "../common/dto/ontology-response.dto";
import { ApiErrorDto } from "../../common/dto/api-error.dto";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@ApiTags("Comments")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto })
@UseGuards(JwtAuthGuard)
@Controller("comments")
export class CommentsController {
    constructor(private readonly commentsService: CommentsService) {}

    @Get()
    @ApiOperation({ summary: "Lister les commentaires d'une ressource" })
    @ApiOkResponse({ type: [CommentNodeDto] })
    @ApiQuery({
        name: "resource",
        required: true,
        type: String,
        example: "http://example.org/indiv/123",
    })
    @ApiQuery({
        name: "ontology",
        required: true,
        type: String,
        example: "http://example.org/ontology/core",
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    getComments(
        @Req() req: AuthRequest,
        @Query("resource") resourceIri: string,
        @Query("ontology") ontologyIri: string
    ) {
        return this.commentsService.getCommentsForResource(
            req.user.sub,
            decodeURIComponent(resourceIri),
            ontologyIri
        );
    }

    @Post()
    @ApiOperation({
        summary: "Creer un commentaire",
        description: "Droits d'ecriture sur l'ontologie requis.",
    })
    @ApiCreatedResponse({ description: "Commentaire créé." })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    createComment(@Req() req: AuthRequest, @Body() dto: CreateCommentDto) {
        return this.commentsService.createComment(
            {
                id: dto.id,
                body: dto.body,
                onResource: dto.onResource,
                replyTo: dto.replyTo,
                visibleTo: dto.visibleToGroups ?? [],
            },
            req.user.sub,
            dto.ontologyIri
        );
    }

    @Patch(":iri")
    @ApiOperation({
        summary: "Mettre a jour un commentaire",
        description: "Droits d'ecriture sur l'ontologie requis.",
    })
    @ApiOkResponse({ description: "Commentaire mis à jour." })
    @ApiParam({
        name: "iri",
        description: "IRI encode (URL-encoded) du commentaire",
        example: "http%3A%2F%2Fexample.org%2Fcomment%2F123",
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    updateComment(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: UpdateCommentDto
    ) {
        return this.commentsService.updateComment(
            decodeURIComponent(iri),
            { newBody: dto.newBody, visibleTo: dto.visibleToGroups },
            req.user.sub,
            dto.ontologyIri
        );
    }

    @Delete(":iri")
    @ApiOperation({
        summary: "Supprimer un commentaire",
        description: "Droits d'ecriture sur l'ontologie requis.",
    })
    @ApiOkResponse({ description: "Commentaire supprimé." })
    @ApiParam({
        name: "iri",
        description: "IRI encode (URL-encoded) du commentaire",
        example: "http%3A%2F%2Fexample.org%2Fcomment%2F123",
    })
    @ApiQuery({
        name: "ontology",
        required: true,
        type: String,
        example: "http://example.org/ontology/core",
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    deleteComment(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Query("ontology") ontologyIri: string
    ) {
        return this.commentsService.deleteComment(
            decodeURIComponent(iri),
            ontologyIri,
            req.user.sub
        );
    }
}
