import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";

@Module({
	imports: [HttpModule],
	providers: [NotificationsService],
	controllers: [NotificationsController],
	exports: [NotificationsService],
})
export class NotificationsModule {}
