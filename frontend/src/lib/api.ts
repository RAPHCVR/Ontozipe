import { useAuth } from "../auth/AuthContext";
import { useCallback } from "react";

// hook retournant un fetch préconfiguré
export const useApi = () => {
    const { token, logout } = useAuth();

    return useCallback(
        async (input: string, init: RequestInit = {}) => {
            const headers = new Headers(init.headers);
            if (token) headers.set("Authorization", `Bearer ${token}`);

            const res = await fetch(input, { ...init, headers });

            // Token expiré ou manquant → logout + redirection login
            if (res.status === 401) {
                logout();
                window.location.href = "/login";
                return Promise.reject(new Error("401"));
            }
            if (res.status >= 400) throw new Error(`HTTP ${res.status}`);

            return res;
        },
        [token, logout]
    );
};