import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AuthTokenResponseDto {
	@ApiProperty({
		example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
		description: "JWT bearer token (12h TTL).",
	})
	token!: string;
}

export class UserProfileResponseDto {
	@ApiPropertyOptional({ example: "Jane Doe" })
	name?: string;

	@ApiPropertyOptional({
		example: "https://cdn.example.com/avatars/jane.png",
	})
	avatar?: string;

	@ApiPropertyOptional({ example: "jane@example.org" })
	email?: string;

	@ApiProperty({ example: true })
	isVerified!: boolean;

	@ApiProperty({
		example: ["http://example.org/core#SuperAdminRole"],
	})
	roles!: string[];
}
