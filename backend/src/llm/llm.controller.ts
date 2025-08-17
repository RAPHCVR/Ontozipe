import { Body, Controller, Req, UseGuards, Post, Res } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LlmService } from "./llm.service";

// ... DTOs et types ...
class AskDto {
    question!: string;
    ontologyIri?: string;
    history?: { role: "user" | "assistant" | "system"; content: string }[];
}

type AuthRequest = Request & {
    user: { sub: string; email?: string };
};


@Controller("llm")
@UseGuards(JwtAuthGuard)
export class LlmController {
    constructor(private readonly llm: LlmService) {}

    @Post("ask")
    ask(
        @Req() req: AuthRequest,
        @Body() dto: AskDto,
        @Res() res: Response
    ) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Cache-Control", "no-cache");
        res.flushHeaders(); // Envoie les en-têtes immédiatement

        const stream$ = this.llm.askStream({
            userIri: req.user.sub,
            question: dto.question,
            ontologyIri: dto.ontologyIri,
            history: dto.history,
        });

        stream$.subscribe({
            next: (event) => {
                const jsonPayload = JSON.stringify(event.data);

                res.write(`data: ${jsonPayload}\n\n`);
            },
            error: (err) => {
                console.error("Erreur dans le stream LLM:", err);
                const errorPayload = JSON.stringify({ error: "Une erreur est survenue sur le serveur" });
                res.write(`data: ${errorPayload}\n\n`);
                res.end();
            },
            complete: () => {
                res.end();
            },
        });
    }
}