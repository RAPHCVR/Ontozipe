import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    // Load environment variables from the repo root .env
    envDir: "..",
    server: { open: true },
    resolve: { alias: { "@": "/src" } },
});
