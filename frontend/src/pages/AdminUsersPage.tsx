import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminUsers, AdminUser } from "../hooks/useAdminUsers";
import { useApi } from "../lib/api";
import SimpleModal from "../components/SimpleModal";

const CORE = "http://example.org/core#";
const ROLE_OPTIONS = [
    { value: `${CORE}SuperAdminRole`, label: "Super administrateur" },
    { value: `${CORE}AdminRole`, label: "Administrateur" },
    { value: `${CORE}RegularRole`, label: "Utilisateur" },
];

const ROLE_FILTER_OPTIONS = [
    { value: "", label: "Tous les rôles" },
    ...ROLE_OPTIONS,
];

const EMPTY_PLACEHOLDER = "—";

const formatRole = (role: string) => {
    const option = ROLE_OPTIONS.find((opt) => opt.value === role);
    if (option) return option.label;
    const parts = role.split(/[#/]/);
    return parts[parts.length - 1] || role;
};

export default function AdminUsersPage() {
    const [page, setPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const [searchInput, setSearchInput] = useState<string>("");
    const [search, setSearch] = useState<string>("");
    const [onlyUnverified, setOnlyUnverified] = useState<boolean>(false);
    const [roleFilter, setRoleFilter] = useState<string>("");

    const query = useAdminUsers({ page, pageSize, search, onlyUnverified, role: roleFilter || undefined });
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
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
            const res = await api(`/auth/admin/users/${encodeURIComponent(editing.iri)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({ message: "Échec de la mise à jour." }));
                throw new Error(body.message || "Échec de la mise à jour.");
            }
            setSuccessMessage("Utilisateur mis à jour.");
            setEditing(null);
            await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Impossible d'enregistrer.";
            setErrorMessage(message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (user: AdminUser) => {
        resetStatus();
        const confirmDelete = window.confirm(
            `Supprimer définitivement ${user.email ?? user.name ?? "cet utilisateur"} ?`
        );
        if (!confirmDelete) return;
        try {
            const res = await api(`/auth/admin/users/${encodeURIComponent(user.iri)}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({ message: "Échec de la suppression." }));
                throw new Error(body.message || "Échec de la suppression.");
            }
            setSuccessMessage("Utilisateur supprimé.");
            await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Impossible de supprimer l'utilisateur.";
            setErrorMessage(message);
        }
    };

    const toggleRole = (role: string) => {
        setFormRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
    };

    return (
        <div className="container mx-auto max-w-6xl space-y-6 px-4 py-10">
            <header className="flex flex-col gap-4 rounded-3xl bg-white/90 p-6 shadow-lg dark:bg-slate-900/80">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
                            Gestion des utilisateurs
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-300">
                            Liste complète des comptes, réservée aux super administrateurs.
                        </p>
                    </div>
                    <form className="flex gap-2" onSubmit={handleSearchSubmit}>
                        <input
                            className="input rounded-xl border border-indigo-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
                            placeholder="Rechercher par nom ou email"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                        />
                        <button className="btn-primary rounded-xl px-4" type="submit">
                            Rechercher
                        </button>
                    </form>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="text-sm text-slate-500 dark:text-slate-300">
                            {query.isLoading ? (
                                <span>Chargement…</span>
                            ) : (
                                <span>
                                    {displayTotal} utilisateur{displayTotal > 1 ? "s" : ""} · page {page} / {totalPages}
                                </span>
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
                            <span>Non vérifiés uniquement</span>
                        </label>
                        <select
                            aria-label="Filtrer par rôle"
                            className="input rounded-lg border border-indigo-200 bg-white/90 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
                            value={roleFilter}
                            onChange={(event) => {
                                resetStatus();
                                setRoleFilter(event.target.value);
                                setPage(1);
                            }}
                        >
                            {ROLE_FILTER_OPTIONS.map((option) => (
                                <option key={option.value || "all"} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <select
                            aria-label="Nombre d'éléments par page"
                            className="input rounded-lg border border-indigo-200 bg-white/90 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
                            value={pageSize}
                            onChange={(event) => {
                                resetStatus();
                                setPageSize(Number(event.target.value));
                                setPage(1);
                            }}
                        >
                            {[5, 10, 20, 50, 100].map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {errorMessage && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                        {errorMessage}
                    </div>
                )}
                {successMessage && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-200">
                        {successMessage}
                    </div>
                )}
            </header>

            <div className="overflow-hidden rounded-3xl border border-indigo-100/60 bg-white/90 shadow dark:border-slate-700/60 dark:bg-slate-900/70">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-indigo-100 dark:divide-slate-700">
                        <thead className="bg-indigo-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                            <tr>
                                <th className="px-4 py-3">Nom</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Vérifié</th>
                                <th className="px-4 py-3">Rôles</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-indigo-100/70 text-sm dark:divide-slate-800/70">
                            {displayRows.map((user) => (
                                <tr key={user.iri} className="hover:bg-indigo-50/60 dark:hover:bg-slate-800/60">
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
                                                    className="text-xs text-indigo-500 hover:underline"
                                                >
                                                    Avatar
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
                                                Oui
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                                                Non
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                        {user.roles.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {user.roles.map((role) => (
                                                    <span
                                                        key={`${user.iri}-${role}`}
                                                        className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200"
                                                    >
                                                        {formatRole(role)}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400">Aucun</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                className="btn-secondary !px-3 !py-1 text-xs"
                                                onClick={() => handleOpenEditor(user)}
                                            >
                                                Modifier
                                            </button>
                                            <button
                                                className="btn-secondary !px-3 !py-1 text-xs text-red-600"
                                                onClick={() => handleDelete(user)}
                                            >
                                                Supprimer
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {displayRows.length === 0 && !query.isLoading && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                                        Aucun utilisateur à afficher.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {query.isLoading && (
                    <div className="px-4 py-6 text-center text-sm text-slate-500">Chargement…</div>
                )}
                {query.isFetching && !query.isLoading && (
                    <div className="px-4 py-2 text-center text-xs text-slate-400">Actualisation…</div>
                )}
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm shadow dark:bg-slate-900/70">
                <button
                    className="btn-secondary"
                    onClick={() => {
                        resetStatus();
                        setPage((prev) => Math.max(1, prev - 1));
                    }}
                    disabled={page === 1 || query.isFetching}
                >
                    Précédent
                </button>
                <span className="text-slate-500 dark:text-slate-300">
                    Page {page} sur {totalPages}
                </span>
                <button
                    className="btn-secondary"
                    onClick={() => {
                        resetStatus();
                        setPage((prev) => Math.min(totalPages, prev + 1));
                    }}
                    disabled={page >= totalPages || query.isFetching}
                >
                    Suivant
                </button>
            </div>

            {editing && (
                <SimpleModal
                    title="Modifier l'utilisateur"
                    onClose={() => {
                        setEditing(null);
                        resetStatus();
                    }}
                    onSubmit={handleSave}
                    disableSubmit={saving}
                >
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                                Nom
                            </label>
                            <input
                                className="input mt-1 w-full rounded-lg border border-indigo-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
                                value={formName}
                                onChange={(event) => setFormName(event.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                                Email
                            </label>
                            <input
                                className="input mt-1 w-full rounded-lg border border-indigo-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
                                value={formEmail}
                                onChange={(event) => setFormEmail(event.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                                Avatar (URL)
                            </label>
                            <input
                                className="input mt-1 w-full rounded-lg border border-indigo-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100"
                                value={formAvatar}
                                onChange={(event) => setFormAvatar(event.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-indigo-100/70 bg-indigo-50/50 px-3 py-2 text-xs font-medium text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
                            <span>Utilisateur vérifié</span>
                            <label className="inline-flex cursor-pointer items-center gap-2">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={formVerified}
                                    onChange={(event) => setFormVerified(event.target.checked)}
                                />
                                <span>{formVerified ? "Oui" : "Non"}</span>
                            </label>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">Rôles</p>
                            <div className="mt-2 space-y-2">
                                {ROLE_OPTIONS.map((role) => (
                                    <label
                                        key={role.value}
                                        className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={formRoles.includes(role.value)}
                                            onChange={() => toggleRole(role.value)}
                                        />
                                        <span>{role.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        {errorMessage && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                                {errorMessage}
                            </div>
                        )}
                    </div>
                </SimpleModal>
            )}
        </div>
    );
}


