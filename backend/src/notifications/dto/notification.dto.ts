import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class NotificationActorDto {
	@ApiProperty({ example: "http://example.org/user/alice" })
	iri!: string;

	@ApiPropertyOptional({ example: "Alice" })
	name?: string;
}

export class NotificationTargetDto {
	@ApiProperty({ example: "http://example.org/indiv/123" })
	iri!: string;

	@ApiPropertyOptional({ example: "Document A" })
	label?: string;
}

export class NotificationDto {
	@ApiProperty({ example: "http://example.org/notification/abc" })
	iri!: string;

	@ApiProperty({ example: "Nouvelle entite creee." })
	content!: string;

	@ApiProperty({ example: "2024-01-01T10:00:00.000Z" })
	createdAt!: string;

	@ApiProperty({ example: false })
	isRead!: boolean;

	@ApiPropertyOptional({ type: NotificationActorDto })
	actor?: NotificationActorDto;

	@ApiPropertyOptional({ type: NotificationTargetDto })
	target?: NotificationTargetDto;

	@ApiPropertyOptional({ example: "http://example.org/core#IndividualCreated" })
	verb?: string;

	@ApiPropertyOptional({ example: "/ontologies/123" })
	link?: string | null;

	@ApiPropertyOptional({ example: "administration" })
	category?: string;

	@ApiPropertyOptional({ example: "personal" })
	scope?: "personal" | "group";
}

export class NotificationsListResponseDto {
	@ApiProperty({ type: [NotificationDto] })
	items!: NotificationDto[];

	@ApiProperty({ example: 24 })
	total!: number;

	@ApiProperty({ example: 3 })
	unreadCount!: number;

	@ApiProperty({ example: 20 })
	limit!: number;

	@ApiProperty({ example: 0 })
	offset!: number;
}

export class UnreadCountResponseDto {
	@ApiProperty({ example: 3 })
	unreadCount!: number;
}
