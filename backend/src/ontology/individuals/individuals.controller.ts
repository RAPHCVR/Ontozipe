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

    @Get("persons")
    getAllPersons(): Promise<IndividualNode[]> {
        return this.individualsService.getAllPersons();
    }

    @Get("persons/:iri")
    getPerson(@Param("iri") iri: string): Promise<IndividualNode | null> {
        return this.individualsService.getPerson(decodeURIComponent(iri));
    }
}
