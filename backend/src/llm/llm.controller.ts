import { Body, Controller, Req, UseGuards, Post, Res } from "@nestjs/common";
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
}
type AuthRequest = Request & { user: { sub: string; email?: string } };

/**
 * Structure d'un appel d'outil tel que défini par LangChain.
 * Utilisé pour satisfaire le typage TypeScript dans la boucle de l'agent.
 */
interface ToolCall {
    name: string;
    args: Record<string, unknown>;
    id: string;
}

/**
 * Helper pour envoyer des événements formatés en Server-Sent Events (SSE).
 */
const sendSse = (res: Response, event: { type: string; data: unknown }) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
};

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
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Cache-Control", "no-cache");
        res.flushHeaders();

        try {
            const { llmWithTools, tools } = this.llmService.prepareAgentExecutor({
                userIri: req.user.sub,
                ontologyIri: dto.ontologyIri,
            });

            const messages: BaseMessage[] = [
                new SystemMessage(`${SYSTEM_PROMPT_FR}${dto.ontologyIri ? `\nContexte: l'ontologie active est <${dto.ontologyIri}>.` : ''}`),
                ...this.toLangchainHistory(dto.history),
                new HumanMessage(dto.question),
            ];

            // Boucle de l'agent, limitée pour éviter les exécutions infinies.
            for (let i = 0; i < 5; i++) {
                console.log(`--- Agent Loop: Iteration ${i + 1} ---`);
                const aiResponse = await llmWithTools.invoke(messages);
                console.log("AI Response received:", JSON.stringify(aiResponse, null, 2));

                // Cas 1 : Le modèle décide d'appeler un ou plusieurs outils.
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
                            sendSse(res, { type: "tool_result", data: { name: toolCall.name, observation } });
                            return new ToolMessage({ tool_call_id: toolCall.id, content: String(observation) });
                        })
                    );
                    messages.push(...toolMessages);
                    continue; // Continue la boucle pour que le modèle utilise les nouveaux résultats
                }

                // Cas 2 : Le modèle a terminé et a donné une réponse finale.
                console.log("--- Agent Loop Finished ---");
                if (aiResponse.content) {
                    // On envoie le contenu final comme un seul chunk.
                    sendSse(res, { type: "chunk", data: aiResponse.content });
                }
                break; // La conversation est terminée pour cette question.
            }

        } catch (err) {
            console.error("[LLM Controller] Critical error during agent execution:", err);
            const errorMessage = err instanceof Error ? err.message : "Une erreur critique est survenue.";
            sendSse(res, { type: 'error', data: errorMessage });
        } finally {
            res.end();
        }
    }
}