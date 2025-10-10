import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { LlmService } from "./llm.service";
import { LlmController } from "./llm.controller";
import { ChatHistoryService } from "./chat-history.service";

@Module({
    imports: [HttpModule],
    controllers: [LlmController],
    providers: [LlmService, ChatHistoryService],
    exports: [LlmService, ChatHistoryService],
})
export class LlmModule {}
