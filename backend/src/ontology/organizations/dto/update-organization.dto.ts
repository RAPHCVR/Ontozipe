import { IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateOrganizationDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    label?: string;

    @IsOptional()
    @IsUrl()
    ownerIri?: string;
}

