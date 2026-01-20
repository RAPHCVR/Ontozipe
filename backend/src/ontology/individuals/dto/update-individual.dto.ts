import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsUrl, ValidateNested } from "class-validator";

import { PropertyDto } from "./property.dto";
import { PdfDto } from "./pdf.dto";
export class UpdateIndividualDto {
	@ApiPropertyOptional({ type: [PropertyDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyDto)
	addProps?: PropertyDto[];

	@ApiPropertyOptional({ type: [PropertyDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyDto)
	delProps?: PropertyDto[];

	@ApiPropertyOptional({
		example: ["http://example.org/group/research"],
	})
	@IsOptional()
	@IsArray()
	@IsUrl({}, { each: true })
	visibleToGroups?: string[];

	/** PDFs associés à l'individu (remplacement complet) */
	@ApiPropertyOptional({ type: [PdfDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PdfDto)
	pdfs?: PdfDto[];
}
