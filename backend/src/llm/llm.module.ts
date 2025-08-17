import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { LlmService } from "./llm.service";
import { LlmController } from "./llm.controller";

@Module({
    imports: [HttpModule],
    controllers: [LlmController],
    providers: [LlmService],
    exports: [LlmService],
})
export class LlmModule {}