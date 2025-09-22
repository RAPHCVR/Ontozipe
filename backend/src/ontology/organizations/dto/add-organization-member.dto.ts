import { IsUrl } from "class-validator";

export class AddOrganizationMemberDto {
    @IsUrl()
    userIri!: string;
}

