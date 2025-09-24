import { IsArray, IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateCommentDto {
    @IsOptional()
    @IsString()
    newBody?: string;

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];

    @IsUrl()
    ontologyIri!: string;
}

