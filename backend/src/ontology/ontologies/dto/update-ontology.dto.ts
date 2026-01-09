import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateNested } from "class-validator";

import { LocalizedLabelDto } from "./localized-label.dto";

export class UpdateOntologyDto {
    @ApiPropertyOptional({ example: "Core Ontology" })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    label?: string;

    @ApiPropertyOptional({ type: [LocalizedLabelDto] })
    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => LocalizedLabelDto)
    labels?: LocalizedLabelDto[];

    @ApiPropertyOptional({
        example: ["http://example.org/group/research"],
    })
    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];
}
