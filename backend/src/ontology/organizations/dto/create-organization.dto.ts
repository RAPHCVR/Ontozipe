import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUrl } from "class-validator";

export class CreateOrganizationDto {
    @ApiProperty({ example: "Acme Corp" })
    @IsString()
    @IsNotEmpty()
    label!: string;

    @ApiProperty({ example: "http://example.org/user/admin" })
    @IsUrl()
    ownerIri!: string;
}
