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
import { CommentsService } from "./comments.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@UseGuards(JwtAuthGuard)
@Controller("comments")
export class CommentsController {
    constructor(private readonly commentsService: CommentsService) {}

    @Get()
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

