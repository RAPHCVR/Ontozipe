import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateNested } from "class-validator";

import { PropertyDto } from "./property.dto";

export class CreateIndividualDto {
    @IsUrl()
    id!: string;

    @IsString()
    @IsNotEmpty()
    label!: string;

    @IsUrl()
    classId!: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PropertyDto)
    properties!: PropertyDto[];

    @IsUrl()
    ontologyIri!: string;

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];
}

