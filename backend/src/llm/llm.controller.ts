import {
    Body,
    Controller,
    Req,
    UseGuards,
    Post,
    Res,
    Get,
    Query,
    Param,
    Patch,
    Delete,
} from "@nestjs/common";
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LlmService } from "./llm.service";
import {
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
} from "@langchain/core/messages";
import { SYSTEM_PROMPT_FR } from "./prompt";
import {
    AskDto,
    HistoryItemDto,
    CreateChatSessionDto,
    UpdateChatSessionDto,
    DashboardSummaryRequestDto,
    CommentSummaryRequestDto,
    SummaryResponseDto,
    SystemPromptResponseDto,
    ChatSessionsResponseDto,
    ChatSessionResponseDto,
    ChatMessagesResponseDto,
} from "./llm.dto";
import { getText } from "./llm.utils";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import type { Runnable } from "@langchain/core/runnables";
import { ChatHistoryService, AppendMessageInput } from "./chat-history.service";
import { SuccessResponseDto } from "../common/dto/standard-response.dto";
import { ApiErrorDto } from "../common/dto/api-error.dto";

const HISTORY_SUMMARY_TRIGGER = 14;
const HISTORY_SUMMARY_TAKE_LAST = 10;
const MAX_STEPS = 5;

type AuthRequest = Request & { user: { sub: string; email?: string } };

interface ToolCall {
    name: string;
    args: Record<string, unknown>;
    id: string;
}

interface AgentStep {
    id: string;
    name: string;
    args: unknown;
    result?: unknown;
}

@ApiTags("LLM")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto })
@Controller("llm")
@UseGuards(JwtAuthGuard)
export class LlmController {
    constructor(
        private readonly llmService: LlmService,
        private readonly chatHistory: ChatHistoryService
    ) {}

    private toLangchainHistory(history?: HistoryItemDto[]): BaseMessage[] {
        if (!history) return [];
        return history.map((h) => {
            if (h.role === "system") return new SystemMessage(h.content);
            if (h.role === "assistant") return new AIMessage({ content: h.content });
            return new HumanMessage(h.content);
        });
    }

    private async compressHistoryIfNeeded(
        summarizer: Runnable,
        history?: HistoryItemDto[],
        sseKey?: string
    ): Promise<BaseMessage[]> {
        if (!history || history.length <= HISTORY_SUMMARY_TRIGGER) {
            return this.toLangchainHistory(history);
        }

        const splitIndex = Math.max(0, history.length - HISTORY_SUMMARY_TAKE_LAST);
        const prefix = history.slice(0, splitIndex);
        const tail = history.slice(splitIndex);
        if (prefix.length === 0) {
            return this.toLangchainHistory(history);
        }

        const prefixMessages = this.toLangchainHistory(prefix);
        const tailMessages = this.toLangchainHistory(tail);

        const summaryPrompt = [
            new SystemMessage(
                "Tu es un assistant de résumé. Résume en français les messages précédents (partie ancienne de la conversation) " +
                    "en 5 à 8 points concis (<=120 mots), en conservant les faits et les intentions (pas de fioritures)."
            ),
            ...prefixMessages,
        ];

        const summaryMsg = await summarizer.invoke(summaryPrompt);
        const summary = getText(summaryMsg) ?? "";

        if (sseKey && process.env.LLM_SSE_DEBUG === "1") {
            this.llmService.sseBroadcast(sseKey, {
                type: "history_summary",
                data: { count: prefix.length, summary },
            });
        }

        return [
            new SystemMessage(`Résumé (messages précédents, pour contexte court et utile):\n${summary}`),
            ...tailMessages,
        ];
    }

    private extractToolCalls(ai: AIMessage | AIMessageChunk): ToolCall[] {
        let raw: any =
            (ai as any)?.tool_calls ??
            (ai as any)?.additional_kwargs?.tool_calls ??
            [];

        const toolCallChunks = (ai as any)?.tool_call_chunks;
        if (
            (!Array.isArray(raw) || raw.length === 0) &&
            Array.isArray(toolCallChunks) &&
            toolCallChunks.length > 0
        ) {
            try {
                const rebuilt = new AIMessageChunk({ content: "", tool_call_chunks: toolCallChunks });
                raw = (rebuilt as any)?.tool_calls ?? [];
            } catch {
                // ignore parsing failures; fallback to empty
                raw = [];
            }
        }

        if (!Array.isArray(raw)) return [];
        return raw.map((c: any, idx: number) => {
            const name = c?.name ?? c?.function?.name ?? "unknown_tool";
            const id = c?.id ?? c?.tool_call_id ?? `tool_${idx}_${Date.now()}`;
            const argsRaw = c?.args ?? c?.function?.arguments ?? "{}";
            let args: Record<string, unknown> = {};
            try {
                args = typeof argsRaw === "string" ? JSON.parse(argsRaw) : (argsRaw ?? {});
            } catch {
                args = { $raw: argsRaw };
            }
            return { id, name, args };
        });
    }

