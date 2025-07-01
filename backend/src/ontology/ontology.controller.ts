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
} from "@nestjs/common";
import { Request, Express } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { FileInterceptor } from "@nestjs/platform-express";

import {
	FullSnapshot,
	OntologyService,
	NodeData,
	EdgeData,
	IndividualNode,
	Property,
} from "./ontology.service";
import { on } from "events";

interface CreateIndividualDto extends IndividualNode {
	/** IRI of the ontology graph where the individual will be stored */
	ontologyIri: string;
	/** IRIs of the groups allowed to view this individual */
	visibleToGroups?: string[];
}
interface UpdateIndividualDto {
	addProps?: Property[];
	delProps?: Property[];
	/** Remplace complètement la liste des groupes autorisés (optionnel) */
	visibleToGroups?: string[];
}

/* ---------- OntologyProject DTOs ---------- */
interface CreateProjectDto {
	iri: string;
	label: string;
	visibleToGroups?: string[];
	/** RDF/Turtle content used to initialise the dataset (optional) */
	initRdf?: string;
}
interface UpdateProjectDto {
	label?: string;
	visibleToGroups?: string[];
}

/* ---------- Group DTOs ---------- */
interface CreateGroupDto {
	label: string;
	organizationIri: string; // IRI de l’organisation à laquelle appartient le groupe
	members?: string[];
}
interface UpdateGroupLabelDto {
	label: string;
}
interface AddMemberDto {
	userIri: string;
}

/* ---------- Organization DTOs ---------- */
interface CreateOrganizationDto {
	label: string;
	ownerIri: string; // user who becomes admin of the org
}
interface UpdateOrganizationDto {
	label?: string;
	ownerIri?: string;
}

/* ---------- Comment DTOs ---------- */
interface CreateCommentDto {
	id: string;
	body: string;
	onResource: string; // IRI de la ressource cible (obligatoire)
	replyTo?: string; // IRI du commentaire parent (optionnel)
	ontologyIri: string;
	visibleToGroups?: string[];
}
interface UpdateCommentDto {
	newBody?: string;
	visibleToGroups?: string[];
	ontologyIri: string;
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
			dto, // IndividualNode (+ extra fields)
			req.user.sub, // requesterIri (creator)
			dto.ontologyIri, // ontology IRI
			dto.visibleToGroups ?? [] // ACL
		);
	}

	/** Mise à jour d’un individu existant */
	@Patch("individuals/:iri")
	async updateIndividual(
		@Req() req: AuthRequest,
		@Param("iri") iri: string,
		@Body() dto: UpdateIndividualDto
	): Promise<void> {
		const { addProps = [], delProps = [], visibleToGroups } = dto;
		console.log("updateIndividual");

		return this.ontologyService.updateIndividual(
			decodeURIComponent(iri), // target individual IRI
			addProps,
			delProps,
			req.user.sub, // requesterIri (for ACL check)
			visibleToGroups // new ACL (optional)
		);
	}

	/** Supprimer un individu et tous ses triples */
	@Delete("individuals/:iri")
	deleteIndividual(@Req() req: AuthRequest, @Param("iri") iri: string) {
		console.log("deleteIndividual");

		return this.ontologyService.deleteIndividual(
			req.user.sub,
			decodeURIComponent(iri)
		);
	}

	@Get("persons")
	getAllPersons(): Promise<IndividualNode[]> {
		console.log("getAllPersons");

		return this.ontologyService.getAllPersons();
	}

	/** Détails d’une personne (Individual « foaf:Person ») par IRI */
	@Get("persons/:iri")
	getPerson(
		@Req() req: AuthRequest,
		@Param("iri") iri: string
	): Promise<IndividualNode | null> {
		console.log("getPerson");
		return this.ontologyService.getPerson(req.user.sub, iri);
	}

	/**
	 * Propriétés (data & object) applicables à une classe donnée
	 */
	@Get("properties")
	getPropsForClass(@Query("class") classIri: string, @Req() req: AuthRequest) {
		console.log("getPropsForClass");

		return this.ontologyService.getClassProperties(classIri, req.user.sub);
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
		@Body() dto: { iri: string; label: string; visibleToGroups?: string[] },
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
		@Body("userIri") userIri: string
	) {
		console.log("addOrganizationMember");

		return this.ontologyService.addOrganizationMember(
			req.user.sub,
			decodeURIComponent(iri),
			userIri
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
	updateGroupLabel(
		@Req() req: AuthRequest,
		@Param("iri") iri: string,
		@Body() dto: UpdateGroupLabelDto
	) {
		console.log("updateGroupLabel");

		return this.ontologyService.updateGroupLabel(
			req.user.sub,
			decodeURIComponent(iri),
			dto.label
		);
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
			ontologyIri
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
