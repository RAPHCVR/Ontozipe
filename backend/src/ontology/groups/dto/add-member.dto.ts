import { IsUrl } from "class-validator";

export class AddMemberDto {
    @IsUrl()
    userIri!: string;
}

