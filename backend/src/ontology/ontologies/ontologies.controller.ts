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

    @Get()
    getProjects() {
        return this.ontologiesService.getProjects();
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
            dto.visibleToGroups
        );
    }

    @Delete(":iri")
    deleteProject(@Req() req: AuthRequest, @Param("iri") iri: string) {
        return this.ontologiesService.deleteProject(req.user.sub, decodeURIComponent(iri));
    }

    @Get(":iri/graph")
    getGraph(@Param("iri") iri: string) {
        return this.ontologiesService.getGraph(decodeURIComponent(iri));
    }

    @Get(":iri/properties")
    getClassProperties(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Query("class") classIri: string
    ) {
        if (!classIri) {
            throw new BadRequestException("class query parameter is required");
        }
        return this.ontologiesService.getClassProperties(classIri, req.user.sub, decodeURIComponent(iri));
    }

    @Get(":iri/snapshot")
    getSnapshot(@Req() req: AuthRequest, @Param("iri") iri: string) {
        return this.ontologiesService.getFullSnapshot(req.user.sub, decodeURIComponent(iri));
    }
}

