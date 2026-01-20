import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateIf, ValidateNested } from "class-validator";

import { LocalizedLabelDto } from "./localized-label.dto";

export class CreateOntologyDto {
    @ApiProperty({ example: "http://example.org/ontology/core" })
    @IsUrl()
    iri!: string;

    @ApiPropertyOptional({ example: "Core Ontology" })
    @ValidateIf((dto) => !dto.labels || dto.labels.length === 0)
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
