import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootEnvDir = resolve(__dirname, "..");

export default defineConfig({
	envDir: rootEnvDir,
	plugins: [react(), tailwindcss()],
	server: {
		open: true,
		proxy: {
			"/uploads": "http://localhost:4000",
			"/ontology": "http://localhost:4000", // adapte le port si besoin
		},
	},
	resolve: { alias: { "@": resolve(__dirname, "src") } },
});
