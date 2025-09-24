import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

export class CreateOntologyDto {
    @IsUrl()
    iri!: string;

    @IsString()
    @IsNotEmpty()
    label!: string;

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];
}

