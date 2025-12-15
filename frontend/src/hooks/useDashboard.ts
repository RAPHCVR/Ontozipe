import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";

export type ScopeType = "all" | "ontology" | "organization" | "group";

export type DashboardFilters = {
	start?: string;
	end?: string;
	scopeType?: ScopeType;
	scopeId?: string;
};

export type DashboardResponse = {
	filters: {
		start?: string;
		end?: string;
		scopeType: ScopeType;
		scopeId?: string;
	};
	platform: { data: any };
	governance: { data: any };
	myActivity: { data: any };
	comments: { data: any };
	meta?: { accessibleOntologies?: number; accessibleGroups?: number; accessibleOrganizations?: number };
};

const buildQueryString = (filters: DashboardFilters) => {
	const params = new URLSearchParams();
	if (filters.start) params.set("start", filters.start);
	if (filters.end) params.set("end", filters.end);
	if (filters.scopeType) params.set("scopeType", filters.scopeType);
	if (filters.scopeId) params.set("scopeId", filters.scopeId);
	return params.toString();
};

export function useDashboard(filters: DashboardFilters) {
	const { token } = useAuth();
	const api = useApi();

	return useQuery({
		queryKey: ["dashboard", filters],
		enabled: Boolean(token),
		staleTime: 15 * 1000,
		queryFn: async (): Promise<DashboardResponse> => {
			const qs = buildQueryString(filters);
			const res = await api(`/dashboard${qs ? `?${qs}` : ""}`);
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message || "Impossible de charger le dashboard");
			}
			return res.json();
		},
	});
}
