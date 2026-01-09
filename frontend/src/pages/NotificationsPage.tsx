import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { useTranslation } from "../language/useTranslation";
import {
	useNotificationActions,
	useNotifications,
	useUnreadCount,
	type NotificationItem,
} from "../hooks/useNotifications";

export default function NotificationsPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [page, setPage] = useState(1);
	const [pageSize] = useState(10);
	const [status, setStatus] = useState<"all" | "unread">("all");
	const [scope, setScope] = useState<"personal" | "group">("personal");

	const notificationsQuery = useNotifications({
		status,
		page,
		pageSize,
		scope,
	});
	const unreadPersonal = useUnreadCount("personal");
	const unreadGroup = useUnreadCount("group");
	const { markAllAsRead, deleteNotification } = useNotificationActions();
	const [pendingDelete, setPendingDelete] = useState<NotificationItem | null>(
		null
	);

	useEffect(() => {
		setPage(1);
	}, [status, scope]);

	const data = notificationsQuery.data;
	const items = data?.items ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	return (
		<div className="app-container py-6 space-y-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold">
						{t("notifications.title")}
					</h1>
					<p className="text-gray-500 dark:text-gray-400">
						{t("notifications.subtitle", {
							count:
								scope === "group"
									? unreadGroup.data?.unreadCount ?? 0
									: unreadPersonal.data?.unreadCount ?? 0,
						})}
					</p>
				</div>
				<button
					type="button"
					className="btn-secondary"
					disabled={markAllAsRead.isPending}
					onClick={() => markAllAsRead.mutate(scope)}>
					{markAllAsRead.isPending
						? t("notifications.actions.markingAll")
						: t("notifications.actions.markAllRead")}
				</button>
			</header>

			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={() => setStatus("all")}
					className={`chip ${status === "all" ? "is-active" : ""}`}>
					{t("notifications.filters.all")}
				</button>
				<button
					type="button"
					onClick={() => setStatus("unread")}
					className={`chip ${status === "unread" ? "is-active" : ""}`}>
					{t("notifications.filters.unread")}
				</button>
			</div>

			<div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={() => setScope("personal")}
					className={`chip ${scope === "personal" ? "is-active" : ""}`}>
					{t("notifications.scope.personal")}{" "}
					{(unreadPersonal.data?.unreadCount ?? 0) > 0 && (
						<span className="ml-1 text-xs font-semibold">
							{unreadPersonal.data!.unreadCount}
						</span>
					)}
				</button>
				<button
					type="button"
					onClick={() => setScope("group")}
					className={`chip ${scope === "group" ? "is-active" : ""}`}>
					{t("notifications.scope.group")}{" "}
					{(unreadGroup.data?.unreadCount ?? 0) > 0 && (
						<span className="ml-1 text-xs font-semibold">
							{unreadGroup.data!.unreadCount}
						</span>
					)}
				</button>
			</div>

			<section className="space-y-3">
				{notificationsQuery.isLoading && (
					<div className="page-state">
						<div className="page-state__spinner" aria-hidden="true" />
						<p className="page-state__text">
							{t("notifications.loading")}
						</p>
					</div>
				)}

				{!notificationsQuery.isLoading && items.length === 0 && (
					<div className="page-state">
						<p className="page-state__text">
							{t("notifications.empty")}
						</p>
					</div>
				)}

				{items.map((item) => (
					<NotificationRow
						key={item.iri}
					item={item}
					onAskDelete={() => setPendingDelete(item)}
					onOpen={(target) => {
						if (target) navigate(target);
					}}
				/>
			))}
			</section>

			{totalPages > 1 && (
				<div className="flex items-center gap-4">
					<button
						className="btn-secondary"
						disabled={page <= 1}
						onClick={() => setPage((p) => Math.max(1, p - 1))}>
						{t("common.pagination.previous")}
					</button>
					<span className="text-sm text-gray-500">
						{t("notifications.pagination", { page, totalPages })}
					</span>
					<button
						className="btn-secondary"
						disabled={page >= totalPages}
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
						{t("common.pagination.next")}
					</button>
				</div>
			)}

			{pendingDelete && (
				<ConfirmDeleteModal
					item={pendingDelete}
					onCancel={() => setPendingDelete(null)}
					onConfirm={() => {
						setPendingDelete(null);
						deleteNotification.mutate(pendingDelete.iri);
					}}
				/>
			)}
		</div>
	);
}