    private normalizeForHeuristics(text: string): string {
        return text
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/[’']/g, "'")
            .toLowerCase();
    }

    private looksLikePendingToolUse(text: string): boolean {
        const trimmed = text.trim();
        if (!trimmed) return false;
        const normalized = this.normalizeForHeuristics(trimmed);

        const startsWithStrategy =
            normalized.startsWith("strategie") || normalized.startsWith("strategy");

        const mentionsToolName =
            normalized.includes("search_from_natural_language") ||
            normalized.includes("search_from_uri") ||
            normalized.includes("get_most_connected_nodes");

        const verbMarkers = ["execute", "lance", "interroge", "explore", "appelle", "cherche", "utilise"];
        const hasVerbMarker = verbMarkers.some((m) => normalized.includes(m));

        const mentionsOntology = normalized.includes("ontologie") || normalized.includes("ontology");
        const mentionsNL =
            normalized.includes("nl") ||
            normalized.includes("natural language") ||
            normalized.includes("langage naturel");

        return (
            mentionsToolName ||
            startsWithStrategy ||
            (hasVerbMarker && (mentionsOntology || mentionsNL))
        );
    }

    private stableStringify(value: unknown): string {
        if (value === null) return "null";
        const t = typeof value;
        if (t === "string" || t === "number" || t === "boolean") {
            return JSON.stringify(value);
        }
        if (t === "undefined") return "null";
        if (t !== "object") return JSON.stringify(String(value));
        if (Array.isArray(value)) {
            return `[${value.map((v) => this.stableStringify(v)).join(",")}]`;
        }
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        const entries = keys.map((k) => `${JSON.stringify(k)}:${this.stableStringify(obj[k])}`);
        return `{${entries.join(",")}}`;
    }

    private makeToolSignature(name: string, args: Record<string, unknown>): string {
        return `${name}::${this.stableStringify(args)}`;
    }

    private getChunkText(chunk: AIMessageChunk): string {
        const c = (chunk as any)?.content;
        if (!c) return "";
        if (typeof c === "string") return c;
        if (Array.isArray(c)) {
            return c
                .map((p: any) => {
                    if (typeof p === "string") return p;
                    if (typeof p?.text === "string") return p.text;
                    return "";
                })
                .join("");
        }
        return "";
    }

    private async streamOneAssistantTurn(
        llmWithTools: Runnable,
        messages: BaseMessage[],
        sseKey: string
    ): Promise<{ finalChunk: AIMessageChunk | null; finalText: string }> {
        let finalChunk: AIMessageChunk | null = null;
        let streamedText = "";
        const stream = await (llmWithTools as any).stream(messages);

        for await (const chunk of stream as AsyncIterable<AIMessageChunk>) {
            const token = this.getChunkText(chunk);
            if (token) {
                streamedText += token;
                this.llmService.sseBroadcast(sseKey, { type: "chunk", data: token });
            }
            finalChunk = finalChunk ? (finalChunk as any).concat(chunk) : chunk;
        }

        return { finalChunk, finalText: streamedText };
    }

    private parseAgentSteps(raw?: string): AgentStep[] | undefined {
        if (!raw) return undefined;
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return undefined;
            return parsed
                .filter(
                    (step) =>
                        step &&
                        typeof step === "object" &&
                        typeof step.id === "string" &&
                        typeof step.name === "string"
                )
                .map((step) => ({
                    id: step.id,
                    name: step.name,
                    args: step.args,
                    result: (step as { result?: unknown }).result,
                }));
        } catch {
            return undefined;
        }
    }

    @Post("dashboard-summary")
    @ApiOperation({ summary: "Résumé LLM d'une section dashboard" })
    @ApiResponse({ status: 201, type: SummaryResponseDto })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    async summarizeDashboard(
        @Req() req: AuthRequest,
        @Body() body: DashboardSummaryRequestDto
    ) {
        const section = body.section || "dashboard";
        const lang = body.language || "fr";
        const summary = await this.llmService.summarizeDashboard(section, body.payload, lang);
        return { summary };
    }

