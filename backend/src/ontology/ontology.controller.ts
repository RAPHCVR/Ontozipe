import { diskStorage } from 'multer';
import { extname } from 'path';
import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
    UseInterceptors,
    BadRequestException,
    UploadedFile,
    UploadedFiles,
} from "@nestjs/common";
import { Request, Express } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import {
    IsArray,
    IsBoolean,
    IsUrl,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

import {
    FullSnapshot,
    OntologyService,
    NodeData,
    EdgeData,
    IndividualNode,
} from "./ontology.service";

/* ---------- DTOs imbriqués ---------- */

class PropertyDto {
    @IsUrl()
    predicate!: string;

    @IsOptional() @IsString()
    predicateLabel?: string;

    @IsString() // `value` peut être une chaîne vide, donc pas de `@IsNotEmpty`
    value!: string;

    @IsOptional() @IsString()
    valueLabel?: string;

    @IsBoolean()
    isLiteral!: boolean;
}

/* ---------- DTOs principaux ---------- */

class PdfDto {
    @IsString()
    url!: string;
    @IsString()
    originalName!: string;
}

class CreateIndividualDto {
    @IsUrl()
    id!: string;

    @IsString() @IsNotEmpty()
    label!: string;

    @IsUrl()
    classId!: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PropertyDto)
    properties!: PropertyDto[];

    /** IRI of the ontology graph where the individual will be stored */
    @IsUrl()
    ontologyIri!: string;

    /** IRIs of the groups allowed to view this individual */
    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];

    /** PDFs associés à l'individu */
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PdfDto)
    pdfs?: PdfDto[];
}

class UpdateIndividualDto {
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PropertyDto)
    addProps?: PropertyDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PropertyDto)
    delProps?: PropertyDto[];

    /** Remplace complètement la liste des groupes autorisés (optionnel) */
    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];

    /** PDFs associés à l'individu (remplacement complet) */
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PdfDto)
    pdfs?: PdfDto[];
}

/* ---------- OntologyProject DTOs ---------- */
class CreateProjectDto {
    @IsUrl()
    iri!: string;

    @IsString() @IsNotEmpty()
    label!: string;

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];
}

class UpdateProjectDto {
    @IsOptional() @IsString() @IsNotEmpty()
    label?: string;

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];
}

/* ---------- Group DTOs ---------- */
class CreateGroupDto {
    @IsString() @IsNotEmpty()
    label!: string;

    @IsUrl()
    organizationIri!: string; // IRI de l’organisation à laquelle appartient le groupe

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    members?: string[];
}

class UpdateGroupDto {
    @IsOptional() @IsString() @IsNotEmpty()
    label?: string;

    @IsOptional() @IsUrl()
    organizationIri?: string;
}

class AddMemberDto {
    @IsUrl()
    userIri!: string;
}

/* ---------- Organization DTOs ---------- */
class CreateOrganizationDto {
    @IsString() @IsNotEmpty()
    label!: string;

    @IsUrl()
    ownerIri!: string; // user who becomes admin of the org
}

class UpdateOrganizationDto {
    @IsOptional() @IsString() @IsNotEmpty()
    label?: string;

    @IsOptional() @IsUrl()
    ownerIri?: string;
}

/* ---------- Comment DTOs ---------- */
class CreateCommentDto {
    @IsString() @IsNotEmpty() // ex: urn:uuid:c2a6ac3d-7-44f2-9549-16e7a27be9f8
    id!: string;

    @IsString() @IsNotEmpty()
    body!: string;

    @IsUrl()
    onResource!: string; // IRI de la ressource cible (obligatoire)

    @IsOptional() @IsUrl()
    replyTo?: string; // IRI du commentaire parent (optionnel)

    @IsUrl()
    ontologyIri!: string;

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];
}
class UpdateCommentDto {
    @IsOptional() @IsString()
    newBody?: string;

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];

    @IsUrl()
    ontologyIri!: string;
}

type AuthRequest = Request & {
    user: { sub: string; email?: string };
};

