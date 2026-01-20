import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";
export class PdfDto {
	@ApiProperty({ example: "/uploads/12345.pdf" })
	@IsString()
	url!: string;
	@ApiProperty({ example: "rapport.pdf" })
	@IsString()
	originalName!: string;
}
