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
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiHeader,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Request, Express } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { extname } from "path";

import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { OntologiesService } from "./ontologies.service";
import { CreateOntologyDto } from "./dto/create-ontology.dto";
import { UpdateOntologyDto } from "./dto/update-ontology.dto";
import {
	ClassPropertiesResponseDto,
	FullSnapshotDto,
	GraphDto,
	OntologyProjectSummaryDto,
} from "../common/dto/ontology-response.dto";
import { ApiErrorDto } from "../../common/dto/api-error.dto";
import { OkResponseDto } from "../../common/dto/standard-response.dto";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@ApiTags("Ontologies")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto })
@UseGuards(JwtAuthGuard)
@Controller("ontologies")
export class OntologiesController {
	constructor(private readonly ontologiesService: OntologiesService) {}

	private resolveLang(
		lang?: string,
		acceptLanguage?: string
	): string | undefined {
		const direct = lang?.trim();
		if (direct) return direct;
		if (!acceptLanguage) return undefined;
		for (const part of acceptLanguage.split(",")) {
			const value = part.split(";")[0]?.trim();
			if (value) return value;
		}
		return undefined;
	}

	@Get()
	@ApiOperation({ summary: "Lister les ontologies" })
	@ApiOkResponse({ type: [OntologyProjectSummaryDto] })
	@ApiQuery({ name: "lang", required: false, type: String, example: "fr" })
	@ApiHeader({
		name: "accept-language",
		required: false,
		description: "Langues préférées (ex: fr, en-GB).",
	})
	getProjects(
		@Query("lang") lang?: string,
		@Headers("accept-language") acceptLanguage?: string
	) {
		return this.ontologiesService.getProjects(lang, acceptLanguage);
	}

