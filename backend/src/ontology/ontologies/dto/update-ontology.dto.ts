import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateOntologyDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    label?: string;

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];
}

