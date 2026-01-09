import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class DashboardFiltersDto {
	@ApiPropertyOptional({ example: "2024-01-01T00:00:00.000Z" })
	start?: string;

	@ApiPropertyOptional({ example: "2024-01-31T23:59:59.999Z" })
	end?: string;

	@ApiProperty({ example: "all", enum: ["all", "ontology", "organization", "group"] })
	scopeType!: "all" | "ontology" | "organization" | "group";

	@ApiPropertyOptional({ example: "http://example.org/ontology/core" })
	scopeId?: string;
}

export class DashboardPlatformKpisDto {
	@ApiProperty({ example: 12 })
	ontologies!: number;

	@ApiProperty({ example: 4 })
	organizations!: number;

	@ApiProperty({ example: 8 })
	groups!: number;

	@ApiProperty({ example: 20 })
	activeAccounts!: number;
}

export class DashboardActivityDto {
	@ApiProperty({ example: 30 })
	individualsCreated!: number;

	@ApiProperty({ example: 12 })
	commentsCreated!: number;

	@ApiProperty({ example: 7 })
	updates!: number;
}

export class DashboardTopContributorDto {
	@ApiProperty({ example: "http://example.org/user/alice" })
	user!: string;

	@ApiProperty({ example: 5 })
	score!: number;
}

export class DashboardProjectHealthDto {
	@ApiProperty({ example: 30 })
	individualGrowth!: number;

	@ApiProperty({ example: 12 })
	commentGrowth!: number;
}

export class DashboardPlatformDataDto {
	@ApiProperty({ type: DashboardPlatformKpisDto })
	kpis!: DashboardPlatformKpisDto;

	@ApiProperty({ type: DashboardActivityDto })
	activity!: DashboardActivityDto;

	@ApiProperty({ type: [DashboardTopContributorDto] })
	topContributors!: DashboardTopContributorDto[];

	@ApiProperty({ type: DashboardProjectHealthDto })
	projectHealth!: DashboardProjectHealthDto;
}

export class DashboardPlatformSectionDto {
	@ApiProperty({ type: DashboardPlatformDataDto })
	data!: DashboardPlatformDataDto;
}

export class DashboardGovernanceKpisDto {
	@ApiProperty({ example: 8 })
	groups!: number;

	@ApiProperty({ example: 4 })
	organizations!: number;

	@ApiProperty({ example: 15 })
	activeMembers!: number;

	@ApiProperty({ example: 12 })
	recentComments!: number;
}

export class DashboardTopUserDto {
	@ApiProperty({ example: "http://example.org/user/alice" })
	user!: string;

	@ApiProperty({ example: 6 })
	score!: number;
}

export class DashboardTopThreadDto {
	@ApiProperty({ example: "http://example.org/comment/123" })
	comment!: string;

	@ApiProperty({ example: 4 })
	replies!: number;

	@ApiPropertyOptional({ example: "http://example.org/indiv/123" })
	onResource?: string;

	@ApiPropertyOptional({ example: "http://example.org/ontology/core" })
	ontologyIri?: string;

	@ApiPropertyOptional({ example: "Ceci est un commentaire." })
	body?: string;
}

export class DashboardTopIndividualDto {
	@ApiProperty({ example: "http://example.org/indiv/123" })
	iri!: string;

	@ApiProperty({ example: 10 })
	score!: number;

	@ApiPropertyOptional({ example: "http://example.org/ontology/core" })
	ontologyIri?: string;

	@ApiPropertyOptional({ example: "Alice" })
	label?: string;

	@ApiPropertyOptional({ example: "http://example.org/ontology#Person" })
	classIri?: string;

	@ApiPropertyOptional({ example: "Person" })
	classLabel?: string;
}

export class DashboardTopClassDto {
	@ApiProperty({ example: "http://example.org/ontology#Person" })
	iri!: string;

	@ApiProperty({ example: 12 })
	score!: number;

	@ApiPropertyOptional({ example: "Person" })
	label?: string;

	@ApiPropertyOptional({ example: "http://example.org/ontology/core" })
	ontologyIri?: string;
}

export class DashboardGovernanceDataDto {
	@ApiProperty({ type: DashboardGovernanceKpisDto })
	kpis!: DashboardGovernanceKpisDto;

	@ApiProperty({ type: [DashboardTopUserDto] })
	topUsers!: DashboardTopUserDto[];

	@ApiProperty({ type: [DashboardTopThreadDto] })
	topThreads!: DashboardTopThreadDto[];

	@ApiProperty({ type: [DashboardTopIndividualDto] })
	topIndividuals!: DashboardTopIndividualDto[];

