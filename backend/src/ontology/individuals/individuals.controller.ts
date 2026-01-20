import {
	BadRequestException,
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
	UploadedFiles,
	UseGuards,
	UseInterceptors,
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
import { Request } from "express";

import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { IndividualsService } from "./individuals.service";
import { CreateIndividualDto } from "./dto/create-individual.dto";
import { UpdateIndividualDto } from "./dto/update-individual.dto";
import { IndividualNode } from "../common/types";
import { FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { IndividualNodeDto } from "../common/dto/ontology-response.dto";
import { UploadedPdfDto } from "./dto/uploaded-pdf.dto";
import { ApiErrorDto } from "../../common/dto/api-error.dto";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@ApiTags("Individuals")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto })
@UseGuards(JwtAuthGuard)
@Controller("individuals")
export class IndividualsController {
	constructor(private readonly individualsService: IndividualsService) {}

	@Post()
	@ApiOperation({
		summary: "Creer un individu",
		description: "Droits d'ecriture sur l'ontologie requis.",
	})
	@ApiCreatedResponse({ description: "Individu créé." })
	@ApiBadRequestResponse({ type: ApiErrorDto })
	createIndividual(
		@Req() req: AuthRequest,
		@Body() dto: CreateIndividualDto
	): Promise<void> {
		const node: IndividualNode = {
			id: dto.id,
			label: dto.label,
			classId: dto.classId,
			properties: dto.properties,
			children: [],
		};

		return this.individualsService.createIndividual(
			node,
			req.user.sub,
			dto.ontologyIri,
			dto.visibleToGroups ?? [],
			dto.pdfs // PDFs
		);
	}

	@Patch(":iri")
	@ApiOperation({
		summary: "Mettre a jour un individu",
		description: "Droits d'ecriture sur l'ontologie requis.",
	})
	@ApiOkResponse({ description: "Individu mis à jour." })
	@ApiParam({
		name: "iri",
		description: "IRI encode (URL-encoded) de l'individu",
		example: "http%3A%2F%2Fexample.org%2Findiv%2F123",
	})
	@ApiQuery({
		name: "ontology",
		required: true,
		type: String,
		example: "http://example.org/ontology/core",
	})
	@ApiBadRequestResponse({ type: ApiErrorDto })
	updateIndividual(
		@Req() req: AuthRequest,
		@Param("iri") iri: string,
		@Query("ontology") ontologyIri: string,
		@Body() dto: UpdateIndividualDto
	): Promise<void> {
		return this.individualsService.updateIndividual(
			decodeURIComponent(iri),
			dto.addProps,
			dto.delProps,
			req.user.sub,
			dto.visibleToGroups,
			ontologyIri,
			dto.pdfs // PDFs
		);
	}

	@Delete(":iri")
	@ApiOperation({
		summary: "Supprimer un individu",
		description: "Droits d'ecriture sur l'ontologie requis.",
	})
	@ApiOkResponse({ description: "Individu supprimé." })
	@ApiParam({
		name: "iri",
		description: "IRI encode (URL-encoded) de l'individu",
		example: "http%3A%2F%2Fexample.org%2Findiv%2F123",
	})
	@ApiQuery({
		name: "ontology",
		required: true,
		type: String,
		example: "http://example.org/ontology/core",
	})
	@ApiBadRequestResponse({ type: ApiErrorDto })
	deleteIndividual(
		@Req() req: AuthRequest,
		@Param("iri") iri: string,
		@Query("ontology") ontologyIri: string
	): Promise<void> {
		return this.individualsService.deleteIndividual(
			decodeURIComponent(iri),
			ontologyIri,
			req.user.sub
		);
	}

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

	@Get("persons")
	@ApiOperation({ summary: "Lister les personnes (individus de type Person)" })
	@ApiOkResponse({ type: [IndividualNodeDto] })
	@ApiQuery({ name: "lang", required: false, type: String, example: "fr" })
	@ApiHeader({
		name: "accept-language",
		required: false,
		description: "Langues préférées (ex: fr, en-GB).",
	})
	getAllPersons(
		@Headers("accept-language") acceptLanguage?: string,
		@Query("lang") lang?: string
	): Promise<IndividualNode[]> {
		return this.individualsService.getAllPersons(
			this.resolveLang(lang, acceptLanguage)
		);
	}

	@Get("persons/:iri")
	@ApiOperation({ summary: "Récupérer une personne" })
	@ApiOkResponse({ type: IndividualNodeDto })
	@ApiParam({
		name: "iri",
		description: "IRI encode (URL-encoded) de la personne",
		example: "http%3A%2F%2Fexample.org%2Findiv%2F123",
	})
	@ApiQuery({ name: "lang", required: false, type: String, example: "fr" })
	@ApiHeader({
		name: "accept-language",
		required: false,
		description: "Langues préférées (ex: fr, en-GB).",
	})
	getPerson(
		@Param("iri") iri: string,
		@Headers("accept-language") acceptLanguage?: string,
		@Query("lang") lang?: string
	): Promise<IndividualNode | null> {
		return this.individualsService.getPerson(
			decodeURIComponent(iri),
			this.resolveLang(lang, acceptLanguage)
		);
	}

	/**
	 * Upload d'un fichier PDF pour l'associer à un individu
	 * Retourne l'URL du fichier uploadé
	 */
	@Post("upload-pdf")
	@ApiOperation({ summary: "Uploader des PDFs pour un individu" })
	@ApiConsumes("multipart/form-data")
	@ApiCreatedResponse({ type: [UploadedPdfDto] })
	@ApiBadRequestResponse({ type: ApiErrorDto })
	@ApiBody({
		schema: {
			type: "object",
			properties: {
				files: {
					type: "array",
					items: { type: "string", format: "binary" },
				},
			},
			required: ["files"],
		},
	})
	@UseInterceptors(
		FilesInterceptor("files", 10, {
			storage: diskStorage({
				destination: "./uploads",
				filename: (
					req: Request,
					file: Express.Multer.File,
					cb: (error: Error | null, filename: string) => void
				) => {
					const uniqueSuffix =
						Date.now() + "-" + Math.round(Math.random() * 1e9);
					cb(null, uniqueSuffix + extname(file.originalname));
				},
			}),
			fileFilter: (
				req: Request,
				file: Express.Multer.File,
				cb: (error: Error | null, acceptFile: boolean) => void
			) => {
				if (file.mimetype === "application/pdf") cb(null, true);
				else
					cb(
						new BadRequestException("Seuls les fichiers PDF sont acceptés."),
						false
					);
			},
		})
	)
	uploadPdfs(@UploadedFiles() files: Express.Multer.File[]) {
		if (!files || files.length === 0) {
			throw new BadRequestException("Aucun fichier PDF reçu.");
		}
		return files.map((file) => ({
			url: `/uploads/${file.filename}`,
			originalName: file.originalname,
		}));
	}
}
