import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsArray,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUrl,
	ValidateNested,
} from "class-validator";

import { PropertyDto } from "./property.dto";
import { PdfDto } from "./pdf.dto";
export class CreateIndividualDto {
	@ApiProperty({ example: "http://example.org/indiv/123" })
	@IsUrl()
	id!: string;

	@ApiProperty({ example: "Alice" })
	@IsString()
	@IsNotEmpty()
	label!: string;

	@ApiProperty({ example: "http://example.org/ontology#Person" })
	@IsUrl()
	classId!: string;

	@ApiProperty({ type: [PropertyDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyDto)
	properties!: PropertyDto[];

	@ApiProperty({ example: "http://example.org/ontology/core" })
	@IsUrl()
	ontologyIri!: string;

	@ApiPropertyOptional({
		example: ["http://example.org/group/research"],
	})
	@IsOptional()
	@IsArray()
	@IsUrl({}, { each: true })
	visibleToGroups?: string[];

	/** PDFs associés à l'individu */
	@ApiPropertyOptional({ type: [PdfDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PdfDto)
	pdfs?: PdfDto[];
}
