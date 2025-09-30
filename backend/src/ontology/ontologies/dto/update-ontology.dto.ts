import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateNested } from "class-validator";

import { LocalizedLabelDto } from "./localized-label.dto";

export class UpdateOntologyDto {
    @IsOptional()
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

