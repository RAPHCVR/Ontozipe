import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
export const useAdminUsers = (params) => {
    const api = useApi();
    const { token } = useAuth();
    return useQuery({
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
            return (await res.json());
        },
    });
};
