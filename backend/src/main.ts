import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables from the nearest .env (root or backend)
(() => {
	const candidates = [
		// If running via `nest start` in backend dir
		path.resolve(process.cwd(), ".env"),
		path.resolve(process.cwd(), "../.env"),
		// If running compiled code from backend/dist
		path.resolve(__dirname, "../../.env"),
		path.resolve(__dirname, "../.env"),
		// Fallback: project root one level up
		path.resolve(__dirname, "../../../.env"),
	];
	for (const p of candidates) {
		if (fs.existsSync(p)) {
			dotenv.config({ path: p });
			break;
		}
	}
	// Also respect any real environment variables already set (Docker env_file)
	dotenv.config();
})();

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);

	// ⬇⬇⬇  relevons la limite à 2 Mio (ou plus si besoin)
	app.use(json({ limit: "2mb" }));
	app.use(urlencoded({ limit: "2mb", extended: true }));

	app.enableCors();
	const port = Number(process.env.BACKEND_PORT || 4000);
	await app.listen(port);
}
bootstrap().catch((err) => {
	console.error("Erreur au démarrage du backend", err);
	process.exit(1);
});