    @Post("comment-summary")
    @ApiOperation({ summary: "Résumé LLM des commentaires d'un individu" })
    @ApiResponse({ status: 201, type: SummaryResponseDto })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    async summarizeComments(
        @Req() req: AuthRequest,
        @Body() body: CommentSummaryRequestDto
    ) {
        const lang = body.language || "fr";
        const summary = await this.llmService.summarizeIndividualComments({
            individual: body.individual,
            comments: body.comments,
            language: lang,
        });
        return { summary };
    }

    @Post("ask")
    @ApiOperation({
        summary: "Interroger l'assistant (SSE)",
        description: "Retourne un flux Server-Sent Events (text/event-stream).",
    })
    @ApiResponse({
        status: 200,
        description: "Flux SSE de réponse assistant.",
        content: {
            "text/event-stream": {
                schema: { type: "string" },
                example: "event: chunk\\ndata: Bonjour\\n\\n",
            },
        },
    })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    async ask(@Req() req: AuthRequest, @Body() dto: AskDto, @Res() res: Response) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Cache-Control", "no-cache");
        if (typeof (res as any).flushHeaders === "function") (res as any).flushHeaders();

        const key = dto.idempotencyKey;
        const sessionId = dto.sessionId.trim();
        const { isFirst } = this.llmService.registerSseSubscriber(key, res);
        if (!isFirst) {
            this.llmService.sseBroadcast(key, { type: "info", data: "Reconnexion au flux en cours." });
            return;
        }

        const userMessage: AppendMessageInput = { role: "user", content: dto.question };
        let assistantMessage: AppendMessageInput | null = null;
        const agentSteps: AgentStep[] = [];

