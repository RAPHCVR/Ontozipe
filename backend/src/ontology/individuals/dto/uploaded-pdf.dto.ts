import { ApiProperty } from "@nestjs/swagger";

export class UploadedPdfDto {
	@ApiProperty({ example: "/uploads/12345.pdf" })
	url!: string;

	@ApiProperty({ example: "rapport.pdf" })
	originalName!: string;
}
