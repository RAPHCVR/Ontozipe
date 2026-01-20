import { ApiProperty } from "@nestjs/swagger";

export class OkResponseDto {
	@ApiProperty({ example: true })
	ok!: boolean;
}

export class SuccessResponseDto {
	@ApiProperty({ example: true })
	success!: boolean;
}
