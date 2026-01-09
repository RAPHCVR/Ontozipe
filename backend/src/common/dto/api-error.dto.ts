import { ApiProperty } from "@nestjs/swagger";

export class ApiErrorDto {
	@ApiProperty({ example: 400 })
	statusCode!: number;

	@ApiProperty({ example: "Bad Request" })
	error!: string;

	@ApiProperty({
		oneOf: [
			{ type: "string", example: "Validation failed (email should not be empty)" },
			{ type: "array", items: { type: "string" }, example: ["email must be an email"] },
		],
	})
	message!: string | string[];
}
