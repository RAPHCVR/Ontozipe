import { useQuery } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { useLanguage } from "../language/LanguageContext";
import { useAuth } from "../auth/AuthContext";

type CommentSummaryInput = {
	individual: {
		id: string;
		label?: string;
		properties?: Array<{ predicate: string; value: string }>;
	};
	comments: Array<{
		body: string;
		replyTo?: string;
	}>;
};

export function useCommentSummary(input: CommentSummaryInput | null) {
	const api = useApi();
	const { language } = useLanguage();
	const { token } = useAuth();

	return useQuery({
		queryKey: ["comment-summary", input, language],
		enabled: Boolean(token) && Boolean(input),
		staleTime: 30 * 1000,
		queryFn: async () => {
			const res = await api("/llm/comment-summary", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...input,
					language,
				}),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message || "Unable to summarize comments");
			}
			const data = await res.json();
			return data.summary as string;
		},
	});
}
