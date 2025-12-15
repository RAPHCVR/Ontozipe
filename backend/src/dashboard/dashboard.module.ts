import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
    imports: [HttpModule],
    controllers: [DashboardController],
    providers: [DashboardService],
})
export class DashboardModule {}
