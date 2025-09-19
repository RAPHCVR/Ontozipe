import { useAuth } from "../auth/AuthContext";
import { useCallback } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

/**
 * hook retournant un fetch préconfiguré.
 * Il préfixe automatiquement les chemins relatifs (ex: "/ontology/projects") avec l'URL de base de l'API.
 */
export const useApi = () => {
    const { token, logout } = useAuth();

    return useCallback(
        async (input: string, init: RequestInit = {}) => {
            const headers = new Headers(init.headers);
            if (token) headers.set("Authorization", `Bearer ${token}`);

            // Détermine si l'URL est absolue ou relative, et construit l'URL finale.
            const isAbsolute = input.startsWith("http://") || input.startsWith("https://");
            const url = isAbsolute ? input : `${API_BASE_URL}${input.startsWith('/') ? '' : '/'}${input}`;

            const res = await fetch(url, { ...init, headers });

            // Token expiré ou manquant → logout + redirection login
            if (res.status === 401) {
                logout();
                window.location.href = "/login";
                // Rejette la promesse pour interrompre la chaîne de traitement dans le composant appelant.
                return Promise.reject(new Error("401 Unauthorized"));
            }
            if (res.status >= 400) {
                // Tente de récupérer un message d'erreur plus explicite du backend.
                const errorBody = await res.json().catch(() => ({ message: `Erreur HTTP ${res.status}` }));
                throw new Error(errorBody.message || `Erreur HTTP ${res.status}`);
            }

            return res;
        },
        [token, logout]
    );
};