        try {
            await this.chatHistory.ensureSession(req.user.sub, sessionId, { ontologyIri: dto.ontologyIri });

            const { llm, llmWithTools, tools } = this.llmService.prepareAgentExecutor({
                userIri: req.user.sub,
                ontologyIri: dto.ontologyIri,
                sessionId,
            });

            let summarizer: Runnable | undefined;
            try {
                summarizer = this.llmService.buildDecisionModel();
            } catch (err) {
                console.warn("[LLM Controller] Decision model unavailable:", err instanceof Error ? err.message : err);
            }

            if (process.env.LLM_SSE_DEBUG === "1") {
                this.llmService.sseBroadcast(key, {
                    type: "tools_schema",
                    data: tools.map((t) => convertToOpenAITool(t)),
                });
            }

            const buildSystemPrompt = () => {
                let prompt = `${SYSTEM_PROMPT_FR}${dto.ontologyIri ? `\nContexte: l'ontologie active est <${dto.ontologyIri}>` : ""}`;
                const persistentResults = this.llmService.getPersistentResultsFor(req.user.sub, dto.ontologyIri, sessionId);
                if (persistentResults && persistentResults.trim()) {
                    prompt += `\n\n--- RESULTATS DES RECHERCHES PRECEDENTES ---\n${persistentResults}`;
                }
                return prompt;
            };

            const systemPrompt = buildSystemPrompt();
            this.llmService.sseBroadcast(key, { type: "system_prompt", data: systemPrompt });

            const baseHistory = summarizer
                ? await this.compressHistoryIfNeeded(summarizer, dto.history, key)
                : this.toLangchainHistory(dto.history);

            const messages: BaseMessage[] = [
                new SystemMessage(systemPrompt),
                ...baseHistory,
                new HumanMessage(dto.question),
            ];

            let finalAssistantText = "";
            let awaitingToolCall = false;
            let toolCallNudge: SystemMessage | null = null;
            const toolResultCache = new Map<string, string>();
            let toolInvocations = 0;
            const MAX_TOOL_INVOCATIONS_TOTAL = 20;
            const MAX_TOOL_CALLS_PER_STEP = 12;
            let didBreakEarly = false;

            for (let step = 0; step < MAX_STEPS; step++) {
                if (step > 0) {
                    this.llmService.sseBroadcast(key, { type: "chunk", data: "\n" });
                }

                this.llmService.sseBroadcast(key, {
                    type: "info",
                    data: `--- Étape ${step + 1}/${MAX_STEPS} ---`,
                });

                const turnMessages = toolCallNudge ? [...messages, toolCallNudge] : messages;
                toolCallNudge = null;
                const { finalChunk, finalText } = await this.streamOneAssistantTurn(llmWithTools, turnMessages, key);
                if (finalText?.trim()) {
                    finalAssistantText = finalText;
                }

                let toolCallPayload: any =
                    (finalChunk as any)?.tool_calls ??
                    (finalChunk as any)?.additional_kwargs?.tool_calls ??
                    undefined;
                const toolCallChunks = (finalChunk as any)?.tool_call_chunks;
                if (
                    toolCallPayload === undefined &&
                    Array.isArray(toolCallChunks) &&
                    toolCallChunks.length > 0
                ) {
                    try {
                        const rebuilt = new AIMessageChunk({ content: "", tool_call_chunks: toolCallChunks });
                        toolCallPayload = (rebuilt as any)?.tool_calls ?? undefined;
                    } catch {
                        // ignore parsing failures
                    }
                }
                const aiMessageForHistory = new AIMessage({
                    content: finalText,
                    ...(toolCallPayload ? { tool_calls: toolCallPayload } : {}),
                    additional_kwargs: (finalChunk as any)?.additional_kwargs ?? {},
                });
                messages.push(aiMessageForHistory);

                const toolCalls = finalChunk ? this.extractToolCalls(finalChunk) : [];
                if (toolCalls.length === 0) {
                    if (
                        !awaitingToolCall &&
                        this.looksLikePendingToolUse(finalText) &&
                        step < MAX_STEPS - 1
                    ) {
                        awaitingToolCall = true;
                        this.llmService.sseBroadcast(key, {
                            type: "info",
                            data: "Je passe à l'exécution via les outils...",
                        });
                        toolCallNudge = new SystemMessage(
                            "Tu as annoncé une recherche/stratégie. Maintenant exécute-la en appelant l'outil le plus pertinent. " +
                                "Si un outil est disponible, réponds uniquement par un appel d'outil (tool_call), sans texte supplémentaire."
                        );
                        continue;
                    }
                    didBreakEarly = true;
                    break;
                }
                awaitingToolCall = false;

                const toolMessages: ToolMessage[] = [];

                const toolCallsToRun = toolCalls.slice(0, MAX_TOOL_CALLS_PER_STEP);
                const toolCallsSkipped = toolCalls.slice(MAX_TOOL_CALLS_PER_STEP);
                if (toolCallsSkipped.length > 0) {
                    this.llmService.sseBroadcast(key, {
                        type: "info",
                        data: `Trop d'appels d'outils dans un même tour (${toolCalls.length}). Je limite à ${MAX_TOOL_CALLS_PER_STEP} et je synthétise ensuite.`,
                    });
                    for (const tc of toolCallsSkipped) {
                        toolMessages.push(
                            new ToolMessage({
                                tool_call_id: tc.id,
                                content:
                                    "Appel d'outil non exécuté (trop d'appels dans le même tour). " +
                                    "Utilise les informations déjà collectées et passe à la synthèse.",
                            })
                        );
                    }
                }

                for (const tc of toolCallsToRun) {
                    const signature = this.makeToolSignature(tc.name, tc.args);
                    const cached = toolResultCache.get(signature);
                    if (cached) {
                        toolMessages.push(
                            new ToolMessage({
                                tool_call_id: tc.id,
                                content: `Resultat reutilise (appel identique deja execute):\n${cached}`,
                            })
                        );
                        continue;
                    }

                    const stepIndex = agentSteps.length;
                    agentSteps.push({ id: tc.id, name: tc.name, args: tc.args });

                    this.llmService.sseBroadcast(key, {
                        type: "tool_call",
                        data: { id: tc.id, name: tc.name, args: tc.args },
                    });

                    const tool = tools.find((t) => t.name === tc.name);
                    if (!tool) {
                        const errorMsg = `Erreur: l'outil '${tc.name}' est introuvable.`;
                        toolResultCache.set(signature, errorMsg);
                        agentSteps[stepIndex] = { ...agentSteps[stepIndex], result: errorMsg };
                        this.llmService.sseBroadcast(key, {
                            type: "tool_result",
                            data: { id: tc.id, name: tc.name, observation: errorMsg },
                        });
                        toolMessages.push(new ToolMessage({ tool_call_id: tc.id, content: errorMsg }));
                        continue;
                    }

                    if (toolInvocations >= MAX_TOOL_INVOCATIONS_TOTAL) {
                        const limitMsg =
                            "Appel d'outil non execute (limite atteinte). " +
                            "Synthetise avec les informations deja collectees.";
                        toolResultCache.set(signature, limitMsg);
                        agentSteps[stepIndex] = { ...agentSteps[stepIndex], result: limitMsg };
                        this.llmService.sseBroadcast(key, {
                            type: "tool_result",
                            data: { id: tc.id, name: tc.name, observation: limitMsg },
                        });
                        toolMessages.push(new ToolMessage({ tool_call_id: tc.id, content: limitMsg }));
                        continue;
                    }

                    try {
                        const observation = await tool.invoke(tc.args);
                        const observationStr =
                            typeof observation === "string" ? observation : JSON.stringify(observation);
                        toolResultCache.set(signature, observationStr);
                        toolInvocations += 1;
                        agentSteps[stepIndex] = { ...agentSteps[stepIndex], result: observationStr };
                        this.llmService.sseBroadcast(key, {
                            type: "tool_result",
                            data: { id: tc.id, name: tc.name, observation: observationStr },
                        });
                        toolMessages.push(new ToolMessage({ tool_call_id: tc.id, content: observationStr }));
                    } catch (toolErr) {
                        const errorMsg =
                            toolErr instanceof Error
                                ? `Erreur lors de l'exécution de l'outil: ${toolErr.message}`
                                : "Erreur inconnue lors de l'exécution de l'outil.";
                        agentSteps[stepIndex] = { ...agentSteps[stepIndex], result: errorMsg };
                        this.llmService.sseBroadcast(key, {
                            type: "tool_result",
                            data: { id: tc.id, name: tc.name, observation: errorMsg },
                        });
                        toolMessages.push(new ToolMessage({ tool_call_id: tc.id, content: errorMsg }));
                    }
                }

                if (toolMessages.length) {
                    messages.push(...toolMessages);
                }

                const updatedPrompt = buildSystemPrompt();
                messages[0] = new SystemMessage(updatedPrompt);
                this.llmService.sseBroadcast(key, { type: "system_prompt", data: updatedPrompt });
            }

            let assistantText = finalAssistantText.trim()
                ? finalAssistantText
                : "Je n’ai pas pu formuler la réponse finale. Les outils n'ont peut-être pas trouvé de résultats pertinents.";

            const shouldForceFinalAnswer =
                !didBreakEarly ||
                this.looksLikePendingToolUse(assistantText) ||
                toolInvocations >= MAX_TOOL_INVOCATIONS_TOTAL;

            if (shouldForceFinalAnswer) {
                this.llmService.sseBroadcast(key, {
                    type: "info",
                    data: "Je synthetise les resultats et je reponds.",
                });
                try {
                    const finalizerMsg = await llm.invoke([
                        ...messages,
                        new SystemMessage(
                            "Redige maintenant la reponse finale a l'utilisateur (francais, 5-7 lignes max). " +
                                "N'annonce plus de strategie et n'appelle aucun outil. " +
                                "Si une information manque (entite/relation absente), dis-le explicitement et propose la prochaine etape utile."
                        ),
                    ]);
                    const finalText = (getText(finalizerMsg) ?? "").trim();
                    if (finalText) {
                        assistantText = finalText;
                        this.llmService.sseBroadcast(key, { type: "chunk", data: finalText });
                    } else if (!finalAssistantText.trim()) {
                        this.llmService.sseBroadcast(key, { type: "chunk", data: assistantText });
                    }
                } catch (finalErr) {
                    console.warn(
                        "[LLM Controller] Finalization step failed:",
                        finalErr instanceof Error ? finalErr.message : finalErr
                    );
                    if (!finalAssistantText.trim()) {
                        this.llmService.sseBroadcast(key, { type: "chunk", data: assistantText });
                    }
                }
            } else if (!finalAssistantText.trim()) {
                this.llmService.sseBroadcast(key, { type: "chunk", data: assistantText });
            }

            assistantMessage = { role: "assistant", content: assistantText };
            if (agentSteps.length > 0) {
                assistantMessage.agentSteps = JSON.stringify(agentSteps);
            }
        } catch (err) {
            console.error("[LLM Controller] Critical error during agent execution:", err);
            const errorMessage = err instanceof Error ? err.message : "Une erreur critique est survenue.";
            assistantMessage = { role: "assistant", content: errorMessage };
            if (agentSteps.length > 0 && !assistantMessage.agentSteps) {
                assistantMessage.agentSteps = JSON.stringify(agentSteps);
            }
            this.llmService.sseBroadcast(key, { type: "error", data: errorMessage });
        } finally {
            try {
                const toPersist: AppendMessageInput[] = [userMessage];
                if (assistantMessage) {
                    toPersist.push(assistantMessage);
                }
                await this.chatHistory.appendMessages(req.user.sub, sessionId, toPersist, {
                    ontologyIri: dto.ontologyIri,
                });
            } catch (persistErr) {
                console.error("[LLM Controller] Failed to persist chat history:", persistErr);
            } finally {
                this.llmService.finishSseRun(key);
            }
        }
    }

    @Get("system-prompt")
    @ApiOperation({ summary: "Récupérer le system prompt LLM" })
    @ApiOkResponse({ type: SystemPromptResponseDto })
    @ApiQuery({
        name: "ontologyIri",
        required: false,
        type: String,
        example: "http://example.org/ontology/core",
    })
    @ApiQuery({ name: "sessionId", required: false, type: String, example: "session-abc" })
    async getSystemPrompt(
        @Req() req: AuthRequest,
        @Query("ontologyIri") ontologyIri?: string,
        @Query("sessionId") sessionId?: string
    ) {
        let prompt = `${SYSTEM_PROMPT_FR}${ontologyIri ? `\nContexte: l'ontologie active est <${ontologyIri}>` : ""}`;
        const persistentResults = this.llmService.getPersistentResultsFor(req.user.sub, ontologyIri, sessionId);
        if (persistentResults && persistentResults.trim()) {
            prompt += `\n\n--- RESULTATS DES RECHERCHES PRECEDENTES ---\n${persistentResults}`;
        }
        return { systemPrompt: prompt };
    }

    @Get("chat-sessions")
    @ApiOperation({ summary: "Lister les sessions de chat" })
    @ApiOkResponse({ type: ChatSessionsResponseDto })
    @ApiQuery({
        name: "ontologyIri",
        required: false,
        type: String,
        example: "http://example.org/ontology/core",
    })
    async listChatSessions(
        @Req() req: AuthRequest,
        @Query("ontologyIri") ontologyIri?: string,
    ) {
        const sessions = await this.chatHistory.listSessions(req.user.sub, ontologyIri);
        return { sessions };
    }

    @Post("chat-sessions")
    @ApiOperation({ summary: "Créer une session de chat" })
    @ApiResponse({ status: 201, type: ChatSessionResponseDto })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    async createChatSession(
        @Req() req: AuthRequest,
        @Body() dto: CreateChatSessionDto,
    ) {
        const session = await this.chatHistory.createSession(req.user.sub, {
            title: dto.title,
            ontologyIri: dto.ontologyIri,
        });
        return { session };
    }

    @Patch("chat-sessions/:sessionId")
    @ApiOperation({ summary: "Renommer une session de chat" })
    @ApiOkResponse({ type: SuccessResponseDto })
    @ApiParam({ name: "sessionId", example: "session-abc" })
    @ApiNotFoundResponse({ type: ApiErrorDto })
    @ApiBadRequestResponse({ type: ApiErrorDto })
    async renameChatSession(
        @Req() req: AuthRequest,
        @Param("sessionId") sessionId: string,
        @Body() dto: UpdateChatSessionDto,
    ) {
        if (dto.title !== undefined) {
            await this.chatHistory.renameSession(req.user.sub, sessionId, dto.title);
        }
        return { success: true };
    }

    @Delete("chat-sessions/:sessionId")
    @ApiOperation({ summary: "Supprimer une session de chat" })
    @ApiOkResponse({ type: SuccessResponseDto })
    @ApiParam({ name: "sessionId", example: "session-abc" })
    @ApiNotFoundResponse({ type: ApiErrorDto })
    async deleteChatSession(
        @Req() req: AuthRequest,
        @Param("sessionId") sessionId: string,
    ) {
        await this.chatHistory.deleteSession(req.user.sub, sessionId);
        return { success: true };
    }

    @Get("chat-sessions/:sessionId/messages")
    @ApiOperation({ summary: "Lister les messages d'une session" })
    @ApiOkResponse({ type: ChatMessagesResponseDto })
    @ApiParam({ name: "sessionId", example: "session-abc" })
    @ApiNotFoundResponse({ type: ApiErrorDto })
    async getChatSessionMessages(
        @Req() req: AuthRequest,
        @Param("sessionId") sessionId: string,
    ) {
        const messages = await this.chatHistory.getMessages(req.user.sub, sessionId);
        return {
            messages: messages.map((message) => ({
                id: message.id,
                role: message.role,
                content: message.content,
                createdAt: message.createdAt,
                index: message.index,
                agentSteps: this.parseAgentSteps(message.agentSteps),
            })),
        };
    }
}
