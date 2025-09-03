import { Body, Controller, Req, UseGuards, Post, Res, Get, Query } from "@nestjs/common";
import { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LlmService } from "./llm.service";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { SYSTEM_PROMPT_FR } from "./prompt";
import { AskDto, HistoryItemDto } from "./llm.dto";
import { getText } from "./llm.utils";

type AuthRequest = Request & { user: { sub: string; email?: string } };
/** Structure d'un appel d'outil tel que défini par LangChain. */
interface ToolCall { name: string; args: Record<string, unknown>; id: string; }

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
        // Toujours initialiser la réponse en mode SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Cache-Control", "no-cache");
        if (typeof (res as any).flushHeaders === "function") (res as any).flushHeaders();

        const key = dto.idempotencyKey;
        const { isFirst } = this.llmService.registerSseSubscriber(key, res);
        // Si ce n'est pas le premier, on se contente de s'abonner: l'exécution en cours diffusera les événements.
        if (!isFirst) {
            this.llmService.sseBroadcast(key, { type: "info", data: "Reconnexion au flux en cours." });
            return; // Laisser la connexion ouverte.
        }

        const collectedObservations: string[] = [];
        try {
            const { llm, llmWithTools, tools } = this.llmService.prepareAgentExecutor({
                userIri: req.user.sub,
                ontologyIri: dto.ontologyIri,
                sessionId: dto.sessionId,
            });
            // Construire le prompt système de base avec toujours les résultats persistants (par utilisateur/ontologie)
            const buildSystemPrompt = () => {
                let prompt = `${SYSTEM_PROMPT_FR}${dto.ontologyIri ? `\nContexte: l'ontologie active est <${dto.ontologyIri}>` : ""}`;
                const persistentResults = this.llmService.getPersistentResultsFor(req.user.sub, dto.ontologyIri, dto.sessionId);
                if (persistentResults && persistentResults.trim()) {
                    prompt += `\n\n--- RESULTATS DES RECHERCHES PRECEDENTES ---\n${persistentResults}`;
                }
                return prompt;
            };
            const systemPrompt = buildSystemPrompt();
            console.log("System Prompt: ",systemPrompt)
            // Diffuse le prompt système initial pour affichage côté client
            this.llmService.sseBroadcast(key, { type: "system_prompt", data: systemPrompt });
            const messages: BaseMessage[] = [
                new SystemMessage(systemPrompt),
                ...this.toLangchainHistory(dto.history),
                new HumanMessage(dto.question),
            ];
            for (let i = 0; i < 5; i++) {
                const aiResponse = await llmWithTools.invoke(messages);
                const toolCalls = (aiResponse as any).tool_calls as ToolCall[] | undefined;
                if (Array.isArray(toolCalls) && toolCalls.length > 0) {
                    // Streamer tout texte inline qui accompagne l'appel d'outil
                    const inlineText = getText(aiResponse);
                    if (inlineText && inlineText.trim()) {
                        this.llmService.sseBroadcast(key, { type: "chunk", data: inlineText });
                    }
                    messages.push(aiResponse);
                    const toolMessages = await Promise.all(
                        toolCalls.map(async (toolCall: ToolCall) => {
                            this.llmService.sseBroadcast(key, {
                                type: "tool_call",
                                data: { id: toolCall.id, name: toolCall.name, args: toolCall.args },
                            });
                            const tool = tools.find((t) => t.name === toolCall.name);
                            if (!tool) {
                                const errorMsg = `Error: Tool '${toolCall.name}' not found.`;
                                this.llmService.sseBroadcast(key, {
                                    type: "tool_result",
                                    data: { id: toolCall.id, name: toolCall.name, observation: errorMsg },
                                });
                                return new ToolMessage({ tool_call_id: toolCall.id, content: errorMsg });
                            }
                            const observation = await tool.invoke(toolCall.args);
                            const observationStr = typeof observation === "string" ? observation : JSON.stringify(observation);
                            collectedObservations.push(observationStr);
                            this.llmService.sseBroadcast(key, {
                                type: "tool_result",
                                data: { id: toolCall.id, name: toolCall.name, observation: observationStr },
                            });
                            return new ToolMessage({ tool_call_id: toolCall.id, content: observationStr });
                        })
                    );
                    messages.push(...toolMessages);
                    // MISE À JOUR DU PROMPT SYSTEME avec les nouveaux résultats
                    // Remplace le premier message système par un nouveau avec les résultats mis à jour
                    const updatedPrompt = buildSystemPrompt();
                    messages[0] = new SystemMessage(updatedPrompt);
                    // Diffuse la mise à jour du prompt système pour l'affichage en temps réel
                    this.llmService.sseBroadcast(key, { type: "system_prompt", data: updatedPrompt });

                    messages.push(
                        new SystemMessage(
                            "Sur la base des résultats des outils, formule la réponse finale en 4 à 7 lignes, ton naturel et pédagogique, sans ré-appeler d'outil. Mentionne 2–4 sujets périphériques pertinents et explicite leur lien sémantique. Si aucun résultat pertinent n'a été trouvé, dis-le."
                        )
                    );
                    continue;
                }
                let text = getText(aiResponse);
                if (!text || !text.trim()) {
                    // Fallback si la réponse est vide
                    const finalMsg = await llm.invoke([
                        new SystemMessage("Réponds en français, très concis (3–6 lignes), sans inventer. Si rien de pertinent: dis-le."),
                        new HumanMessage(`Question: ${dto.question}\n\nObservations des outils:\n${collectedObservations.join("\n\n")}\n\nSynthèse concise :`),
                    ]);
                    text = getText(finalMsg);
                }
                this.llmService.sseBroadcast(key, {
                    type: "chunk",
                    data: text?.trim() ? text : "Je n’ai pas pu formuler la réponse finale. Les outils n'ont peut-être pas trouvé de résultats pertinents.",
                });
                break;
            }
        } catch (err) {
            console.error("[LLM Controller] Critical error during agent execution:", err);
            const errorMessage = err instanceof Error ? err.message : "Une erreur critique est survenue.";
            this.llmService.sseBroadcast(key, { type: "error", data: errorMessage });
        } finally {
            this.llmService.finishSseRun(key);
        }
    }

    @Get("system-prompt")
    async getSystemPrompt(
        @Req() req: AuthRequest,
        @Query("ontologyIri") ontologyIri?: string,
        @Query("sessionId") sessionId?: string,
    ) {
        let prompt = `${SYSTEM_PROMPT_FR}${ontologyIri ? `\nContexte: l'ontologie active est <${ontologyIri}>` : ""}`;
        const persistentResults = this.llmService.getPersistentResultsFor(req.user.sub, ontologyIri, sessionId);
        if (persistentResults && persistentResults.trim()) {
            prompt += `\n\n--- RESULTATS DES RECHERCHES PRECEDENTES ---\n${persistentResults}`;
        }
        return { systemPrompt: prompt };
    }
}
