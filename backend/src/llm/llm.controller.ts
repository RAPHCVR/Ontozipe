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
import { AskDto, HistoryItemDto, CreateChatSessionDto, UpdateChatSessionDto } from "./llm.dto";
import { getText } from "./llm.utils";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import type { Runnable } from "@langchain/core/runnables";
import { ChatHistoryService, AppendMessageInput } from "./chat-history.service";

const HISTORY_SUMMARY_TRIGGER = 14;
const HISTORY_SUMMARY_TAKE_LAST = 10;
const MAX_STEPS = 3;

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

        const keepCount = Math.max(0, history.length - HISTORY_SUMMARY_TAKE_LAST);
        const prefix = history.slice(0, keepCount);
        const tail = history.slice(keepCount);
        const tailMessages = this.toLangchainHistory(tail);

        const summaryPrompt = [
            new SystemMessage(
                "Tu es un assistant de résumé. Résume en français les 10 derniers messages (utilisateur et assistant) " +
                    "en 5 à 8 points concis (<=120 mots), en conservant les faits et les intentions (pas de fioritures)."
            ),
            ...tailMessages,
        ];

        const summaryMsg = await summarizer.invoke(summaryPrompt);
        const summary = getText(summaryMsg) ?? "";

        if (sseKey) {
            this.llmService.sseBroadcast(sseKey, {
                type: "history_summary",
                data: { count: HISTORY_SUMMARY_TAKE_LAST, summary },
            });
        }

        return [
            ...this.toLangchainHistory(prefix),
            new SystemMessage(`Résumé (10 derniers messages, pour contexte court et utile):\n${summary}`),
        ];
    }

    private extractToolCalls(ai: AIMessage | AIMessageChunk): ToolCall[] {
        const raw =
            (ai as any)?.tool_calls ??
            (ai as any)?.additional_kwargs?.tool_calls ??
            [];
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
    async summarizeDashboard(
        @Req() req: AuthRequest,
        @Body() body: { section: string; payload: unknown; language?: string }
    ) {
        const section = body.section || "dashboard";
        const lang = body.language || "fr";
        const summary = await this.llmService.summarizeDashboard(section, body.payload, lang);
        return { summary };
    }

    @Post("ask")
    async ask(@Req() req: AuthRequest, @Body() dto: AskDto, @Res() res: Response) {
        if (!dto.idempotencyKey) {
            return res.status(400).json({ message: "La clé d'idempotence est requise." });
        }
        if (!dto.sessionId || !dto.sessionId.trim()) {
            return res.status(400).json({ message: "Le sessionId est requis pour assurer l'historique persistant." });
        }

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
        const agentStepIndex = new Map<string, number>();

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

            this.llmService.sseBroadcast(key, {
                type: "tools_schema",
                data: tools.map((t) => convertToOpenAITool(t)),
            });

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

            for (let step = 0; step < MAX_STEPS; step++) {
                if (step > 0) {
                    this.llmService.sseBroadcast(key, { type: "chunk", data: "\n" });
                }

                this.llmService.sseBroadcast(key, {
                    type: "info",
                    data: `--- Étape ${step + 1}/${MAX_STEPS} ---`,
                });

                const { finalChunk, finalText } = await this.streamOneAssistantTurn(llmWithTools, messages, key);
                if (finalText?.trim()) {
                    finalAssistantText = finalText;
                }

                const toolCallPayload =
                    (finalChunk as any)?.tool_calls ??
                    (finalChunk as any)?.additional_kwargs?.tool_calls ??
                    undefined;
                const aiMessageForHistory = new AIMessage({
                    content: finalText,
                    ...(toolCallPayload ? { tool_calls: toolCallPayload } : {}),
                    additional_kwargs: (finalChunk as any)?.additional_kwargs ?? {},
                });
                messages.push(aiMessageForHistory);

                const toolCalls = finalChunk ? this.extractToolCalls(finalChunk) : [];
                if (toolCalls.length === 0) {
                    break;
                }

                const toolMessages: ToolMessage[] = [];
                const toolSysMessages: SystemMessage[] = [];
                for (const tc of toolCalls) {
                    const stepIndex = agentSteps.length;
                    agentSteps.push({ id: tc.id, name: tc.name, args: tc.args });
                    agentStepIndex.set(tc.id, stepIndex);

                    this.llmService.sseBroadcast(key, {
                        type: "tool_call",
                        data: { id: tc.id, name: tc.name, args: tc.args },
                    });

                    const tool = tools.find((t) => t.name === tc.name);
                    if (!tool) {
                        const errorMsg = `Erreur: l'outil '${tc.name}' est introuvable.`;
                        agentSteps[stepIndex] = { ...agentSteps[stepIndex], result: errorMsg };
                        this.llmService.sseBroadcast(key, {
                            type: "tool_result",
                            data: { id: tc.id, name: tc.name, observation: errorMsg },
                        });
                        toolMessages.push(new ToolMessage({ tool_call_id: tc.id, content: errorMsg }));
                        toolSysMessages.push(
                            new SystemMessage(`Résultat de l'outil '${tc.name}' (id ${tc.id}) : ${errorMsg}`)
                        );
                        continue;
                    }

                    try {
                        const observation = await tool.invoke(tc.args);
                        const observationStr =
                            typeof observation === "string" ? observation : JSON.stringify(observation);
                        agentSteps[stepIndex] = { ...agentSteps[stepIndex], result: observationStr };
                        this.llmService.sseBroadcast(key, {
                            type: "tool_result",
                            data: { id: tc.id, name: tc.name, observation: observationStr },
                        });
                        toolMessages.push(new ToolMessage({ tool_call_id: tc.id, content: observationStr }));
                        toolSysMessages.push(
                            new SystemMessage(
                                `Résultat de l'outil '${tc.name}' (id ${tc.id}) : ${observationStr}`
                            )
                        );
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
                        toolSysMessages.push(
                            new SystemMessage(`Résultat de l'outil '${tc.name}' (id ${tc.id}) : ${errorMsg}`)
                        );
                    }
                }

                if (toolMessages.length) {
                    messages.push(...toolMessages);
                }
                if (toolSysMessages.length) {
                    messages.push(...toolSysMessages);
                }

                const updatedPrompt = buildSystemPrompt();
                messages[0] = new SystemMessage(updatedPrompt);
                this.llmService.sseBroadcast(key, { type: "system_prompt", data: updatedPrompt });
            }

            const assistantText = finalAssistantText.trim()
                ? finalAssistantText
                : "Je n’ai pas pu formuler la réponse finale. Les outils n'ont peut-être pas trouvé de résultats pertinents.";

            if (!finalAssistantText.trim()) {
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
    async listChatSessions(
        @Req() req: AuthRequest,
        @Query("ontologyIri") ontologyIri?: string,
    ) {
        const sessions = await this.chatHistory.listSessions(req.user.sub, ontologyIri);
        return { sessions };
    }

    @Post("chat-sessions")
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
    async deleteChatSession(
        @Req() req: AuthRequest,
        @Param("sessionId") sessionId: string,
    ) {
        await this.chatHistory.deleteSession(req.user.sub, sessionId);
        return { success: true };
    }

    @Get("chat-sessions/:sessionId/messages")
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
