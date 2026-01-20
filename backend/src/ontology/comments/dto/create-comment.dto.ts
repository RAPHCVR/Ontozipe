import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

export class CreateCommentDto {
    @ApiProperty({ example: "http://example.org/comment/123" })
    @IsString()
    @IsNotEmpty()
    id!: string;

    @ApiProperty({ example: "Ceci est un commentaire." })
    @IsString()
    @IsNotEmpty()
    body!: string;

    @ApiProperty({ example: "http://example.org/indiv/123" })
    @IsUrl()
    onResource!: string;

    @ApiPropertyOptional({ example: "http://example.org/comment/122" })
    @IsOptional()
    @IsString()
    replyTo?: string;

    @ApiProperty({ example: "http://example.org/ontology/core" })
    @IsUrl()
    ontologyIri!: string;

    @ApiPropertyOptional({
        example: ["http://example.org/group/research"],
    })
    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];
}
