import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as dotenv from "dotenv";
import { ValidationPipe } from "@nestjs/common";
import { join } from "path";

dotenv.config();

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

    // Expose le dossier uploads en statique
    app.useStaticAssets(join(__dirname, "..", "uploads"), {
        prefix: "/uploads/",
    });

    await app.listen(4000);
}
bootstrap().catch((err) => {
    console.error("Erreur au démarrage du backend", err);
    process.exit(1);
});