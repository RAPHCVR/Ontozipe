import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateCommentDto {
    @ApiPropertyOptional({ example: "Nouveau contenu du commentaire." })
    @IsOptional()
    @IsString()
    newBody?: string;

    @ApiPropertyOptional({
        example: ["http://example.org/group/research"],
    })
    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    visibleToGroups?: string[];

    @ApiProperty({ example: "http://example.org/ontology/core" })
    @IsUrl()
    ontologyIri!: string;
}