/* ------------------------------------------------------------------ */
/* Ajoute le guard AU NIVEAU DU CONTRÔLEUR (couvre toutes les routes) */
/* ------------------------------------------------------------------ */
@UseGuards(JwtAuthGuard)
@Controller("ontology")
export class OntologyController {
    constructor(private readonly ontologyService: OntologyService) {}

    @Get("graph")
    async getGraph(
        @Req() req: AuthRequest,
        @Query("ontology") ontologyIri: string
    ): Promise<{ nodes: NodeData[]; edges: EdgeData[] }> {
        console.log("getGraph");

        return this.ontologyService.getGraph(ontologyIri);
    }

    /** Création d’un nouvel individu (IRI unique) */
    @Post("individuals")
    async createIndividual(
        @Req() req: AuthRequest,
        @Body() dto: CreateIndividualDto
    ): Promise<void> {
        console.log("createIndividual");
        return this.ontologyService.createIndividual(
            dto as unknown as IndividualNode,
            req.user.sub, // requesterIri (creator)
            dto.ontologyIri, // ontology IRI
            dto.visibleToGroups ?? [], // ACL
            dto.pdfs // PDFs
        );
    }

    /** Mise à jour d’un individu existant */
    @Patch("individuals/:iri")
    async updateIndividual(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Query("ontology") ontologyIri: string,
        @Body() dto: UpdateIndividualDto
    ): Promise<void> {
        const { addProps = [], delProps = [], visibleToGroups, pdfs } = dto;
        return this.ontologyService.updateIndividual(
            decodeURIComponent(iri),
            addProps,
            delProps,
            req.user.sub,
            visibleToGroups,
            ontologyIri,
            pdfs
        );
    }

    /** Supprimer un individu et tous ses triples */
    @Delete("individuals/:iri")
    deleteIndividual(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Query("ontology") ontologyIri: string
    ) {
        return this.ontologyService.deleteIndividual(
            decodeURIComponent(iri),
            ontologyIri,
            req.user.sub
        );
    }

    @Get("persons")
    getAllPersons(): Promise<IndividualNode[]> {
        console.log("getAllPersons");

        return this.ontologyService.getAllPersons();
    }

    /** Détails d’une personne (Individual «foaf:Person») par IRI */
    @Get("persons/:iri")
    getPerson(
        @Req() req: AuthRequest,
        @Param("iri") iri: string
    ): Promise<IndividualNode | null> {
        return this.ontologyService.getPerson(req.user.sub, decodeURIComponent(iri));
    }

    /**
     * Propriétés (data & object) applicables à une classe donnée
     */
    @Get("properties")
    getPropsForClass(
        @Query("class") classIri: string,
        @Query("ontology") ontologyIri: string,
        @Req() req: AuthRequest
    ) {
        return this.ontologyService.getClassProperties(
            classIri,
            req.user.sub,
            ontologyIri
        );
    }

    /**
     * Liste des ontologies (core:OntologyProject) visibles pour l'utilisateur
     */
    @Get("projects")
    getProjects(@Req() req: AuthRequest) {
        console.log("getProjects");

        return this.ontologyService.getProjects();
    }

    /** ---------- CRUD OntologyProject ---------- */

