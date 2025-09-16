import { useAuth } from "../auth/AuthContext";

// Base URL helpers

export const withBase = (path: string) => {
	const base = import.meta.env.VITE_API_BASE_URL || "";

	// Ensure exactly one slash between base and path
	const leading = path.startsWith("/") ? "" : "/";
	return `${base}${leading}${path}`;
};

// hook retournant un fetch préconfiguré
export const useApi = () => {
	const { token, logout } = useAuth();

	return async (input: string, init: RequestInit = {}) => {
		const url = withBase(input);
		const headers = new Headers(init.headers);
		if (token) headers.set("Authorization", `Bearer ${token}`);

		const res = await fetch(url, { ...init, headers });

		// Token expiré ou manquant → logout + redirection login
		if (res.status === 401) {
			logout();
			window.location.href = "/login";
			return Promise.reject(new Error("401"));
		}
		if (res.status >= 400) throw new Error(`HTTP ${res.status}`);

		return res;
	};
};
