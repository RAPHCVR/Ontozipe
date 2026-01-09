import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateOrganizationDto {
    @ApiPropertyOptional({ example: "Acme Corp Europe" })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    label?: string;

    @ApiPropertyOptional({ example: "http://example.org/user/admin" })
    @IsOptional()
    @IsUrl()
    ownerIri?: string;
}