function NotificationRow({
	item,
	onOpen,
	onAskDelete,
}: {
	item: NotificationItem;
	onOpen: (target?: string) => void;
	onAskDelete: () => void;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { markAsRead } = useNotificationActions();
	const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
		typeof document !== "undefined"
			? document.documentElement.classList.contains("dark") ||
			  document.documentElement.dataset.theme === "dark"
			: false
	);

	const isUnread = !item.isRead;
	const createdAgo = useMemo(
		() => dayjs(item.createdAt).fromNow(),
		[item.createdAt]
	);

	useEffect(() => {
		if (typeof document === "undefined") return;
		const detect = () =>
			document.documentElement.classList.contains("dark") ||
			document.documentElement.dataset.theme === "dark";
		const observer = new MutationObserver(() => setIsDarkMode(detect()));
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "data-theme"],
		});
		return () => observer.disconnect();
	}, []);

	const handleOpen = () => {
		if (item.link) {
			onOpen(item.link);
		}
		markAsRead.mutate(item.iri);
	};

	const handleDelete = () => {
		const confirmed = window.confirm(t("notifications.actions.confirmDelete"));
		if (!confirmed) return;
		deleteNotification.mutate(item.iri);
	};

	const cardStyle = (() => {
		if (isUnread) {
			return isDarkMode
				? { backgroundColor: "#1f2937", borderColor: "#334155" }
				: { backgroundColor: "#eef2ff", borderColor: "#c7d2fe" };
		}
		return isDarkMode
			? { backgroundColor: "#1f2937", borderColor: "#334155" }
			: { backgroundColor: "#ffffff", borderColor: "#e5e7eb" };
	})();

	return (
		<article
			style={cardStyle}
			className="flex items-start gap-3 p-4 rounded-lg border shadow-sm transition-colors">
			<div className="pt-1">
				<span
					className={`w-3 h-3 rounded-full block ${
						isUnread ? "bg-indigo-500" : "bg-gray-300"
					}`}
					aria-label={
						isUnread
							? t("notifications.status.unread")
							: t("notifications.status.read")
					}
				/>
			</div>
			<div className="flex-1 space-y-1">
				<div
					className={`flex flex-wrap items-center gap-2 text-sm ${
						isDarkMode ? "text-gray-300" : "text-gray-500"
					}`}>
					{item.actor?.name || item.actor?.iri ? (
						<span
							className={`font-medium ${
								isDarkMode ? "text-gray-100" : "text-gray-800"
							}`}>
							{item.actor?.name || item.actor?.iri}
						</span>
					) : null}
					{item.target?.label ? (
						<span className={isDarkMode ? "text-gray-300" : "text-gray-500"}>
							{t("notifications.target")} {item.target.label}
						</span>
					) : null}
					<span aria-hidden="true">•</span>
					<span>{createdAgo}</span>
				</div>
				<p
					className={`leading-snug ${
						isDarkMode ? "text-gray-100" : "text-gray-800"
					}`}>
					{item.content}
				</p>
				<div className="flex items-center gap-3 text-sm">
					<button
						type="button"
						className={
							isDarkMode
								? "text-indigo-300 hover:text-indigo-200 cursor-pointer"
								: "text-indigo-600 hover:text-indigo-800 cursor-pointer"
						}
						onClick={handleOpen}>
						{item.link
							? t("notifications.actions.view")
							: t("notifications.actions.markRead")}
					</button>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<button
					type="button"
					className={
						isDarkMode
							? "text-gray-400 hover:text-gray-200 cursor-pointer"
							: "text-gray-400 hover:text-gray-600 cursor-pointer"
					}
					onClick={onAskDelete}
					title={t("notifications.actions.delete")}>
					⋯
				</button>
			</div>
		</article>
	);
}

function ConfirmDeleteModal({
	item,
	onCancel,
	onConfirm,
}: {
	item: NotificationItem;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	const { t } = useTranslation();
	const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
		typeof document !== "undefined"
			? document.documentElement.classList.contains("dark") ||
			  document.documentElement.dataset.theme === "dark"
			: false
	);

	useEffect(() => {
		if (typeof document === "undefined") return;
		const detect = () =>
			document.documentElement.classList.contains("dark") ||
			document.documentElement.dataset.theme === "dark";
		const observer = new MutationObserver(() => setIsDarkMode(detect()));
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "data-theme"],
		});
		return () => observer.disconnect();
	}, []);

	const panelStyle = isDarkMode
		? { backgroundColor: "#1f2937", color: "#e5e7eb", borderColor: "#374151" }
		: { backgroundColor: "#ffffff", color: "#111827", borderColor: "#e5e7eb" };

	return (
		<div className="fixed inset-0 z-40 flex items-center justify-center">
			<div className="absolute inset-0 bg-black/40" onClick={onCancel} />
			<div
				className="relative w-full max-w-md rounded-lg border shadow-lg px-6 py-5 space-y-4"
				style={panelStyle}>
				<h3 className="text-lg font-semibold">
					{t("notifications.actions.delete")}
				</h3>
				<p className="text-sm">
					{t("notifications.actions.confirmDelete")}
				</p>
				<p className="text-sm opacity-80 line-clamp-2">{item.content}</p>
				<div className="flex justify-end gap-3 pt-2">
					<button
						type="button"
						className="btn-secondary"
						onClick={onCancel}>
						{t("common.cancel")}
					</button>
					<button
						type="button"
						className="btn-primary"
						onClick={onConfirm}>
						{t("common.confirm")}
					</button>
				</div>
			</div>
		</div>
	);
}
