import { IsString } from "class-validator";
export class PdfDto {
	@IsString()
	url!: string;
	@IsString()
	originalName!: string;
}
