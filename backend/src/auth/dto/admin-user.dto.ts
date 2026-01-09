import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	ArrayNotEmpty,
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsEmail,
	IsInt,
	IsOptional,
	IsString,
	IsUrl,
	Max,
	Min,
	MinLength,
} from "class-validator";

export class AdminListUsersQueryDto {
	@ApiPropertyOptional({ example: 1, minimum: 1 })
	@IsOptional()
	@Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 1))
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
	@IsOptional()
	@Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 20))
	@IsInt()
	@Min(1)
	@Max(100)
	pageSize?: number = 20;

	@ApiPropertyOptional({ example: "doe" })
	@IsOptional()
	@IsString()
	search?: string;

	@ApiPropertyOptional({ example: true })
	@IsOptional()
	@Transform(({ value }) => {
		if (value === undefined || value === null || value === "") return undefined;
		if (typeof value === "string") return value.toLowerCase() === "true";
		return Boolean(value);
	})
	@IsBoolean()
	onlyUnverified?: boolean;

	@ApiPropertyOptional({
		example: "http://example.org/core#AdminRole",
	})
	@IsOptional()
	@IsString()
	role?: string;
}

export class AdminUpdateUserDto {
	@ApiPropertyOptional({ example: "Jane Doe", nullable: true })
	@IsOptional()
	@IsString()
	@MinLength(1)
	name?: string | null;

	@ApiPropertyOptional({ example: "jane@example.org", nullable: true })
	@IsOptional()
	@IsEmail()
	email?: string | null;

	@ApiPropertyOptional({
		example: "https://cdn.example.com/avatars/jane.png",
		nullable: true,
	})
	@IsOptional()
	@IsUrl()
	avatar?: string | null;

	@ApiPropertyOptional({ example: true })
	@IsOptional()
	@IsBoolean()
	isVerified?: boolean;

	@ApiPropertyOptional({
		example: ["http://example.org/core#AdminRole"],
	})
	@IsOptional()
	@IsArray()
	@ArrayNotEmpty()
	@ArrayUnique()
	@IsString({ each: true })
	roles?: string[];
}

export class AdminUserDto {
	@ApiProperty({ example: "http://example.org/user/jane" })
	iri!: string;

	@ApiPropertyOptional({ example: "Jane Doe", nullable: true })
	name?: string | null;

	@ApiPropertyOptional({ example: "jane@example.org", nullable: true })
	email?: string | null;

	@ApiPropertyOptional({
		example: "https://cdn.example.com/avatars/jane.png",
		nullable: true,
	})
	avatar?: string | null;

	@ApiProperty({ example: true })
	isVerified!: boolean;

	@ApiProperty({
		example: ["http://example.org/core#AdminRole"],
	})
	roles!: string[];
}

export class AdminUsersListResponseDto {
	@ApiProperty({ type: [AdminUserDto] })
	items!: AdminUserDto[];

	@ApiProperty({ example: 1 })
	page!: number;

	@ApiProperty({ example: 20 })
	pageSize!: number;

	@ApiProperty({ example: 42 })
	total!: number;
}
