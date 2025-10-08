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
		<div className="page-shell">
			<header className="page-header">
				<div className="page-header__content">
					<h1 className="page-header__title">{t("adminUsers.title")}</h1>
					<p className="page-header__subtitle">{t("adminUsers.subtitle")}</p>
				</div>
				<div className="page-header__actions">
					<form className="filter-bar__group" onSubmit={handleSearchSubmit}>
						<input
							className="form-input"
							placeholder={t("adminUsers.search.placeholder")}
							value={searchInput}
							onChange={(event) => setSearchInput(event.target.value)}
						/>
						<button className="btn-primary" type="submit">
							{t("adminUsers.search.submit")}
						</button>
					</form>
				</div>
			</header>

			<section className="page-section">
				<div className="filter-bar">
					<div className="filter-bar__group">
						<span className="page-section__description" style={{ fontSize: "0.9rem" }}>
							{query.isLoading ? t("common.loading") : listSummary}
						</span>
						<label className="filter-toggle">
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
							className="select-control"
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
							className="select-control"
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
				</div>

			{resolvedErrorMessage && (
				<div className="status-banner status-banner--error">{resolvedErrorMessage}</div>
			)}
			{resolvedSuccessMessage && (
				<div className="status-banner status-banner--success">{resolvedSuccessMessage}</div>
			)}

			<div className="table-card">
				<div className="table-card__scroll">
					<table className="data-table">
						<thead>
							<tr>
								<th>{t("adminUsers.table.name")}</th>
								<th>{t("adminUsers.table.email")}</th>
								<th>{t("adminUsers.table.verified")}</th>
								<th>{t("adminUsers.table.roles")}</th>
								<th style={{ textAlign: "right" }}>{t("adminUsers.table.actions")}</th>
							</tr>
						</thead>
					<tbody>
						{displayRows.map((user) => (
							<tr key={user.iri}>
								<td>
									<div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
										<span className="page-section__description" style={{ color: "inherit", fontWeight: 600 }}>
											{user.name?.trim() || EMPTY_PLACEHOLDER}
										</span>
										{user.avatar && (
											<a
												href={user.avatar}
												target="_blank"
												rel="noreferrer"
												className="page-section__description"
												style={{ fontSize: "0.75rem", color: "#4c51bf" }}>
													{t("adminUsers.table.avatar")}
												</a>
											)}
									</div>
								</td>
								<td>{user.email?.trim() || EMPTY_PLACEHOLDER}</td>
								<td>
									{user.isVerified ? (
										<span className="chip chip--success">{t("common.yes")}</span>
									) : (
										<span className="chip chip--muted">{t("common.no")}</span>
									)}
								</td>
								<td>
									{user.roles.length > 0 ? (
										<div className="chip-list">
											{user.roles.map((role) => (
												<span key={`${user.iri}-${role}`} className="chip">
													{formatRole(role)}
												</span>
											))}
										</div>
									) : (
										<span className="page-section__description" style={{ fontSize: "0.8rem" }}>
											{t("adminUsers.roles.none")}
										</span>
									)}
								</td>
								<td>
									<div className="table-actions">
										<button className="btn-secondary" onClick={() => handleOpenEditor(user)}>
											{t("common.edit")}
										</button>
										<button className="btn-secondary btn-secondary--danger" onClick={() => handleDelete(user)}>
											{t("common.delete")}
										</button>
									</div>
								</td>
							</tr>
						))}
						{displayRows.length === 0 && !query.isLoading && (
							<tr>
								<td colSpan={5} style={{ padding: "1.5rem", textAlign: "center" }}>
									{t("adminUsers.table.empty")}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>

		{query.isLoading && (
			<div className="note-box">{t("common.loading")}</div>
		)}
		{query.isFetching && !query.isLoading && (
			<div className="note-box" style={{ fontSize: "0.8rem" }}>
				{t("adminUsers.refreshing")}
			</div>
		)}
		</section>

		<div className="pagination-bar">
			<button
				className="btn-secondary"
				onClick={() => {
					resetStatus();
					setPage((prev) => Math.max(1, prev - 1));
				}}
				disabled={page === 1 || query.isFetching}>
				{t("adminUsers.pagination.previous")}
			</button>
			<span className="page-section__description" style={{ fontSize: "0.9rem" }}>
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
			<div className="form-grid">
				<div className="form-field">
					<label className="form-label">{t("adminUsers.table.name")}</label>
					<input
						className="form-input"
						value={formName}
						onChange={(event) => setFormName(event.target.value)}
					/>
				</div>
				<div className="form-field">
					<label className="form-label">{t("adminUsers.table.email")}</label>
					<input
						className="form-input"
						value={formEmail}
						onChange={(event) => setFormEmail(event.target.value)}
					/>
				</div>
				<div className="form-field">
					<label className="form-label">{t("profile.fields.avatar.label")}</label>
					<input
						className="form-input"
						value={formAvatar}
						onChange={(event) => setFormAvatar(event.target.value)}
						placeholder={t("profile.fields.avatar.placeholder")}
					/>
				</div>
				<div className="checkbox-row">
					<span>{t("adminUsers.modal.verified")}</span>
					<label className="chip-toggle">
						<input
							type="checkbox"
							checked={formVerified}
							onChange={(event) => setFormVerified(event.target.checked)}
						/>
						<span>{formVerified ? t("common.yes") : t("common.no")}</span>
					</label>
				</div>
				<div className="form-field">
					<p className="form-label" style={{ marginBottom: "0.3rem" }}>
						{t("adminUsers.modal.roles")}
					</p>
					<div className="chip-list">
						{ROLE_OPTIONS.map((role) => (
							<label key={role.value} className="chip-toggle">
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
					<div className="status-banner status-banner--error">
						{resolvedErrorMessage}
					</div>
				)}
				</div>
			</SimpleModal>
		)}
	</div>
	);
}