	@Post()
	@ApiOperation({ summary: "Creer une ontologie (optionnel: fichier RDF)" })
	@ApiConsumes("multipart/form-data")
	@ApiBody({
		schema: {
			type: "object",
			properties: {
				iri: { type: "string", format: "uri", example: "http://example.org/ontology/core" },
				label: { type: "string", example: "Core Ontology" },
				labels: {
					type: "array",
					items: {
						type: "object",
						properties: {
							value: { type: "string", example: "Ontologie coeur" },
							lang: { type: "string", example: "fr" },
						},
					},
				},
				visibleToGroups: {
					type: "array",
					items: { type: "string", format: "uri" },
					example: ["http://example.org/group/research"],
				},
				file: { type: "string", format: "binary" },
			},
			required: ["iri"],
		},
	})
	@ApiCreatedResponse({ type: OkResponseDto })
	@ApiBadRequestResponse({ type: ApiErrorDto })
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } })
	)
	async createProject(
		@Req() req: AuthRequest,
		@Body() dto: CreateOntologyDto,
		@UploadedFile() file?: Express.Multer.File
	) {
		if (file && !this.isSupportedRdf(file)) {
			throw new BadRequestException("Format de fichier RDF non reconnu");
		}
		await this.ontologiesService
			.createProject(
				req.user.sub,
				{ ...dto, visibleToGroups: dto.visibleToGroups ?? [] },
				file
			)
			.then(() => {
				// no-op, successful creation
			});
		return { ok: true };
	}

	@Patch(":iri")
	@ApiOperation({
		summary: "Mettre a jour une ontologie",
		description: "SuperAdmin ou owner de l'ontologie requis.",
	})
	@ApiOkResponse({ description: "Ontologie mise à jour." })
	@ApiParam({
		name: "iri",
		description: "IRI encode (URL-encoded) de l'ontologie",
		example: "http%3A%2F%2Fexample.org%2Fontology%2Fcore",
	})
	@ApiBadRequestResponse({ type: ApiErrorDto })
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
	@ApiOperation({
		summary: "Supprimer une ontologie",
		description: "SuperAdmin ou owner de l'ontologie requis.",
	})
	@ApiOkResponse({ description: "Ontologie supprimée." })
	@ApiParam({
		name: "iri",
		description: "IRI encode (URL-encoded) de l'ontologie",
		example: "http%3A%2F%2Fexample.org%2Fontology%2Fcore",
	})
	@ApiBadRequestResponse({ type: ApiErrorDto })
	deleteProject(@Req() req: AuthRequest, @Param("iri") iri: string) {
		return this.ontologiesService.deleteProject(
			req.user.sub,
			decodeURIComponent(iri)
		);
	}

	@Get(":iri/graph")
	@ApiOperation({ summary: "Recuperer le graphe de l'ontologie (classes)" })
	@ApiOkResponse({ type: GraphDto })
	@ApiParam({
		name: "iri",
		description: "IRI encode (URL-encoded) de l'ontologie",
		example: "http%3A%2F%2Fexample.org%2Fontology%2Fcore",
	})
	@ApiQuery({ name: "lang", required: false, type: String, example: "fr" })
	@ApiHeader({
		name: "accept-language",
		required: false,
		description: "Langues préférées (ex: fr, en-GB).",
	})
	getGraph(
		@Param("iri") iri: string,
		@Query("lang") lang?: string,
		@Headers("accept-language") acceptLanguage?: string
	) {
		const preferredLang = this.resolveLang(lang, acceptLanguage);
		return this.ontologiesService.getGraph(
			decodeURIComponent(iri),
			preferredLang
		);
	}

	@Get(":iri/properties")
	@ApiOperation({ summary: "Lister les proprietes d'une classe" })
	@ApiOkResponse({ type: ClassPropertiesResponseDto })
	@ApiParam({
		name: "iri",
		description: "IRI encode (URL-encoded) de l'ontologie",
		example: "http%3A%2F%2Fexample.org%2Fontology%2Fcore",
	})
	@ApiQuery({
		name: "class",
		required: true,
		type: String,
		example: "http://example.org/ontology#Person",
	})
	@ApiQuery({ name: "lang", required: false, type: String, example: "fr" })
	@ApiHeader({
		name: "accept-language",
		required: false,
		description: "Langues préférées (ex: fr, en-GB).",
	})
	@ApiBadRequestResponse({ type: ApiErrorDto })
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
	@ApiOperation({ summary: "Recuperer le snapshot complet d'une ontologie" })
	@ApiOkResponse({ type: FullSnapshotDto })
	@ApiParam({
		name: "iri",
		description: "IRI encode (URL-encoded) de l'ontologie",
		example: "http%3A%2F%2Fexample.org%2Fontology%2Fcore",
	})
	@ApiQuery({ name: "lang", required: false, type: String, example: "fr" })
	@ApiHeader({
		name: "accept-language",
		required: false,
		description: "Langues préférées (ex: fr, en-GB).",
	})
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

	private isSupportedRdf(file: Express.Multer.File): boolean {
		const mime = (file.mimetype || "").toLowerCase();
		const ext = extname(file.originalname || "").toLowerCase();

		// Common RDF/OWL/Turtle/NTriples/JSON-LD mimes
		const allowedMimes = new Set([
			"application/rdf+xml",
			"application/owl+xml",
			"application/xml",
			"text/xml",
			"text/turtle",
			"application/ld+json",
			"application/json",
			"application/n-triples",
			"application/n-quads",
			"application/trig",
			"text/plain",
			"application/octet-stream", // some browsers send this for downloads
		]);
		if (
			mime &&
			(mime.startsWith("text/") ||
				mime.includes("rdf") ||
				allowedMimes.has(mime))
		) {
			return true;
		}

		// Fallback on file extension
		const allowedExt = new Set([
			".rdf",
			".owl",
			".ttl",
			".nt",
			".nq",
			".trig",
			".jsonld",
			".xml",
		]);
		return allowedExt.has(ext);
	}
}
