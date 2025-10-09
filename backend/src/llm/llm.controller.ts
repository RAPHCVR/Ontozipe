import { Body, Controller, Req, UseGuards, Post, Res, Get, Query } from "@nestjs/common";
import { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LlmService } from "./llm.service";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { SYSTEM_PROMPT_FR } from "./prompt";
import { AskDto, HistoryItemDto } from "./llm.dto";
import { getText } from "./llm.utils";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import type { Runnable } from "@langchain/core/runnables";

// =======================
//   CONSTANT PARAMETERS
// =======================
const HISTORY_SUMMARY_TRIGGER = 14;
const HISTORY_SUMMARY_TAKE_LAST = 10;
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

  // Utilise le "decision model" uniquement pour le résumé d'historique
  private async compressHistoryIfNeeded(
    summarizer: any,
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

  // Lit tool_calls sur AIMessage ou AIMessageChunk
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

  // Extrait du texte d'un chunk
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

  // Stream d'une étape (tokens "chunk"), retourne le chunk final concaténé + texte agrégé
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

    try {
      const { llm, llmWithTools, tools } = this.llmService.prepareAgentExecutor({
        userIri: req.user.sub,
        ontologyIri: dto.ontologyIri,
        sessionId: dto.sessionId,
      });
      // Modèle "decision" réutilisé uniquement comme résumeur
      const summarizer = this.llmService.buildDecisionModel();

      // Tools schema
      this.llmService.sseBroadcast(key, {
        type: "tools_schema",
        data: tools.map((t) => convertToOpenAITool(t)),
      });

      // Build system prompt
      const buildSystemPrompt = () => {
        let prompt = `${SYSTEM_PROMPT_FR}${
          dto.ontologyIri ? `\nContexte: l'ontologie active est <${dto.ontologyIri}>` : ""
        }`;
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

      const systemPrompt = buildSystemPrompt();
      this.llmService.sseBroadcast(key, { type: "system_prompt", data: systemPrompt });

      // Résumé d'historique (si nécessaire) via le "summarizer"
      const summarizedHistory = await this.compressHistoryIfNeeded(summarizer, dto.history, key);

      // Messages initiaux
      const messages: BaseMessage[] = [
        new SystemMessage(systemPrompt),
        ...summarizedHistory,
        new HumanMessage(dto.question),
      ];

      for (let step = 0; step < MAX_STEPS; step++) {
        // Ajouter un saut de ligne avant chaque nouveau tour (sauf le premier)
        if (step > 0) {
          this.llmService.sseBroadcast(key, {
            type: "chunk",
            data: "\n",
          });
        }

        // Indiquer le début d'étape (pas de nouveau type d'événement)
        this.llmService.sseBroadcast(key, {
          type: "info",
          data: `--- Étape ${step + 1}/${MAX_STEPS} ---`,
        });

        // 1) Stream de la réponse assistant
        const { finalChunk, finalText } = await this.streamOneAssistantTurn(
          llmWithTools,
          messages,
          key
        );

        // Conserver la trace assistant (sans tool_calls) avec le texte streamé
        messages.push(new AIMessage({ content: finalText }));

        // 2) Tool calls éventuels
        const toolCalls = finalChunk ? this.extractToolCalls(finalChunk) : [];

        if (toolCalls.length === 0) {
          // Pas d'outil appelé => fin
          break;
        }

        // Exécuter chaque tool et pousser leurs résultats sous forme de SystemMessage
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

            this.llmService.sseBroadcast(key, {
              type: "tool_result",
              data: { id: tc.id, name: tc.name, observation: observationStr },
            });

            toolSysMessages.push(
              new SystemMessage(
                `Résultat de l'outil '${tc.name}' (id ${tc.id}) : ${observationStr}`
              )
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

        // 3) Mise à jour du system prompt (mémoire enrichie par les outils)
        const updatedPrompt = buildSystemPrompt();
        messages[0] = new SystemMessage(updatedPrompt);
        this.llmService.sseBroadcast(key, { type: "system_prompt", data: updatedPrompt });

        // 4) On relance automatiquement une nouvelle étape.
        //    La boucle continue tant qu'il y a eu au moins un tool exécuté dans l'étape courante
        //    (sinon, on aurait break juste au-dessus).
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
    let prompt = `${SYSTEM_PROMPT_FR}${ontologyIri ? `\nContexte: l'ontologie active est <${ontologyIri}>` : ""}`;
    const persistentResults = this.llmService.getPersistentResultsFor(req.user.sub, ontologyIri, sessionId);
    if (persistentResults && persistentResults.trim()) {
      prompt += `\n\n--- RESULTATS DES RECHERCHES PRECEDENTES ---\n${persistentResults}`;
    }
    return { systemPrompt: prompt };
  }
}