    /** Création d’un nouveau « projet » d’ontologie + chargement éventuel d’un fichier RDF */
    @Post("projects")
    @UseInterceptors(
        FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } })
    ) // 10 Mio max
    async createProject(
        @Req() req: AuthRequest,
        @Body() dto: CreateProjectDto,
        @UploadedFile() file?: Express.Multer.File
    ) {
        console.log("createProject");

        if (
            file &&
            !file.mimetype.startsWith("text/") &&
            !file.mimetype.includes("rdf")
        )
            throw new BadRequestException("Format de fichier RDF non reconnu");

        await this.ontologyService.createProject(
            req.user.sub,
            { ...dto, visibleToGroups: dto.visibleToGroups ?? [] },
            file
        );
        return { ok: true };
    }

    @Patch("projects/:iri")
    updateProject(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: UpdateProjectDto
    ) {
        console.log("updateProject");

        return this.ontologyService.updateProject(
            req.user.sub,
            decodeURIComponent(iri),
            dto.label,
            dto.visibleToGroups
        );
    }

    @Delete("projects/:iri")
    deleteProject(@Req() req: AuthRequest, @Param("iri") iri: string) {
        console.log("deleteProject");

        return this.ontologyService.deleteProject(
            req.user.sub,
            decodeURIComponent(iri)
        );
    }

    /** ---------- CRUD Organizations ---------- */

    /** Liste de toutes les organisations */
    @Get("organizations")
    getOrganizations(@Req() req: AuthRequest, @Query("mine") mine?: string) {
        console.log("getOrganizations");

        if (mine === "true") {
            return this.ontologyService.getOrganizationsForUser(req.user.sub);
        }
        return this.ontologyService.getOrganizations();
    }

    /** Création d’une organisation (Super‑admin only) */
    @Post("organizations")
    createOrganization(
        @Req() req: AuthRequest,
        @Body() dto: CreateOrganizationDto
    ) {
        console.log("createOrganization");

        return this.ontologyService.createOrganization(req.user.sub, dto);
    }

    /** Mise à jour d’une organisation (label ou owner) */
    @Patch("organizations/:iri")
    updateOrganization(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: UpdateOrganizationDto
    ) {
        console.log("updateOrganization");

        return this.ontologyService.updateOrganization(
            req.user.sub,
            decodeURIComponent(iri),
            {
                newLabel: dto.label,
                newOwner: dto.ownerIri,
            }
        );
    }

    /** Suppression d’une organisation */
    @Delete("organizations/:iri")
    deleteOrganization(@Req() req: AuthRequest, @Param("iri") iri: string) {
        console.log("deleteOrganization");

        return this.ontologyService.deleteOrganization(
            req.user.sub,
            decodeURIComponent(iri)
        );
    }

    /** Ajoute un membre à l’organisation */
    @Post("organizations/:iri/members")
    addOrganizationMember(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: AddMemberDto
    ) {
        console.log("addOrganizationMember");

        return this.ontologyService.addOrganizationMember(
            req.user.sub,
            decodeURIComponent(iri),
            dto.userIri
        );
    }

    /** Retire un membre de l’organisation */
    @Delete("organizations/:iri/members/:userIri")
    removeOrganizationMember(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Param("userIri") target: string
    ) {
        console.log("removeOrganizationMember");

        return this.ontologyService.removeOrganizationMember(
            req.user.sub,
            decodeURIComponent(iri),
            target
        );
    }

    /** Liste des membres d’une organisation (owner + via groupes) */
    @Get("organizations/:iri/members")
    getOrganizationMembers(@Param("iri") iri: string) {
        console.log("getOrganizationMembers");

        return this.ontologyService.getOrganizationMembers(decodeURIComponent(iri));
    }

    /** ---------- CRUD Groups ---------- */
    /** Liste des groupes auxquels appartient l’utilisateur connecté */
    @Get("groups")
    getGroups(@Req() req: AuthRequest) {
        console.log("getGroups");

        return this.ontologyService.getGroups(req.user.sub);
    }

    @Post("groups")
    async createGroup(@Req() req: AuthRequest, @Body() dto: CreateGroupDto) {
        console.log("createGroup");

        return this.ontologyService.createGroup(
            dto.label,
            req.user.sub,
            dto.organizationIri,
            dto.members ?? []
        );
    }

    @Patch("groups/:iri")
    async updateGroup(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: UpdateGroupDto
    ) {
        const groupIri = decodeURIComponent(iri);

        // Au moins un champ doit être présent
        if (dto.label === undefined && dto.organizationIri === undefined) {
            throw new BadRequestException("Aucun champ à mettre à jour");
        }

        // Si label est présent, on met à jour le libellé
        if (dto.label !== undefined) {
            await this.ontologyService.updateGroupLabel(
                req.user.sub,
                groupIri,
                dto.label
            );
        }

        // Si organizationIri est présent, on rattache à cette organisation
        if (dto.organizationIri !== undefined) {
            await this.ontologyService.updateGroupOrganization(
                req.user.sub,
                groupIri,
                dto.organizationIri
            );
        }

        return { ok: true };
    }

    @Post("groups/:iri/members")
    addGroupMember(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: AddMemberDto
    ) {
        console.log("addGroupMember");

        return this.ontologyService.addGroupMember(
            req.user.sub,
            decodeURIComponent(iri),
            dto.userIri
        );
    }

    @Delete("groups/:iri/members/:user")
    removeGroupMember(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Param("user") userIri: string
    ) {
        console.log("removeGroupMember");

        return this.ontologyService.removeGroupMember(
            req.user.sub,
            decodeURIComponent(iri),
            userIri
        );
    }

    @Delete("groups/:iri")
    deleteGroup(@Req() req: AuthRequest, @Param("iri") iri: string) {
        console.log("deleteGroup");

        return this.ontologyService.deleteGroup(
            req.user.sub,
            decodeURIComponent(iri)
        );
    }

    /* ---------- CRUD Comments ---------- */

    /** Liste des commentaires visibles pour la ressource */
    @Get("comments")
    getComments(
        @Req() req: AuthRequest,
        @Query("resource") resourceIri: string,
        @Query("ontology") ontologyIri: string
    ) {
        console.log("getComments");
        return this.ontologyService.getCommentsForResource(
            req.user.sub,
            decodeURIComponent(resourceIri),
            ontologyIri
        );
    }

    /** Création d’un nouveau commentaire */
    @Post("comments")
    createComment(@Req() req: AuthRequest, @Body() dto: CreateCommentDto) {
        console.log("createComment");
        return this.ontologyService.createComment(
            dto,
            req.user.sub,
            dto.ontologyIri
        );
    }

    /** Mise à jour d’un commentaire */
    @Patch("comments/:iri")
    updateComment(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Body() dto: UpdateCommentDto
    ) {
        console.log("updateComment");
        return this.ontologyService.updateComment(
            decodeURIComponent(iri),
            { newBody: dto.newBody, visibleTo: dto.visibleToGroups },
            req.user.sub,
            dto.ontologyIri
        );
    }

    /**
     * Upload d'un fichier PDF pour l'associer à un individu
     * Retourne l'URL du fichier uploadé
     */
    @Post('upload-pdf')
    @UseInterceptors(FilesInterceptor('files', 10, {
        storage: diskStorage({
            destination: './uploads',
            filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, uniqueSuffix + extname(file.originalname));
            }
        }),
        fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
            if (file.mimetype === 'application/pdf') cb(null, true);
            else cb(new BadRequestException('Seuls les fichiers PDF sont acceptés.'), false);
        }
    }))
    uploadPdfs(@UploadedFiles() files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException('Aucun fichier PDF reçu.');
        }
        return files.map(file => ({
            url: `/uploads/${file.filename}`,
            originalName: file.originalname
        }));
    }

    /** Suppression d’un commentaire */
    @Delete("comments/:iri")
    deleteComment(
        @Req() req: AuthRequest,
        @Param("iri") iri: string,
        @Query("ontology") ontologyIri: string
    ) {
        console.log("deleteComment");
        return this.ontologyService.deleteComment(
            decodeURIComponent(iri),
            ontologyIri,
            req.user.sub
        );
    }

    /**
     * Snapshot complet (graph + individus + users) filtré par droits
     */
    @Get("snapshot")
    getSnapshot(
        @Req() req: AuthRequest,
        @Query("ontology") ontologyIri: string
    ): Promise<FullSnapshot> {
        console.log("getSnapshot");
        return this.ontologyService.getFullSnapshot(req.user.sub, ontologyIri);
    }
}