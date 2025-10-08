import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";

type Params = {
	page: number;
	pageSize: number;
	search?: string;
	onlyUnverified?: boolean;
	role?: string;
};

type AdminUser = {
	iri: string;
	name: string | null;
	email: string | null;
	avatar: string | null;
	isVerified: boolean;
	roles: string[];
};

type AdminUsersResponse = {
	items: AdminUser[];
	page: number;
	pageSize: number;
	total: number;
};

export const useAdminUsers = (params: Params) => {
	const api = useApi();
	const { token } = useAuth();

	return useQuery<AdminUsersResponse, Error>({
		queryKey: ["admin", "users", token, params],
		queryFn: async () => {
			const qs = new URLSearchParams();
			qs.set("page", String(params.page));
			qs.set("pageSize", String(params.pageSize));
			if (params.search && params.search.trim().length > 0) {
				qs.set("search", params.search.trim());
			}
			if (params.onlyUnverified) {
				qs.set("onlyUnverified", "true");
			}
			if (params.role) {
				qs.set("role", params.role);
			}
			const res = await api(`/auth/admin/users?${qs.toString()}`);
			return (await res.json()) as AdminUsersResponse;
		},
	});
};

export type { AdminUser, AdminUsersResponse };
