import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateIf, ValidateNested } from "class-validator";

import { LocalizedLabelDto } from "./localized-label.dto";

export class CreateOntologyDto {
    @IsUrl()
    iri!: string;

    @ValidateIf((dto) => !dto.labels || dto.labels.length === 0)
    @IsString()
    @IsNotEmpty()
    label?: string;

    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => LocalizedLabelDto)
    labels?: LocalizedLabelDto[];

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];
}

