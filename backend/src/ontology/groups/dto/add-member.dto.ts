import { ApiProperty } from "@nestjs/swagger";
import { IsUrl } from "class-validator";

export class AddMemberDto {
    @ApiProperty({ example: "http://example.org/user/alice" })
    @IsUrl()
    userIri!: string;
}
