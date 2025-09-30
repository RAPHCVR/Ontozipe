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
    UseGuards,
} from "@nestjs/common";
import { Request } from "express";

import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { IndividualsService } from "./individuals.service";
import { CreateIndividualDto } from "./dto/create-individual.dto";
import { UpdateIndividualDto } from "./dto/update-individual.dto";
import { IndividualNode } from "../common/types";

type AuthRequest = Request & { user: { sub: string; email?: string } };

@UseGuards(JwtAuthGuard)
@Controller("individuals")
export class IndividualsController {
    constructor(private readonly individualsService: IndividualsService) {}

    @Post()
    createIndividual(@Req() req: AuthRequest, @Body() dto: CreateIndividualDto): Promise<void> {
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
            dto.visibleToGroups ?? []
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
            ontologyIri
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

    @Get("persons")
    getAllPersons(
        @Headers("accept-language") acceptLanguage?: string,
        @Query("lang") lang?: string
    ): Promise<IndividualNode[]> {
        return this.individualsService.getAllPersons(this.resolveLang(lang, acceptLanguage));
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
}
