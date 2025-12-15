import { Module } from "@nestjs/common";
import { OntologyModule } from "./ontology/ontology.module";
import { AuthModule } from "./auth/auth.module";
import { HttpModule } from "@nestjs/axios";
import * as http from "http";
import * as https from "https";
import { LlmModule } from "./llm/llm.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { DashboardModule } from "./dashboard/dashboard.module";

@Module({
	imports: [
		HttpModule.registerAsync({
			useFactory: () => ({
				timeout: 10000,
				httpAgent: new http.Agent({ keepAlive: false }),
				httpsAgent: new https.Agent({ keepAlive: false }),
			}),
		}),
		AuthModule,
		OntologyModule,
		LlmModule,
		DashboardModule,
		NotificationsModule,
	],
})
export class AppModule {}
