import { IsArray, IsIn, IsUrl, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class HistoryItemDto {
    @IsIn(["user", "assistant", "system"])
    role!: "user" | "assistant" | "system";
    @IsString()
    content!: string;
}

export class AskDto {
    @IsString()
    @IsNotEmpty()
    question!: string;

    @IsOptional()
    @IsUrl()
    ontologyIri?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HistoryItemDto)
    history?: HistoryItemDto[];

    @IsOptional()
    @IsString()
    idempotencyKey?: string;
}