import { IsNotEmpty, IsString, IsUrl } from "class-validator";

export class CreateOrganizationDto {
    @IsString()
    @IsNotEmpty()
    label!: string;

    @IsUrl()
    ownerIri!: string;
}

