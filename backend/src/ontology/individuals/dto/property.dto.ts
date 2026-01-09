import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, IsUrl } from "class-validator";

export class PropertyDto {
    @ApiProperty({ example: "http://www.w3.org/2000/01/rdf-schema#label" })
    @IsUrl()
    predicate!: string;

    @ApiPropertyOptional({ example: "label" })
    @IsOptional()
    @IsString()
    predicateLabel?: string;

    @ApiProperty({ example: "Alice" })
    @IsString()
    value!: string;

    @ApiPropertyOptional({ example: "Alice" })
    @IsOptional()
    @IsString()
    valueLabel?: string;

    @ApiProperty({ example: true })
    @IsBoolean()
    isLiteral!: boolean;
}
