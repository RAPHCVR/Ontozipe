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
import { Request } from "express";

import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { IndividualsService } from "./individuals.service";
import { CreateIndividualDto } from "./dto/create-individual.dto";
import { UpdateIndividualDto } from "./dto/update-individual.dto";
import { IndividualNode } from "../common/types";
import { FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@UseGuards(JwtAuthGuard)
@Controller("individuals")
export class IndividualsController {
	constructor(private readonly individualsService: IndividualsService) {}

	@Post()
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
	getAllPersons(
		@Headers("accept-language") acceptLanguage?: string,
		@Query("lang") lang?: string
	): Promise<IndividualNode[]> {
		return this.individualsService.getAllPersons(
			this.resolveLang(lang, acceptLanguage)
		);
	}

	@Get("persons/:iri")
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
