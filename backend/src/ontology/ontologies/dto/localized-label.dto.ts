import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

const LANG_TAG_REGEX = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;

export class LocalizedLabelDto {
    @ApiProperty({ example: "Ontology label" })
    @IsString()
    @IsNotEmpty()
    value!: string;

    @ApiPropertyOptional({ example: "fr" })
    @IsOptional()
    @Matches(LANG_TAG_REGEX, { message: "lang must follow BCP47 (ex: fr, en-GB)" })
    lang?: string;
}

export const LANG_TAG_PATTERN = LANG_TAG_REGEX;
