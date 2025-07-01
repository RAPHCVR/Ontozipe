export function decodeJwt<T = any>(token: string): T | null {
	try {
		const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
		const json = decodeURIComponent(
			atob(base64)
				.split("")
				.map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
				.join("")
		);
		return JSON.parse(json);
	} catch {
		return null;
	}
}
