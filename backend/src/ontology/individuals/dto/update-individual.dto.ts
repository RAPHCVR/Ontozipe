import { Type } from "class-transformer";
import { IsArray, IsOptional, IsUrl, ValidateNested } from "class-validator";

import { PropertyDto } from "./property.dto";

export class UpdateIndividualDto {
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PropertyDto)
    addProps?: PropertyDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PropertyDto)
    delProps?: PropertyDto[];

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];
}

