import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";
import { NestExpressApplication } from "@nestjs/platform-express";
import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { ValidationPipe } from "@nestjs/common";

const envSources = [
    { path: resolve(__dirname, "../../.env"), override: false },
    { path: resolve(__dirname, "../.env"), override: true },
];

for (const { path, override } of envSources) {
    if (existsSync(path)) loadEnv({ path, override });
}

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.use(json({ limit: "2mb" }));
    app.use(urlencoded({ limit: "2mb", extended: true }));

    // Active la validation automatique pour tous les DTOs
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true, // Ignore les propriétés inconnues
        transform: true, // Transforme les payloads en instances de DTO
    }));

    app.enableCors();
    await app.listen(4000);
}
bootstrap().catch((err) => {
    console.error("Erreur au démarrage du backend", err);
    process.exit(1);
});
