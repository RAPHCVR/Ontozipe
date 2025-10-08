import { Transform } from "class-transformer";
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
	@IsOptional()
	@Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 1))
	@IsInt()
	@Min(1)
	page?: number = 1;

	@IsOptional()
	@Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 20))
	@IsInt()
	@Min(1)
	@Max(100)
	pageSize?: number = 20;

	@IsOptional()
	@IsString()
	search?: string;

	@IsOptional()
	@Transform(({ value }) => {
		if (value === undefined || value === null || value === "") return undefined;
		if (typeof value === "string") return value.toLowerCase() === "true";
		return Boolean(value);
	})
	@IsBoolean()
	onlyUnverified?: boolean;

	@IsOptional()
	@IsString()
	role?: string;
}

export class AdminUpdateUserDto {
	@IsOptional()
	@IsString()
	@MinLength(1)
	name?: string | null;

	@IsOptional()
	@IsEmail()
	email?: string | null;

	@IsOptional()
	@IsUrl()
	avatar?: string | null;

	@IsOptional()
	@IsBoolean()
	isVerified?: boolean;

	@IsOptional()
	@IsArray()
	@ArrayNotEmpty()
	@ArrayUnique()
	@IsString({ each: true })
	roles?: string[];
}
