import { Type } from "class-transformer";
import { IsArray, IsOptional, IsUrl, ValidateNested } from "class-validator";

import { PropertyDto } from "./property.dto";
import { PdfDto } from "./pdf.dto";
export class UpdateIndividualDto {
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyDto)
	addProps?: PropertyDto[];

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyDto)
	delProps?: PropertyDto[];

	@IsOptional()
	@IsArray()
	@IsUrl({}, { each: true })
	visibleToGroups?: string[];

	/** PDFs associés à l'individu (remplacement complet) */
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PdfDto)
	pdfs?: PdfDto[];
}
