import { Module } from "@nestjs/common";
import { OntologyModule } from "./ontology/ontology.module";
import { AuthModule } from "./auth/auth.module";
import { HttpModule } from "@nestjs/axios";
import * as http from "http";
import * as https from "https";

@Module({
	imports: [
		HttpModule.registerAsync({
			useFactory: () => ({
				timeout: 10000,
				httpAgent: new http.Agent({ keepAlive: false }), // <—
				httpsAgent: new https.Agent({ keepAlive: false }), // <—
			}),
		}),
		AuthModule,
		OntologyModule,
	],
})
export class AppModule {}
