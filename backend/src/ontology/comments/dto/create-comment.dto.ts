import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

export class CreateCommentDto {
    @IsString()
    @IsNotEmpty()
    id!: string;

    @IsString()
    @IsNotEmpty()
    body!: string;

    @IsUrl()
    onResource!: string;

    @IsOptional()
    @IsUrl()
    replyTo?: string;

    @IsUrl()
    ontologyIri!: string;

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];
}

