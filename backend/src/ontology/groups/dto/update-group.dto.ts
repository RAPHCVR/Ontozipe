import { IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateGroupDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    label?: string;

    @IsOptional()
    @IsUrl()
    organizationIri?: string;
}

