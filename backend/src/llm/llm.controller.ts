import { Body, Controller, Req, UseGuards, Post, Res, ConflictException } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LlmService } from "./llm.service";
import { IsArray, IsIn, IsUrl, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { SYSTEM_PROMPT_FR } from "./prompt";

// --- DTOs et types ---
class HistoryItemDto {
    @IsIn(["user", "assistant", "system"]) role!: "user" | "assistant" | "system";
    @IsString() content!: string;
}
class AskDto {
    @IsString() @IsNotEmpty() question!: string;
    @IsOptional() @IsUrl() ontologyIri?: string;
    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => HistoryItemDto) history?: HistoryItemDto[];

    @IsOptional()
    @IsString()
    idempotencyKey?: string;
}
type AuthRequest = Request & { user: { sub: string; email?: string } };

/** Structure d'un appel d'outil tel que défini par LangChain. */
interface ToolCall { name: string; args: Record<string, unknown>; id: string; }

/** Helper pour envoyer des événements formatés en Server-Sent Events (SSE). */
const sendSse = (res: Response, event: { type: string; data: unknown }) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
};

/**
 * Extrait le contenu textuel d'un message, gérant les cas où le contenu
 * est une chaîne simple ou un tableau de "parts".
 */
function getText(msg: BaseMessage): string {
    const c: any = (msg as any).content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) {
        return c
            .filter((p) => p && typeof p === "object" && p.type === "text" && typeof p.text === "string")
            .map((p) => p.text)
            .join("");
    }
    return "";
}

@Controller("llm")
@UseGuards(JwtAuthGuard)
export class LlmController {
    constructor(private readonly llmService: LlmService) {}

    private toLangchainHistory(history?: HistoryItemDto[]): BaseMessage[] {
        if (!history) return [];
        return history.map((h) => {
            if (h.role === "system") return new SystemMessage(h.content);
            if (h.role === "assistant") return new AIMessage({ content: h.content });
            return new HumanMessage(h.content);
        });
    }

    @Post("ask")
    async ask(@Req() req: AuthRequest, @Body() dto: AskDto, @Res() res: Response) {
        if (!dto.idempotencyKey) {
            return res.status(400).json({ message: "La clé d'idempotence est requise." });
        }

        try {
            await this.llmService.executeOnce(dto.idempotencyKey, async () => {
                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Connection", "keep-alive");
                res.setHeader("Cache-Control", "no-cache");
                res.flushHeaders();

                const collectedObservations: string[] = [];

                try {
                    const { llm, llmWithTools, tools } = this.llmService.prepareAgentExecutor({
                        userIri: req.user.sub,
                        ontologyIri: dto.ontologyIri,
                    });

                    const messages: BaseMessage[] = [
                        new SystemMessage(`${SYSTEM_PROMPT_FR}${dto.ontologyIri ? `\nContexte: l'ontologie active est <${dto.ontologyIri}>.` : ''}`),
                        ...this.toLangchainHistory(dto.history),
                        new HumanMessage(dto.question),
                    ];

                    for (let i = 0; i < 5; i++) {
                        const aiResponse = await llmWithTools.invoke(messages);

                        if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
                            messages.push(aiResponse);
                            const toolMessages = await Promise.all(
                                aiResponse.tool_calls.map(async (toolCall: ToolCall) => {
                                    sendSse(res, { type: "tool_call", data: { name: toolCall.name, args: toolCall.args } });
                                    const tool = tools.find((t) => t.name === toolCall.name);
                                    if (!tool) {
                                        const errorMsg = `Error: Tool '${toolCall.name}' not found.`;
                                        sendSse(res, { type: "tool_result", data: { name: toolCall.name, observation: errorMsg } });
                                        return new ToolMessage({ tool_call_id: toolCall.id, content: errorMsg });
                                    }
                                    const observation = await tool.invoke(toolCall.args);
                                    const observationStr = typeof observation === "string" ? observation : JSON.stringify(observation);
                                    collectedObservations.push(observationStr);
                                    sendSse(res, { type: "tool_result", data: { name: toolCall.name, observation: observationStr } });
                                    return new ToolMessage({ tool_call_id: toolCall.id, content: observationStr });
                                })
                            );
                            messages.push(...toolMessages);
                            messages.push(new SystemMessage("Sur la base des résultats des outils, produis maintenant la réponse finale en 3 à 6 lignes, sans ré-appeler d’outil. Si aucun résultat pertinent n’a été trouvé, dis-le."));
                            continue;
                        }

                        let text = getText(aiResponse);
                        if (!text || !text.trim()) {
                            // Fallback "finalizer" si la réponse est vide
                            console.log("Final response empty, attempting to summarize observations.");
                            const finalMsg = await llm.invoke([
                                new SystemMessage("Réponds en français, très concis (3–6 lignes), sans inventer. Si rien de pertinent: dis-le."),
                                new HumanMessage(`Question: ${dto.question}\n\nObservations des outils:\n${collectedObservations.join("\n\n")}\n\nSynthèse concise :`),
                            ]);
                            text = getText(finalMsg);
                        }

                        sendSse(res, { type: "chunk", data: text?.trim() ? text : "Je n’ai pas pu formuler la réponse finale. Les outils n'ont peut-être pas trouvé de résultats pertinents." });
                        break;
                    }
                } catch (err) {
                    console.error("[LLM Controller] Critical error during agent execution:", err);
                    const errorMessage = err instanceof Error ? err.message : "Une erreur critique est survenue.";
                    sendSse(res, { type: 'error', data: errorMessage });
                } finally {
                    sendSse(res, { type: 'done', data: null });
                    res.end();
                }
            });
        } catch (err) {
            if (err instanceof ConflictException) {
                return res.status(409).json({ message: err.message });
            }
            console.error("[LLM Controller] Critical error before starting stream:", err);
            return res.status(500).json({ message: "Une erreur critique est survenue." });
        }
    }
}