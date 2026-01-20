import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateGroupDto {
    @ApiPropertyOptional({ example: "Equipe Data" })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    label?: string;

    @ApiPropertyOptional({ example: "http://example.org/org/acme" })
    @IsOptional()
    @IsUrl()
    organizationIri?: string;
}
