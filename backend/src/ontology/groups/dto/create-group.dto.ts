import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

export class CreateGroupDto {
    @IsString()
    @IsNotEmpty()
    label!: string;

    @IsUrl()
    organizationIri!: string;

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    members?: string[];
}

