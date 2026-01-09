import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PropertyDto } from "../../individuals/dto/property.dto";

export class IriLabelDto {
	@ApiProperty({ example: "http://example.org/resource/123" })
	iri!: string;

	@ApiPropertyOptional({ example: "Label" })
	label?: string;
}

export class GroupInfoDto {
	@ApiProperty({ example: "http://example.org/group/research" })
	iri!: string;

	@ApiPropertyOptional({ example: "Equipe R&D" })
	label?: string;

	@ApiProperty({ example: "http://example.org/user/alice" })
	createdBy!: string;

	@ApiProperty({ example: ["http://example.org/user/alice"] })
	members!: string[];

	@ApiPropertyOptional({ example: "http://example.org/org/acme" })
	organizationIri?: string;
}

export class OrganizationInfoDto {
	@ApiProperty({ example: "http://example.org/org/acme" })
	iri!: string;

	@ApiPropertyOptional({ example: "Acme Corp" })
	label?: string;

	@ApiProperty({ example: "http://example.org/user/admin" })
	owner!: string;

	@ApiProperty({ example: "2024-01-01T10:00:00.000Z" })
	createdAt!: string;
}

export class NodeDataDto {
	@ApiProperty({ example: "http://example.org/ontology#Person" })
	id!: string;

	@ApiPropertyOptional({ example: "Person" })
	label?: string;

	@ApiProperty({ example: "http://example.org/ontology#Person" })
	title!: string;
}

export class EdgeDataDto {
	@ApiProperty({ example: "http://example.org/ontology#Person" })
	from!: string;

	@ApiProperty({ example: "http://example.org/ontology#Agent" })
	to!: string;
}

export class GraphDto {
	@ApiProperty({ type: [NodeDataDto] })
	nodes!: NodeDataDto[];

	@ApiProperty({ type: [EdgeDataDto] })
	edges!: EdgeDataDto[];
}

export class IndividualNodeDto {
	@ApiProperty({ example: "http://example.org/indiv/123" })
	id!: string;

	@ApiProperty({ example: "Alice" })
	label!: string;

	@ApiProperty({ example: "http://example.org/ontology#Person" })
	classId!: string;

	@ApiProperty({ type: [PropertyDto] })
	properties!: PropertyDto[];

	@ApiProperty({ type: () => IndividualNodeDto, isArray: true })
	children!: IndividualNodeDto[];

	@ApiPropertyOptional({ example: "http://example.org/user/alice" })
	createdBy?: string;

	@ApiPropertyOptional({ example: "2024-01-01T10:00:00.000Z" })
	createdAt?: string;

	@ApiPropertyOptional({ example: "http://example.org/user/bob" })
	updatedBy?: string;

	@ApiPropertyOptional({ example: "2024-01-05T12:00:00.000Z" })
	updatedAt?: string;

	@ApiPropertyOptional({ example: ["http://example.org/group/research"] })
	visibleTo?: string[];

	@ApiPropertyOptional({ type: [IriLabelDto] })
	groups?: IriLabelDto[];
}

export class CommentNodeDto {
	@ApiProperty({ example: "http://example.org/comment/123" })
	id!: string;

	@ApiProperty({ example: "Ceci est un commentaire." })
	body!: string;

	@ApiProperty({ example: "http://example.org/indiv/123" })
	onResource!: string;

	@ApiPropertyOptional({ example: "http://example.org/comment/122" })
	replyTo?: string;

	@ApiProperty({ example: "http://example.org/user/alice" })
	createdBy!: string;

	@ApiProperty({ example: "2024-01-01T10:00:00.000Z" })
	createdAt!: string;

	@ApiPropertyOptional({ example: "http://example.org/user/bob" })
	updatedBy?: string;

	@ApiPropertyOptional({ example: "2024-01-05T12:00:00.000Z" })
	updatedAt?: string;

	@ApiPropertyOptional({ example: ["http://example.org/group/research"] })
	visibleTo?: string[];
}

export class FullSnapshotDto {
	@ApiProperty({ type: GraphDto })
	graph!: GraphDto;

	@ApiProperty({ type: [IndividualNodeDto] })
	individuals!: IndividualNodeDto[];

	@ApiProperty({ type: [IndividualNodeDto] })
	persons!: IndividualNodeDto[];
}

export class OntologyProjectSummaryDto {
	@ApiProperty({ example: "http://example.org/ontology/core" })
	iri!: string;

	@ApiPropertyOptional({ example: "Core Ontology" })
	label?: string;

	@ApiPropertyOptional({ example: "fr" })
	labelLang?: string;

	@ApiProperty({ example: ["fr", "en"] })
	languages!: string[];
}

export class ClassPropertyRangeDto {
	@ApiProperty({ example: "http://example.org/ontology#Organization" })
	iri!: string;

	@ApiProperty({ example: "Organization" })
	label!: string;
}

export class ClassPropertyDto {
	@ApiProperty({ example: "http://example.org/ontology#name" })
	iri!: string;

	@ApiProperty({ example: "name" })
	label!: string;
}

export class ClassObjectPropertyDto extends ClassPropertyDto {
	@ApiPropertyOptional({ type: ClassPropertyRangeDto })
	range?: ClassPropertyRangeDto;
}

export class ClassPropertiesResponseDto {
	@ApiProperty({ type: [ClassPropertyDto] })
	dataProps!: ClassPropertyDto[];

	@ApiProperty({ type: [ClassObjectPropertyDto] })
	objectProps!: ClassObjectPropertyDto[];
}
