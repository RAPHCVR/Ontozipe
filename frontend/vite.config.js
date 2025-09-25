import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        open: true,
        proxy: {
            '/uploads': 'http://localhost:4000',
            '/ontology': 'http://localhost:4000' // adapte le port si besoin
        },
    },
    resolve: { alias: { "@": "/src" } },
});