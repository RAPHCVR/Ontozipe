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
	server: { open: true },
	resolve: { alias: { "@": resolve(__dirname, "src") } },
	server: {
    host: true,
    allowedHosts: [
      'ontology.hugopereira.fr'
    ]
  }
});
