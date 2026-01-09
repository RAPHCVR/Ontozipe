import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

export class CreateGroupDto {
    @ApiProperty({ example: "Equipe R&D" })
    @IsString()
    @IsNotEmpty()
    label!: string;

    @ApiProperty({ example: "http://example.org/org/acme" })
    @IsUrl()
    organizationIri!: string;

    @ApiPropertyOptional({
        example: ["http://example.org/user/alice", "http://example.org/user/bob"],
    })
    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    members?: string[];
}
