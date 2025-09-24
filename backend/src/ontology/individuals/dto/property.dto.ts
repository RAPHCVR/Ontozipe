import { IsBoolean, IsOptional, IsString, IsUrl } from "class-validator";

export class PropertyDto {
    @IsUrl()
    predicate!: string;

    @IsOptional()
    @IsString()
    predicateLabel?: string;

    @IsString()
    value!: string;

    @IsOptional()
    @IsString()
    valueLabel?: string;

    @IsBoolean()
    isLiteral!: boolean;
}

