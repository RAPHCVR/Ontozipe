import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";

export type NotificationItem = {
	iri: string;
	content: string;
	createdAt: string;
	isRead: boolean;
	actor?: { iri: string; name?: string };
	target?: { iri: string; label?: string };
	verb?: string;
	link?: string | null;
	scope?: "personal" | "group";
};

type ListResponse = {
	items: NotificationItem[];
	total: number;
	unreadCount: number;
	limit: number;
	offset: number;
};

type ListParams = {
	status?: "all" | "unread";
	page?: number;
	pageSize?: number;
	verb?: string;
	category?: string;
	scope?: "personal" | "group";
};

export const useNotifications = (params: ListParams) => {
	const api = useApi();
	const { token } = useAuth();
	const page = Math.max(1, params.page || 1);
	const limit = Math.max(1, Math.min(100, params.pageSize || 20));
	const offset = (page - 1) * limit;
	return useQuery<ListResponse, Error>({
		queryKey: ["notifications", token, params],
		enabled: Boolean(token),
		queryFn: async () => {
			const qs = new URLSearchParams();
			qs.set("limit", String(limit));
			qs.set("offset", String(offset));
			if (params.status) qs.set("status", params.status);
			if (params.verb) qs.set("verb", params.verb);
			if (params.category && params.category !== "all") {
				qs.set("category", params.category);
			}
			if (params.scope && params.scope !== "all") {
				qs.set("scope", params.scope);
			}
			const res = await api(`/notifications?${qs.toString()}`);
			return (await res.json()) as ListResponse;
		},
	});
};

export const useNotificationsPreview = (limit = 5) => {
	const api = useApi();
	const { token } = useAuth();
	return useQuery<ListResponse, Error>({
		queryKey: ["notifications", "preview", token, limit],
		enabled: Boolean(token),
		staleTime: 10 * 1000,
		queryFn: async () => {
			const qs = new URLSearchParams();
			qs.set("limit", String(limit));
			qs.set("scope", "personal");
			const res = await api(`/notifications?${qs.toString()}`);
			return (await res.json()) as ListResponse;
		},
	});
};

export const useUnreadCount = (scope?: "personal" | "group") => {
	const api = useApi();
	const { token } = useAuth();
	return useQuery<{ unreadCount: number }, Error>({
		queryKey: ["notifications", "unreadCount", token, scope],
		enabled: Boolean(token),
		staleTime: 10 * 1000,
		queryFn: async () => {
			const qs = new URLSearchParams();
			if (scope && scope !== "all") qs.set("scope", scope);
			const res = await api(`/notifications/unread/count?${qs.toString()}`);
			return (await res.json()) as { unreadCount: number };
		},
	});
};

export const useNotificationActions = () => {
	const api = useApi();
	const client = useQueryClient();

	const invalidate = () => {
		client.invalidateQueries({ queryKey: ["notifications"] });
		client.invalidateQueries({ queryKey: ["notifications", "unreadCount"] });
		client.invalidateQueries({ queryKey: ["notifications", "preview"] });
	};

	const markAsRead = useMutation({
		mutationFn: async (iri: string) => {
			const encoded = encodeURIComponent(iri);
			await api(`/notifications/${encoded}/read`, { method: "POST" });
		},
		onSuccess: invalidate,
	});

	const markAllAsRead = useMutation({
		mutationFn: async (scope?: "personal" | "group") => {
			const qs = new URLSearchParams();
			if (scope && scope !== "all") qs.set("scope", scope);
			await api(`/notifications/read-all?${qs.toString()}`, { method: "POST" });
		},
		onSuccess: invalidate,
	});

	const deleteNotification = useMutation({
		mutationFn: async (iri: string) => {
			const encoded = encodeURIComponent(iri);
			await api(`/notifications/${encoded}`, { method: "DELETE" });
		},
		onSuccess: invalidate,
	});

	return { markAsRead, markAllAsRead, deleteNotification };
};
