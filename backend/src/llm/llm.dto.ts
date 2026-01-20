import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
    IsArray,
    IsIn,
    IsUrl,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    Matches,
    ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class HistoryItemDto {
    @ApiProperty({ enum: ["user", "assistant", "system"], example: "user" })
    @IsIn(["user", "assistant", "system"])
    role!: "user" | "assistant" | "system";
    @ApiProperty({ example: "Bonjour" })
    @IsString()
    content!: string;
}

export class AskDto {
    @ApiProperty({ example: "Peux-tu trouver les classes liées à Person ?" })
    @IsString()
    @IsNotEmpty()
    question!: string;

    @ApiPropertyOptional({ example: "http://example.org/ontology/core" })
    @IsOptional()
    @IsUrl()
    ontologyIri?: string;

    @ApiPropertyOptional({ type: [HistoryItemDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HistoryItemDto)
    history?: HistoryItemDto[];

    @ApiProperty({ example: "req_123e4567" })
    @IsString()
    @IsNotEmpty()
    idempotencyKey!: string;

    /** Identifie la session de conversation côté client (onglet/chat). */
    @ApiProperty({ example: "session-abc" })
    @IsString()
    @IsNotEmpty()
    @Matches(/\S/, { message: "sessionId ne doit pas être vide." })
    sessionId!: string;
}

export class CreateChatSessionDto {
    @ApiPropertyOptional({ example: "Analyse ontologie" })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional({ example: "http://example.org/ontology/core" })
    @IsOptional()
    @IsString()
    ontologyIri?: string;
}

export class UpdateChatSessionDto {
    @ApiPropertyOptional({ example: "Nouveau titre" })
    @IsOptional()
    @IsString()
    title?: string;
}

export class DashboardSummaryRequestDto {
    @ApiPropertyOptional({ example: "dashboard" })
    @IsOptional()
    @IsString()
    section?: string;

    @ApiProperty({ example: { kpis: { ontologies: 3 } } })
    @IsObject()
    payload!: Record<string, unknown>;

    @ApiPropertyOptional({ example: "fr" })
    @IsOptional()
    @IsString()
    language?: string;
}

export class IndividualPropertySummaryDto {
    @ApiProperty({ example: "http://example.org/ontology#name" })
    @IsString()
    predicate!: string;

    @ApiProperty({ example: "Alice" })
    @IsString()
    value!: string;
}

export class IndividualSummaryDto {
    @ApiProperty({ example: "http://example.org/indiv/123" })
    @IsString()
    id!: string;

    @ApiPropertyOptional({ example: "Alice" })
    @IsOptional()
    @IsString()
    label?: string;

    @ApiPropertyOptional({ example: "http://example.org/ontology#Person" })
    @IsOptional()
    @IsString()
    classId?: string;

    @ApiPropertyOptional({ type: [IndividualPropertySummaryDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => IndividualPropertySummaryDto)
    properties?: IndividualPropertySummaryDto[];
}

export class CommentSummaryItemDto {
    @ApiProperty({ example: "http://example.org/comment/123" })
    @IsString()
    id!: string;

    @ApiProperty({ example: "Ceci est un commentaire." })
    @IsString()
    body!: string;

    @ApiPropertyOptional({ example: "http://example.org/user/alice" })
    @IsOptional()
    @IsString()
    createdBy?: string;

    @ApiPropertyOptional({ example: "2024-01-01T10:00:00.000Z" })
    @IsOptional()
    @IsString()
    createdAt?: string;

    @ApiPropertyOptional({ example: "http://example.org/comment/122" })
    @IsOptional()
    @IsString()
    replyTo?: string;

    @ApiPropertyOptional({ example: "http://example.org/indiv/123" })
    @IsOptional()
    @IsString()
    onResource?: string;
}

export class CommentSummaryRequestDto {
    @ApiProperty({ type: IndividualSummaryDto })
    @ValidateNested()
    @Type(() => IndividualSummaryDto)
    individual!: IndividualSummaryDto;

    @ApiProperty({ type: [CommentSummaryItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CommentSummaryItemDto)
    comments!: CommentSummaryItemDto[];

    @ApiPropertyOptional({ example: "fr" })
    @IsOptional()
    @IsString()
    language?: string;
}

export class SummaryResponseDto {
    @ApiProperty({ example: "Résumé généré en 5 points." })
    summary!: string;
}

export class SystemPromptResponseDto {
    @ApiProperty({ example: "System prompt..." })
    systemPrompt!: string;
}

export class ChatSessionDto {
    @ApiProperty({ example: "session-abc" })
    id!: string;

    @ApiProperty({ example: "http://example.org/chat/session/abc" })
    iri!: string;

    @ApiProperty({ example: "Analyse ontologie" })
    title!: string;

    @ApiPropertyOptional({ example: "http://example.org/ontology/core" })
    ontologyIri?: string;

    @ApiPropertyOptional({ example: "2024-01-01T10:00:00.000Z" })
    createdAt?: string;

    @ApiPropertyOptional({ example: "2024-01-05T12:00:00.000Z" })
    updatedAt?: string;
}

export class ChatSessionResponseDto {
    @ApiProperty({ type: ChatSessionDto })
    session!: ChatSessionDto;
}

export class ChatSessionsResponseDto {
    @ApiProperty({ type: [ChatSessionDto] })
    sessions!: ChatSessionDto[];
}

export class AgentStepDto {
    @ApiProperty({ example: "tool_0_123" })
    id!: string;

    @ApiProperty({ example: "search_from_uri" })
    name!: string;

    @ApiProperty({ example: { iri: "http://example.org/ontology#Person" } })
    args!: Record<string, unknown>;

    @ApiPropertyOptional({ example: { results: [] } })
    result?: unknown;
}

export class ChatMessageDto {
    @ApiProperty({ example: "http://example.org/chat/message/1" })
    id!: string;

    @ApiProperty({ enum: ["user", "assistant", "system"], example: "assistant" })
    role!: "user" | "assistant" | "system";

    @ApiProperty({ example: "Voici la réponse..." })
    content!: string;

    @ApiPropertyOptional({ example: "2024-01-01T10:00:00.000Z" })
    createdAt?: string;

    @ApiProperty({ example: 1 })
    index!: number;

    @ApiPropertyOptional({ type: [AgentStepDto] })
    agentSteps?: AgentStepDto[];
}

export class ChatMessagesResponseDto {
    @ApiProperty({ type: [ChatMessageDto] })
    messages!: ChatMessageDto[];
}
