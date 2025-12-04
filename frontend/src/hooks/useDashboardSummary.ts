import { useQuery } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { useLanguage } from "../language/LanguageContext";
import { useAuth } from "../auth/AuthContext";

type SummaryInput = {
	section: string;
	payload: unknown;
};

export function useDashboardSummary(input: SummaryInput | null) {
	const api = useApi();
	const { language } = useLanguage();
	const { token } = useAuth();

	return useQuery({
		queryKey: ["dashboard-summary", input?.section, input?.payload, language],
		enabled: Boolean(token) && Boolean(input),
		staleTime: 30 * 1000,
		queryFn: async () => {
			const res = await api("/llm/dashboard-summary", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					section: input?.section,
					payload: input?.payload,
					language,
				}),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message || "Unable to summarize dashboard");
			}
			const data = await res.json();
			return data.summary as string;
		},
	});
}
