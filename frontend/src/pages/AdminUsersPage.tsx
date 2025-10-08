import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminUsers, AdminUser } from "../hooks/useAdminUsers";
import { useApi } from "../lib/api";
import SimpleModal from "../components/SimpleModal";
import { useTranslation } from "../language/useTranslation";
import type { TranslationKey } from "../language/messages";

const CORE = "http://example.org/core#";

const ROLE_OPTIONS = [
	{ value: `${CORE}SuperAdminRole`, labelKey: "adminUsers.roles.superAdmin" },
	{ value: `${CORE}AdminRole`, labelKey: "adminUsers.roles.admin" },
	{ value: `${CORE}RegularRole`, labelKey: "adminUsers.roles.user" },
] as const;

const ROLE_FILTER_OPTIONS = [
	{ value: "", labelKey: "adminUsers.roles.all" },
	...ROLE_OPTIONS,
] as const;

const EMPTY_PLACEHOLDER = "-";

type FeedbackMessage = {
	key?: TranslationKey;
	values?: Record<string, string | number>;
	fallback?: string;
	useFallback?: boolean;
};

export default function AdminUsersPage() {
	const { t } = useTranslation();
	const [page, setPage] = useState<number>(1);
	const [pageSize, setPageSize] = useState<number>(10);
	const [searchInput, setSearchInput] = useState<string>("");
	const [search, setSearch] = useState<string>("");
	const [onlyUnverified, setOnlyUnverified] = useState<boolean>(false);
	const [roleFilter, setRoleFilter] = useState<string>("");

	const query = useAdminUsers({
		page,
		pageSize,
		search,
		onlyUnverified,
		role: roleFilter || undefined,
	});
	const data = query.data;
	const api = useApi();
	const queryClient = useQueryClient();

	const [editing, setEditing] = useState<AdminUser | null>(null);
	const [formName, setFormName] = useState<string>("");
	const [formEmail, setFormEmail] = useState<string>("");
	const [formAvatar, setFormAvatar] = useState<string>("");
	const [formVerified, setFormVerified] = useState<boolean>(false);
	const [formRoles, setFormRoles] = useState<string[]>([]);
	const [saving, setSaving] = useState<boolean>(false);
	const [errorMessage, setErrorMessage] = useState<FeedbackMessage | null>(null);
	const [successMessage, setSuccessMessage] = useState<FeedbackMessage | null>(null);

	const toFeedbackMessage = useCallback(
		(key: TranslationKey, fallback?: string, values?: Record<string, string | number>): FeedbackMessage => {
			const defaultValue = t(key, values);
			const cleanedFallback = fallback?.trim();
			return {
				key,
				values,
				fallback: cleanedFallback,
				useFallback: Boolean(cleanedFallback && cleanedFallback !== defaultValue),
			};
		},
		[t]
	);

	const resolveFeedbackMessage = useCallback(
		(message: FeedbackMessage | null) => {
			if (!message) return null;
			if (message.useFallback && message.fallback) return message.fallback;
			if (message.key) return t(message.key, message.values);
			if (message.fallback) return message.fallback;
			return null;
		},
		[t]
	);

	const resetStatus = useCallback(() => {
		setErrorMessage(null);
		setSuccessMessage(null);
	}, []);

	useEffect(() => {
		if (!editing) return;
		resetStatus();
		setFormName(editing.name ?? "");
		setFormEmail(editing.email ?? "");
		setFormAvatar(editing.avatar ?? "");
		setFormVerified(Boolean(editing.isVerified));
		setFormRoles(editing.roles ?? []);
	}, [editing, resetStatus]);

	useEffect(() => {
		if (!errorMessage) return;
		const timer = window.setTimeout(() => setErrorMessage(null), 6000);
		return () => window.clearTimeout(timer);
	}, [errorMessage]);

	useEffect(() => {
		if (!successMessage) return;
		const timer = window.setTimeout(() => setSuccessMessage(null), 4000);
		return () => window.clearTimeout(timer);
	}, [successMessage]);

	const totalUsers = data?.total ?? 0;
	const totalPages = useMemo(() => {
		if (!data) return 1;
		return Math.max(1, Math.ceil(data.total / data.pageSize));
	}, [data]);

	const tableRows: AdminUser[] = data?.items ?? [];

	const filteredRows = useMemo(() => {
		if (!roleFilter) return tableRows;
		return tableRows.filter((user) => user.roles.includes(roleFilter));
	}, [tableRows, roleFilter]);

	const displayRows = filteredRows;
	const displayTotal = roleFilter ? filteredRows.length : totalUsers;

	const roleFilterOptions = useMemo(
		() =>
			ROLE_FILTER_OPTIONS.map((option) => ({
				value: option.value,
				label: t(option.labelKey),
			})),
		[t]
	);

	const roleLabelMap = useMemo(() => {
		return new Map<string, string>(ROLE_OPTIONS.map((option) => [option.value, t(option.labelKey)]));
	}, [t]);

	const formatRole = useCallback(
		(role: string) => {
			const known = roleLabelMap.get(role);
			if (known) return known;
			const parts = role.split(/[#/]/);
			return parts[parts.length - 1] || role;
		},
		[roleLabelMap]
	);

	const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		resetStatus();
		setPage(1);
		setSearch(searchInput.trim());
	};

	const handleOpenEditor = (user: AdminUser) => {
		resetStatus();
		setEditing(user);
	};

	const handleSave = async () => {
		if (!editing) return;
		resetStatus();
		setSaving(true);
		try {
			const payload: Record<string, unknown> = {
				name: formName.trim() || null,
				email: formEmail.trim() || null,
				avatar: formAvatar.trim() || null,
				isVerified: formVerified,
				roles: formRoles,
			};
			const res = await api(
				`/auth/admin/users/${encodeURIComponent(editing.iri)}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				}
			);
			if (!res.ok) {
				const body = await res.json().catch(() => ({
					message: t("adminUsers.messages.updateError"),
				}));
				throw new Error(body.message || t("adminUsers.messages.updateError"));
			}
			setSuccessMessage(toFeedbackMessage("adminUsers.messages.updateSuccess"));
			setEditing(null);
			await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
		} catch (error) {
			const fallback = error instanceof Error ? error.message : undefined;
			setErrorMessage(toFeedbackMessage("adminUsers.messages.saveError", fallback));
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (user: AdminUser) => {
		resetStatus();
		const defaultTarget = t("adminUsers.messages.deleteDefaultTarget");
		const target = user.email?.trim() || user.name?.trim() || defaultTarget;
		const confirmDelete = window.confirm(
			t("adminUsers.messages.deleteConfirm", { target })
		);
		if (!confirmDelete) return;
		try {
			const res = await api(
				`/auth/admin/users/${encodeURIComponent(user.iri)}`,
				{
					method: "DELETE",
				}
			);
			if (!res.ok) {
				const body = await res.json().catch(() => ({
					message: t("adminUsers.messages.deleteError"),
				}));
				throw new Error(body.message || t("adminUsers.messages.deleteError"));
			}
			setSuccessMessage(toFeedbackMessage("adminUsers.messages.deleteSuccess"));
			await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
		} catch (error) {
			const fallback = error instanceof Error ? error.message : undefined;
			setErrorMessage(toFeedbackMessage("adminUsers.messages.removeError", fallback));
		}
	};

	const toggleRole = (role: string) => {
		setFormRoles((prev) =>
			prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
		);
	};

	const userCountLabel =
		displayTotal === 1 ? t("adminUsers.userSingular") : t("adminUsers.userPlural");
	const listSummary = t("adminUsers.summary", {
		count: displayTotal,
		users: userCountLabel,
		page,
		totalPages,
	});
	const paginationLabel = t("adminUsers.pagination.label", { page, totalPages });
	const resolvedErrorMessage = resolveFeedbackMessage(errorMessage);
	const resolvedSuccessMessage = resolveFeedbackMessage(successMessage);

	return (
		<div className="container mx-auto max-w-6xl space-y-6 px-4 py-10">
			<header className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-lg dark:border-slate-700/60 dark:bg-slate-900/80">
				<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
							{t("adminUsers.title")}
						</h1>
						<p className="text-sm text-slate-500 dark:text-slate-300">
							{t("adminUsers.subtitle")}
						</p>
					</div>
					<form className="flex gap-2" onSubmit={handleSearchSubmit}>
						<input
							className="input rounded-xl border border-indigo-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
							placeholder={t("adminUsers.search.placeholder")}
							value={searchInput}
							onChange={(event) => setSearchInput(event.target.value)}
						/>
						<button className="btn-primary rounded-xl px-4" type="submit">
							{t("adminUsers.search.submit")}
						</button>
					</form>
				</div>

				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="text-sm text-slate-500 dark:text-slate-300">
						{query.isLoading ? (
							<span>{t("common.loading")}</span>
						) : (
							<span>{listSummary}</span>
						)}
					</div>
					<label className="inline-flex items-center gap-2 rounded-full border border-indigo-100/70 bg-indigo-50/60 px-3 py-1 text-xs font-medium text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
						<input
							type="checkbox"
							checked={onlyUnverified}
							onChange={(event) => {
								resetStatus();
								setOnlyUnverified(event.target.checked);
								setPage(1);
							}}
						/>
						<span>{t("adminUsers.filter.onlyUnverified")}</span>
					</label>
					<select
						aria-label={t("adminUsers.filter.role")}
						className="input rounded-lg border border-indigo-200 bg-white/90 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
						value={roleFilter}
						onChange={(event) => {
							resetStatus();
							setRoleFilter(event.target.value);
							setPage(1);
						}}>
						{roleFilterOptions.map((option) => (
							<option key={option.value || "all"} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<select
						aria-label={t("adminUsers.filter.pageSize")}
						className="input rounded-lg border border-indigo-200 bg-white/90 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
						value={pageSize}
						onChange={(event) => {
							resetStatus();
							setPageSize(Number(event.target.value));
							setPage(1);
						}}>
						{[5, 10, 20, 50, 100].map((size) => (
							<option key={size} value={size}>
								{size}
							</option>
						))}
					</select>
				</div>

				{resolvedErrorMessage && (
					<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
						{resolvedErrorMessage}
					</div>
				)}
				{resolvedSuccessMessage && (
					<div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-200">
						{resolvedSuccessMessage}
					</div>
				)}
			</header>

			<div className="overflow-hidden rounded-3xl border border-indigo-100/60 bg-white/90 shadow dark:border-slate-700/60 dark:bg-slate-900/70">
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-indigo-100 dark:divide-slate-700">
						<thead className="bg-indigo-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
							<tr>
								<th className="px-4 py-3">{t("adminUsers.table.name")}</th>
								<th className="px-4 py-3">{t("adminUsers.table.email")}</th>
								<th className="px-4 py-3">{t("adminUsers.table.verified")}</th>
								<th className="px-4 py-3">{t("adminUsers.table.roles")}</th>
								<th className="px-4 py-3 text-right">{t("adminUsers.table.actions")}</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-indigo-100/70 text-sm dark:divide-slate-800/70">
							{displayRows.map((user) => (
								<tr
									key={user.iri}
									className="hover:bg-indigo-50/60 dark:hover:bg-slate-800/60">
									<td className="px-4 py-3">
										<div className="flex flex-col">
											<span className="font-medium text-slate-800 dark:text-slate-100">
												{user.name?.trim() || EMPTY_PLACEHOLDER}
											</span>
											{user.avatar && (
												<a
													href={user.avatar}
													target="_blank"
													rel="noreferrer"
													className="text-xs text-indigo-500 hover:underline">
													{t("adminUsers.table.avatar")}
												</a>
											)}
										</div>
									</td>
									<td className="px-4 py-3 text-slate-600 dark:text-slate-300">
										{user.email?.trim() || EMPTY_PLACEHOLDER}
									</td>
									<td className="px-4 py-3">
										{user.isVerified ? (
											<span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/10 dark:text-green-200">
												{t("common.yes")}
											</span>
										) : (
											<span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
												{t("common.no")}
											</span>
										)}
									</td>
									<td className="px-4 py-3 text-slate-600 dark:text-slate-300">
										{user.roles.length > 0 ? (
											<div className="flex flex-wrap gap-1">
												{user.roles.map((role) => (
													<span
														key={`${user.iri}-${role}`}
														className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200">
														{formatRole(role)}
													</span>
												))}
											</div>
										) : (
											<span className="text-xs text-slate-400">
												{t("adminUsers.roles.none")}
											</span>
										)}
									</td>
									<td className="px-4 py-3">
										<div className="flex justify-end gap-2">
											<button
												className="btn-secondary !px-3 !py-1 text-xs"
												onClick={() => handleOpenEditor(user)}>
												{t("common.edit")}
											</button>
											<button
												className="btn-secondary !px-3 !py-1 text-xs text-red-600"
												onClick={() => handleDelete(user)}>
												{t("common.delete")}
											</button>
										</div>
									</td>
								</tr>
						))}
						{displayRows.length === 0 && !query.isLoading && (
							<tr>
								<td
									colSpan={5}
									className="px-4 py-8 text-center text-sm text-slate-500">
									{t("adminUsers.table.empty")}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			{query.isLoading && (
			<div className="px-4 py-6 text-center text-sm text-slate-500">
				{t("common.loading")}
			</div>
			)}
			{query.isFetching && !query.isLoading && (
			<div className="px-4 py-2 text-center text-xs text-slate-400">
				{t("adminUsers.refreshing")}
			</div>
			)}
		</div>

		<div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm shadow dark:border-slate-700/60 dark:bg-slate-900/70">
			<button
				className="btn-secondary"
				onClick={() => {
					resetStatus();
					setPage((prev) => Math.max(1, prev - 1));
				}}
				disabled={page === 1 || query.isFetching}>
				{t("adminUsers.pagination.previous")}
			</button>
			<span className="text-slate-500 dark:text-slate-300">
				{paginationLabel}
			</span>
			<button
				className="btn-secondary"
				onClick={() => {
					resetStatus();
					setPage((prev) => Math.min(totalPages, prev + 1));
				}}
				disabled={page >= totalPages || query.isFetching}>
				{t("adminUsers.pagination.next")}
			</button>
		</div>

		{editing && (
			<SimpleModal
				title={t("adminUsers.modal.title")}
				onClose={() => {
					setEditing(null);
					resetStatus();
				}}
				onSubmit={handleSave}
				disableSubmit={saving}>
				<div className="space-y-4">
					<div>
						<label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
							{t("adminUsers.table.name")}
						</label>
						<input
							className="input mt-1 w-full rounded-lg border border-indigo-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
							value={formName}
							onChange={(event) => setFormName(event.target.value)}
						/>
					</div>
					<div>
						<label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
							{t("adminUsers.table.email")}
						</label>
						<input
							className="input mt-1 w-full rounded-lg border border-indigo-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
							value={formEmail}
							onChange={(event) => setFormEmail(event.target.value)}
						/>
					</div>
					<div>
						<label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
							{t("profile.fields.avatar.label")}
						</label>
						<input
							className="input mt-1 w-full rounded-lg border border-indigo-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
							value={formAvatar}
							onChange={(event) => setFormAvatar(event.target.value)}
							placeholder={t("profile.fields.avatar.placeholder")}
						/>
					</div>
					<div className="flex items-center justify-between rounded-lg border border-indigo-100/70 bg-indigo-50/50 px-3 py-2 text-xs font-medium text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
						<span>{t("adminUsers.modal.verified")}</span>
						<label className="inline-flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								className="h-4 w-4"
								checked={formVerified}
								onChange={(event) => setFormVerified(event.target.checked)}
							/>
							<span>{formVerified ? t("common.yes") : t("common.no")}</span>
						</label>
					</div>
					<div>
						<p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
							{t("adminUsers.modal.roles")}
						</p>
						<div className="mt-2 space-y-2">
							{ROLE_OPTIONS.map((role) => (
								<label
									key={role.value}
									className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
									<input
										type="checkbox"
										checked={formRoles.includes(role.value)}
										onChange={() => toggleRole(role.value)}
									/>
									<span>{t(role.labelKey)}</span>
								</label>
							))}
						</div>
					</div>
					{resolvedErrorMessage && (
						<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
							{resolvedErrorMessage}
						</div>
					)}
				</div>
			</SimpleModal>
		)}
	</div>
	);
}