	@ApiProperty({ type: [DashboardTopClassDto] })
	topClasses!: DashboardTopClassDto[];
}

export class DashboardGovernanceSectionDto {
	@ApiProperty({ type: DashboardGovernanceDataDto })
	data!: DashboardGovernanceDataDto;
}

export class DashboardMyActivityKpisDto {
	@ApiProperty({ example: 6 })
	createdOrEdited!: number;

	@ApiProperty({ example: 3 })
	comments!: number;
}

export class DashboardRecentIndividualDto {
	@ApiProperty({ example: "http://example.org/indiv/123" })
	iri!: string;

	@ApiProperty({ example: "http://example.org/ontology/core" })
	ontologyIri!: string;

	@ApiPropertyOptional({ example: "Alice" })
	label?: string;

	@ApiPropertyOptional({ example: "2024-01-05T12:00:00.000Z" })
	updatedAt?: string;

	@ApiPropertyOptional({ example: "2024-01-01T10:00:00.000Z" })
	createdAt?: string;
}

export class DashboardRecentCommentDto {
	@ApiProperty({ example: "http://example.org/comment/123" })
	iri!: string;

	@ApiPropertyOptional({ example: "Ceci est un commentaire." })
	body?: string;

	@ApiProperty({ example: "http://example.org/ontology/core" })
	ontologyIri!: string;

	@ApiProperty({ example: "http://example.org/indiv/123" })
	onResource!: string;

	@ApiPropertyOptional({ example: "2024-01-01T10:00:00.000Z" })
	createdAt?: string;

	@ApiPropertyOptional({ example: "2024-01-05T12:00:00.000Z" })
	updatedAt?: string;
}

export class DashboardMyActivityDataDto {
	@ApiProperty({ type: DashboardMyActivityKpisDto })
	kpis!: DashboardMyActivityKpisDto;

	@ApiProperty({ type: [DashboardRecentIndividualDto] })
	lastIndividuals!: DashboardRecentIndividualDto[];

	@ApiProperty({ type: [DashboardRecentCommentDto] })
	lastComments!: DashboardRecentCommentDto[];
}

export class DashboardMyActivitySectionDto {
	@ApiProperty({ type: DashboardMyActivityDataDto })
	data!: DashboardMyActivityDataDto;
}

export class DashboardCommentSummaryDto {
	@ApiProperty({ example: "http://example.org/comment/123" })
	comment!: string;

	@ApiPropertyOptional({ example: 4 })
	replies?: number;

	@ApiPropertyOptional({ example: "2024-01-01T10:00:00.000Z" })
	createdAt?: string;

	@ApiPropertyOptional({ example: "Ceci est un commentaire." })
	body?: string;

	@ApiPropertyOptional({ example: "http://example.org/indiv/123" })
	onResource?: string;

	@ApiPropertyOptional({ example: "http://example.org/ontology/core" })
	ontologyIri?: string;

	@ApiPropertyOptional({ example: "http://example.org/ontology#Person" })
	classIri?: string;

	@ApiPropertyOptional({ example: "Person" })
	classLabel?: string;
}

export class DashboardCommentsDataDto {
	@ApiProperty({ type: [DashboardCommentSummaryDto] })
	topThreads!: DashboardCommentSummaryDto[];

	@ApiProperty({ type: [DashboardCommentSummaryDto] })
	threadsWithoutReply!: DashboardCommentSummaryDto[];

	@ApiProperty({ type: [DashboardCommentSummaryDto] })
	recentThreads!: DashboardCommentSummaryDto[];
}

export class DashboardCommentsSectionDto {
	@ApiProperty({ type: DashboardCommentsDataDto })
	data!: DashboardCommentsDataDto;
}

export class DashboardMetaDto {
	@ApiProperty({ example: 12 })
	accessibleOntologies!: number;

	@ApiProperty({ example: 8 })
	accessibleGroups!: number;

	@ApiProperty({ example: 4 })
	accessibleOrganizations!: number;
}

export class DashboardSummaryResponseDto {
	@ApiProperty({ type: DashboardFiltersDto })
	filters!: DashboardFiltersDto;

	@ApiProperty({ type: DashboardPlatformSectionDto })
	platform!: DashboardPlatformSectionDto;

	@ApiProperty({ type: DashboardGovernanceSectionDto })
	governance!: DashboardGovernanceSectionDto;

	@ApiProperty({ type: DashboardMyActivitySectionDto })
	myActivity!: DashboardMyActivitySectionDto;

	@ApiProperty({ type: DashboardCommentsSectionDto })
	comments!: DashboardCommentsSectionDto;

	@ApiProperty({ type: DashboardMetaDto })
	meta!: DashboardMetaDto;
}
