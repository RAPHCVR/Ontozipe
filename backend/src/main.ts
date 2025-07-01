import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as dotenv from "dotenv";

dotenv.config();

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);

	// ⬇⬇⬇  relevons la limite à 2 Mio (ou plus si besoin)
	app.use(json({ limit: "2mb" }));
	app.use(urlencoded({ limit: "2mb", extended: true }));

	app.enableCors();
	await app.listen(4000);
}
bootstrap().catch((err) => {
	console.error("Erreur au démarrage du backend", err);
	process.exit(1);
});
