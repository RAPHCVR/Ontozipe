import {
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
    BadRequestException,
} from "@nestjs/common";
import { Request, Express } from "express";
import { FileInterceptor } from "@nestjs/platform-express";

import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { OntologiesService } from "./ontologies.service";
import { CreateOntologyDto } from "./dto/create-ontology.dto";
import { UpdateOntologyDto } from "./dto/update-ontology.dto";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@UseGuards(JwtAuthGuard)
@Controller("ontologies")
export class OntologiesController {
    constructor(private readonly ontologiesService: OntologiesService) {}

    private resolveLang(lang?: string, acceptLanguage?: string): string | undefined {
        const direct = lang?.trim();
        if (direct) return direct;
        if (!acceptLanguage) return undefined;
        for (const part of acceptLanguage.split(',')) {
            const value = part.split(';')[0]?.trim();
            if (value) return value;
        }
        return undefined;
    }


    @Get()
    getProjects(
        @Query("lang") lang?: string,
        @Headers("accept-language") acceptLanguage?: string
    ) {
        return this.ontologiesService.getProjects(lang, acceptLanguage);
    }


    @Post()
    @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
    async createProject(
        @Req() req: AuthRequest,
        @Body() dto: CreateOntologyDto,
        @UploadedFile() file?: Express.Multer.File
    ) {
        if (file && !file.mimetype.startsWith("text/") && !file.mimetype.includes("rdf")) {
            throw new BadRequestException("Format de fichier RDF non reconnu");
        }

        await this.ontologiesService.createProject(
            req.user.sub,
            { ...dto, visibleToGroups: dto.visibleToGroups ?? [] },
            file
        );
        return { ok: true };
    }

    @Patch(":iri")
    updateProject(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: UpdateOntologyDto
    ) {
        return this.ontologiesService.updateProject(
            req.user.sub,
            decodeURIComponent(iri),
            dto.label,
            dto.visibleToGroups,
            dto.labels
        );
    }

    @Delete(":iri")
    deleteProject(@Req() req: AuthRequest, @Param("iri") iri: string) {
        return this.ontologiesService.deleteProject(req.user.sub, decodeURIComponent(iri));
    }

    @Get(":iri/graph")
    getGraph(
        @Param("iri") iri: string,
        @Query("lang") lang?: string,
        @Headers("accept-language") acceptLanguage?: string
    ) {
        const preferredLang = this.resolveLang(lang, acceptLanguage);
        return this.ontologiesService.getGraph(decodeURIComponent(iri), preferredLang);
    }


    @Get(":iri/properties")
    getClassProperties(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Query("class") classIri: string,
        @Query("lang") lang?: string,
        @Headers("accept-language") acceptLanguage?: string
    ) {
        if (!classIri) {
            throw new BadRequestException("class query parameter is required");
        }
        return this.ontologiesService.getClassProperties(
            classIri,
            req.user.sub,
            decodeURIComponent(iri),
            lang,
            acceptLanguage
        );
    }


    @Get(":iri/snapshot")
    getSnapshot(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Query("lang") lang?: string,
        @Headers("accept-language") acceptLanguage?: string
    ) {
        return this.ontologiesService.getFullSnapshot(
            req.user.sub,
            decodeURIComponent(iri),
            lang,
            acceptLanguage
        );
    }
}

