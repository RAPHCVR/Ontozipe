import { Body, Controller, Req, UseGuards, Post, Res, Get, Query } from "@nestjs/common";
import { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LlmService } from "./llm.service";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { SYSTEM_PROMPT_FR } from "./prompt";
import { AskDto, HistoryItemDto } from "./llm.dto";
import { getText } from "./llm.utils";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";

// =======================
//   CONSTANT PARAMETERS
// =======================
const HISTORY_SUMMARY_TRIGGER = 14;
const HISTORY_SUMMARY_TAKE_LAST = 10;
const MAX_DONE_RERUNS = 3;
const MAX_STEPS = 3;

type AuthRequest = Request & { user: { sub: string; email?: string } };

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  id: string;
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

  private async compressHistoryIfNeeded(
    llm: any,
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
    const summaryMsg = await llm.invoke(summaryPrompt);
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

  private async checkIfDoneWithDecisionModel(
    decisionLlm: any,
    lastUserQuestion: string,
    sinceLastUser: BaseMessage[]
  ): Promise<{ done: boolean; why?: string; next?: string }> {
    const system = new SystemMessage(
      [
        "Tu es un modèle de décision. Analyse si l'agent a terminé la tâche.",
        "Réponds UNIQUEMENT en JSON valide de la forme:",
        '{ "done": true|false, "why": "raison courte", "next": "étape suivante si done=false" }',
        "Critères:",
        "- done=true si une réponse finale utile a été fournie ou si aucun appel d'outil supplémentaire n'est nécessaire.",
        "- done=false si UNE seule étape supplémentaire (appel d'outil ou synthèse) est encore nécessaire.",
      ].join("\n")
    );
    const human = new HumanMessage(
      [
        "Dernier message utilisateur:",
        lastUserQuestion,
        "",
        "Historique (depuis ce message, assistant + messages système incluant résultats d'outils):",
        ...sinceLastUser.map((m) => {
          const content = (m as any)?.content ?? "";
          const kind = m._getType();
          if (kind === "ai") return `ASSISTANT: ${typeof content === "string" ? content : getText(m) ?? ""}`;
          if (kind === "system") return `SYSTEM: ${typeof content === "string" ? content : JSON.stringify(content)}`;
          return `MSG: ${typeof content === "string" ? content : JSON.stringify(content)}`;
        }),
        "",
        "Es-tu terminé ? Donne ta réponse JSON:",
      ].join("\n")
    );

    try {
      const result = await decisionLlm.invoke([system, human]);
      const txt = (getText(result) ?? "").trim();
      const parsed = JSON.parse(txt);
      const done = typeof parsed.done === "boolean" ? parsed.done : false;
      return {
        done,
        why: typeof parsed.why === "string" ? parsed.why : undefined,
        next: typeof parsed.next === "string" ? parsed.next : undefined,
      };
    } catch {
      return { done: true };
    }
  }

  private extractToolCalls(ai: AIMessage): ToolCall[] {
    const raw = (ai as any)?.tool_calls ?? (ai as any)?.additional_kwargs?.tool_calls ?? [];
    if (!Array.isArray(raw)) return [];
    return raw.map((c: any, idx: number) => {
      const name = c?.name ?? c?.function?.name ?? "unknown_tool";
      const id = c?.id ?? c?.tool_call_id ?? `tool_${idx}_${Date.now()}`;
      const argsRaw = c?.args ?? c?.function?.arguments ?? "{}";
      let args: Record<string, unknown> = {};
      try {
        args = typeof argsRaw === "string" ? JSON.parse(argsRaw) : (argsRaw ?? {});
      } catch {
        // If JSON is malformed, pass as-is so the tool/zod complains; we surface the error
        args = { $raw: argsRaw };
      }
      return { id, name, args };
    });
  }

  @Post("ask")
  async ask(@Req() req: AuthRequest, @Body() dto: AskDto, @Res() res: Response) {
    if (!dto.idempotencyKey) {
      return res.status(400).json({ message: "La clé d'idempotence est requise." });
    }

    // SSE setup
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Cache-Control", "no-cache");
    if (typeof (res as any).flushHeaders === "function") (res as any).flushHeaders();

    const key = dto.idempotencyKey;
    const { isFirst } = this.llmService.registerSseSubscriber(key, res);
    if (!isFirst) {
      this.llmService.sseBroadcast(key, { type: "info", data: "Reconnexion au flux en cours." });
      return;
    }

    const collectedObservations: string[] = [];

    try {
      const { llm, llmWithTools, tools } = this.llmService.prepareAgentExecutor({
        userIri: req.user.sub,
        ontologyIri: dto.ontologyIri,
        sessionId: dto.sessionId,
      });
      const decisionLlm = this.llmService.buildDecisionModel();

      // Broadcast tool schemas for visibility
      this.llmService.sseBroadcast(key, {
        type: "tools_schema",
        data: tools.map((t) => convertToOpenAITool(t)),
      });

      // Build system prompt with persistent results
      const buildSystemPrompt = () => {
        let prompt = `${SYSTEM_PROMPT_FR}${dto.ontologyIri ? ` \nContexte: l'ontologie active est <${dto.ontologyIri}>` : ""}`;
        const persistentResults = this.llmService.getPersistentResultsFor(
          req.user.sub,
          dto.ontologyIri,
          dto.sessionId
        );
        if (persistentResults && persistentResults.trim()) {
          prompt += `\n\n--- RESULTATS DES RECHERCHES PRECEDENTES ---\n${persistentResults}`;
        }
        return prompt;
      };

      // Announce system prompt
      const systemPrompt = buildSystemPrompt();
      this.llmService.sseBroadcast(key, { type: "system_prompt", data: systemPrompt });

      // Summarize long histories
      const summarizedHistory = await this.compressHistoryIfNeeded(llm, dto.history, key);

      // Initial messages
      const messages: BaseMessage[] = [
        new SystemMessage(systemPrompt),
        ...summarizedHistory,
        new HumanMessage(dto.question),
      ];
      const lastHumanIndex = messages.length - 1;

      let reruns = 0;
      let previousStepExecutedTools = false;

      for (let step = 0; step < MAX_STEPS; step++) {
        // One assistant step (no token streaming; broadcast single chunk)
        const ai = (await llmWithTools.invoke(messages)) as AIMessage;
        const finalText = (getText(ai) ?? "").trim();
        if (finalText) {
          this.llmService.sseBroadcast(key, { type: "chunk", data: finalText });
        }
        const aiNoTools = new AIMessage({ content: (ai as any).content });
        messages.push(aiNoTools);  // We add a copy without tool_calls for history

        // Handle tool calls (if any)
        const toolCalls = this.extractToolCalls(ai);
        if (toolCalls.length > 0) {
          const toolSysMessages: SystemMessage[] = [];
          for (const tc of toolCalls) {
            this.llmService.sseBroadcast(key, {
              type: "tool_call",
              data: { id: tc.id, name: tc.name, args: tc.args },
            });

            const tool = tools.find((t) => t.name === tc.name);
            if (!tool) {
              const msg = `Erreur: l'outil '${tc.name}' est introuvable.`;
              this.llmService.sseBroadcast(key, {
                type: "tool_result",
                data: { id: tc.id, name: tc.name, observation: msg },
              });
              toolSysMessages.push(
                new SystemMessage(`Résultat de l'outil '${tc.name}' (id ${tc.id}) : ${msg}`)
              );
              continue;
            }

            try {
              const observation = await tool.invoke(tc.args);
              const observationStr =
                typeof observation === "string" ? observation : JSON.stringify(observation);

              collectedObservations.push(observationStr);

              this.llmService.sseBroadcast(key, {
                type: "tool_result",
                data: { id: tc.id, name: tc.name, observation: observationStr },
              });

              // Use the tool output string as the SystemMessage content for the tool result
              toolSysMessages.push(
                new SystemMessage(`Résultat de l'outil '${tc.name}' (id ${tc.id}) : ${observationStr}`)
              );
            } catch (e) {
              const errMsg =
                e instanceof Error
                  ? `Erreur lors de l'exécution de l'outil: ${e.message}`
                  : "Erreur inconnue lors de l'exécution de l'outil.";
              this.llmService.sseBroadcast(key, {
                type: "tool_result",
                data: { id: tc.id, name: tc.name, observation: errMsg },
              });
              toolSysMessages.push(
                new SystemMessage(`Résultat de l'outil '${tc.name}' (id ${tc.id}) : ${errMsg}`)
              );
            }
          }

          messages.push(...toolSysMessages);

          // Update system prompt (memory might be enriched by tools)
          const updatedPrompt = buildSystemPrompt();
          messages[0] = new SystemMessage(updatedPrompt);
          this.llmService.sseBroadcast(key, { type: "system_prompt", data: updatedPrompt });

          // Nudge the assistant to produce a final synthesis, no tools
          messages.push(
            new SystemMessage(
              "Sur la base des résultats des outils, formule la réponse finale en 4 à 7 lignes, " +
                "ton naturel et pédagogique, sans ré-appeler d'outil. Si aucun résultat pertinent n'a été trouvé, dis-le."
            )
          );

          previousStepExecutedTools = true;
          continue;
        }

        // No tool calls this turn
        if (!previousStepExecutedTools) {
          // If the last turn did NOT execute tools, we stop and hand back to the user
          break;
        }

        // The previous turn executed tools; ask Decision model if one more step is needed
        const sinceLastUser = messages.slice(lastHumanIndex + 1);
        const doneCheck = await this.checkIfDoneWithDecisionModel(decisionLlm, dto.question, sinceLastUser);

        if (doneCheck.done || reruns >= MAX_DONE_RERUNS) {
          break;
        }

        reruns += 1;
        this.llmService.sseBroadcast(key, {
          type: "info",
          data: `L'agent poursuit la recherche (itération ${reruns}/${MAX_DONE_RERUNS}) : ${
            doneCheck.next ?? "étape supplémentaire"
          }`,
        });

        // Ask the model to do ONE more step, justify briefly, and call a tool only if useful
        messages.push(
          new SystemMessage(
            "Tu as indiqué ne pas avoir fini. Fais UNE étape supplémentaire maintenant. " +
              "Explique brièvement (1–2 phrases) pourquoi tu la fais, puis appelle l’outil approprié si utile. " +
              "Si tu as assez d'éléments, produis directement une synthèse finale concise. " +
              "Rappel: 3 étapes max."
          )
        );

        // Reset for the next step; we only loop again if that next step actually executes a tool
        previousStepExecutedTools = false;
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
    @Query("sessionId") sessionId?: string
  ) {
    let prompt = `${SYSTEM_PROMPT_FR}${ontologyIri ? ` \nContexte: l'ontologie active est <${ontologyIri}>` : ""}`;
    const persistentResults = this.llmService.getPersistentResultsFor(req.user.sub, ontologyIri, sessionId);
    if (persistentResults && persistentResults.trim()) {
      prompt += `\n\n--- RESULTATS DES RECHERCHES PRECEDENTES ---\n${persistentResults}`;
    }
    return { systemPrompt: prompt };
  }
}