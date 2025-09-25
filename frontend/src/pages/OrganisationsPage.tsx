import { useEffect, useMemo, useState } from "react";
import { XMarkIcon, PlusIcon, EyeIcon } from "@heroicons/react/24/outline";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatLabel } from "../utils/formatLabel";
import {
    useOrganizationMembers,
    useOrganizations,
    usePersons,
    useProfile,
} from "../hooks/apiQueries";
import { useToast } from "../hooks/toast";

type Organisation = {
    iri: string;
    label?: string;
    owner: string; // IRI du user admin/super‑admin désigné
    createdAt: string;
};

type OrganisationDetails = Organisation;

type CreateOrganizationInput = {
    label: string;
    ownerIri: string;
};

type DeleteOrganizationInput = { iri: string };

type OrganizationsMutationContext = {
    previousOrganizations: Organisation[];
};

/** Page de gestion des organisations (super‑admin only) */
export default function OrganisationsPage() {
    const api = useApi();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const currentUserIri = user?.sub;
    const { success: toastSuccess, error: toastError } = useToast();

    const profileQuery = useProfile();
    const roles = profileQuery.data?.roles ?? [];
    const isSuperAdmin = roles.some((r) => r.endsWith("SuperAdminRole"));
    const rolesLoaded = !profileQuery.isLoading && !profileQuery.isFetching;

    const organizationsScope = isSuperAdmin ? "all" : "mine";
    const organizationsQuery = useOrganizations(organizationsScope, {
        enabled: rolesLoaded,
    });
    const orgs = useMemo(
        () =>
            (organizationsQuery.data ?? []).map(
                (o: any): Organisation => ({
                    iri: o.iri,
                    label: o.label,
                    owner: o.owner,
                    createdAt: o.createdAt,
                })
            ),
        [organizationsQuery.data]
    );

    const personsQuery = usePersons();
    const persons = useMemo<PersonOption[]>(
        () =>
            (personsQuery.data ?? []).map((u: any) => ({
                id: u.id,
                display:
                    u.properties?.find((p: any) => p.predicate.endsWith("#name"))
                        ?.value ||
                    u.properties?.find((p: any) => p.predicate.endsWith("#email"))
                        ?.value ||
                    u.label ||
                    u.id.split(/[#/]/).pop(),
                label:
                    u.properties?.find((p: any) => p.predicate.endsWith("#name"))?.value ||
                    u.label ||
                    u.id.split(/[#/]/).pop() || u.id,
            })),
        [personsQuery.data]
    );

    const [showNew, setShowNew] = useState(false);
    const [selected, setSelected] = useState<OrganisationDetails | null>(null);

    const refreshOrganizations = () =>
        queryClient.invalidateQueries({
            queryKey: ["organizations", organizationsScope],
        });

    const createOrganizationMutation = useMutation<string | undefined, Error, CreateOrganizationInput, OrganizationsMutationContext>({
        mutationFn: async ({ label, ownerIri }) => {
            const res = await api("/organizations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label, ownerIri }),
            });
            if (!res.ok) {
                throw new Error(await res.text());
            }
            const contentType = res.headers.get("content-type");
            if (contentType?.includes("application/json")) {
                const json = await res.json();
                return typeof json === "string" ? json : json?.iri;
            }
            return (await res.text()) || undefined;
        },
        onMutate: async ({ label, ownerIri }) => {
            await queryClient.cancelQueries({ queryKey: ["organizations", organizationsScope] });
            const previousOrganizations = (queryClient.getQueryData<Organisation[]>([
                "organizations",
                organizationsScope,
            ]) ?? []).slice();
            const optimistic: Organisation = {
                iri: `temp-${Date.now()}`,
                label,
                owner: ownerIri,
                createdAt: new Date().toISOString(),
            };
            queryClient.setQueryData<Organisation[]>(
                ["organizations", organizationsScope],
                [...previousOrganizations, optimistic]
            );
            return { previousOrganizations };
        },
        onError: (_error, _input, context) => {
            if (context) {
                queryClient.setQueryData(
                    ["organizations", organizationsScope],
                    context.previousOrganizations
                );
            }
            toastError("Impossible de créer l'organisation.");
        },
        onSuccess: () => {
            toastSuccess("Organisation créée avec succès.");
        },
        onSettled: () => {
            refreshOrganizations();
        },
    });

    const deleteOrganizationMutation = useMutation<void, Error, DeleteOrganizationInput, OrganizationsMutationContext>({
        mutationFn: async ({ iri }) => {
            const res = await api(`/organizations/${encodeURIComponent(iri)}`, { method: "DELETE" });
            if (!res.ok) {
                throw new Error(await res.text());
            }
        },
        onMutate: async ({ iri }) => {
            await queryClient.cancelQueries({ queryKey: ["organizations", organizationsScope] });
            const previousOrganizations = (queryClient.getQueryData<Organisation[]>([
                "organizations",
                organizationsScope,
            ]) ?? []).slice();
            queryClient.setQueryData<Organisation[]>(
                ["organizations", organizationsScope],
                previousOrganizations.filter((org) => org.iri !== iri)
            );
            return { previousOrganizations };
        },
        onError: (_error, _input, context) => {
            if (context) {
                queryClient.setQueryData(
                    ["organizations", organizationsScope],
                    context.previousOrganizations
                );
            }
            toastError("Suppression de l'organisation impossible.");
        },
        onSuccess: () => {
            toastSuccess("Organisation supprimée.");
        },
        onSettled: () => {
            refreshOrganizations();
        },
    });

    return (
        <div className="container mx-auto py-8 space-y-6">
            <h1 className="text-2xl font-semibold flex justify-between items-center">
                Organisations ({orgs.length})
                {isSuperAdmin && currentUserIri && (
                    <button
                        className="btn-primary flex items-center gap-1"
                        onClick={() => setShowNew(true)}>
                        <PlusIcon className="w-4 h-4" />
                        Nouvelle
                    </button>
                )}
            </h1>

            <ul className="grid md:grid-cols-2 gap-4">
                {organizationsQuery.isLoading && (
                    <li className="text-sm text-gray-500">Chargement…</li>
                )}
                {!organizationsQuery.isLoading &&
                    orgs.map((o) => (
                    <li key={o.iri} className="card space-y-2 shadow-sm">
                        <div className="flex justify-between items-center">
							<span className="font-medium">
								{formatLabel(o.label ?? o.iri)}
							</span>
                            <div className="flex items-center gap-2">
                                <button
                                    title="Voir"
                                    className="text-indigo-600 hover:text-indigo-800"
                                    onClick={() => setSelected(o)}>
                                    <EyeIcon className="w-4 h-4" />
                                </button>
                               {isSuperAdmin && (
                                   <button
                                        title="Supprimer"
                                        className="text-red-600 text-sm disabled:opacity-40"
                                        disabled={deleteOrganizationMutation.isPending}
                                        onClick={() => deleteOrganizationMutation.mutate({ iri: o.iri })}>
                                        🗑
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            Admin&nbsp;:{" "}
                            {persons.find((p) => p.id === o.owner)?.display ||
                                formatLabel(o.owner.split(/[#/]/).pop()!)}
                        </p>
                    </li>
                ))}
            </ul>

            {showNew && (
                <OrganisationFormModal
                    onClose={() => setShowNew(false)}
                    onCreate={async (input) => {
                        await createOrganizationMutation.mutateAsync(input);
                    }}
                    persons={persons}
                    personsLoading={personsQuery.isLoading}
                    isSubmitting={createOrganizationMutation.isPending}
                />
            )}

            {selected && (
                <OrganisationDetailsModal
                    org={selected}
                    isSuperAdmin={isSuperAdmin || false}
                    isManager={isSuperAdmin || selected.owner === currentUserIri}
                    onClose={() => setSelected(null)}
                    onReload={refreshOrganizations}
                    persons={persons}
                    personsLoading={personsQuery.isLoading}
                    onDeleteOrganization={async (iri) => {
                        await deleteOrganizationMutation.mutateAsync({ iri });
                    }}
                    deleting={deleteOrganizationMutation.isPending}
                />
            )}
        </div>
    );
}

interface PersonOption {
    id: string;
    label: string;
    display: string;
    roles?: string[];
}

function OrganisationFormModal({
                                   onClose,
                                   onCreate,
                                   persons,
                                   personsLoading,
                                   isSubmitting,
                               }: {
    onClose: () => void;
    onCreate: (input: CreateOrganizationInput) => Promise<void>;
    persons: PersonOption[];
    personsLoading: boolean;
    isSubmitting: boolean;
}) {
    const [label, setLabel] = useState("");
    const [owner, setOwner] = useState<string>("");
    const disabled = label.trim() === "" || owner === "";

    const save = async () => {
        if (disabled) return;
        await onCreate({ label: label.trim(), ownerIri: owner });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="card w-[26rem] space-y-4">
                <h3 className="font-semibold text-lg">Nouvelle organisation</h3>
                <input
                    className="input"
                    placeholder="Nom de l'organisation"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                />
                <select
                    className="input"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    disabled={personsLoading}>
                    <option value="">— Choisir un admin —</option>
                    {persons.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.display}
                        </option>
                    ))}
                </select>

                <div className="flex justify-end gap-4">
                    <button className="btn-secondary" onClick={onClose}>
                        Annuler
                    </button>
                    <button
                        className={`btn-primary ${
                            disabled || isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        disabled={disabled || isSubmitting}
                        onClick={save}>
                        {isSubmitting ? "Création…" : "Créer"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function OrganisationDetailsModal({
                                      org,
                                      isSuperAdmin,
                                      isManager,
                                      onClose,
                                      onReload,
                                      persons,
                                      personsLoading,
                                      onDeleteOrganization,
                                      deleting,
                                  }: {
    org: OrganisationDetails;
    isSuperAdmin: boolean;
    isManager: boolean;
    onClose: () => void;
    onReload: () => void;
    persons: PersonOption[];
    personsLoading: boolean;
    onDeleteOrganization: (iri: string) => Promise<void>;
    deleting: boolean;
}) {
    const api = useApi();
    const queryClient = useQueryClient();
    const { success: toastSuccess, error: toastError } = useToast();
    const [label, setLabel] = useState(org.label || "");
    const [owner, setOwner] = useState(org.owner);
    const [members, setMembers] = useState<string[]>([]);

    const canEditLabelAdmin = isSuperAdmin;
    const canManageMembers = isSuperAdmin || isManager;

    const { data: memberList = [], isFetching: membersLoading } = useOrganizationMembers(
        org.iri,
        { enabled: true }
    );

    useEffect(() => {
        setMembers(memberList.map((m: any) => m.iri));
    }, [memberList]);

    const save = async () => {
        const payload: Record<string, unknown> = {};
        if (canEditLabelAdmin) payload.label = label;
        if (canEditLabelAdmin) payload.ownerIri = owner;

        try {
            await api(`/organizations/${encodeURIComponent(org.iri)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            toastSuccess("Organisation mise à jour.");
            onReload();
            onClose();
        } catch (error) {
            toastError("Mise à jour impossible.");
        }
    };

    const addMember = async (personIri: string) => {
        try {
            await api(`/organizations/${encodeURIComponent(org.iri)}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userIri: personIri }),
            });
            setMembers((m) => [...new Set([...m, personIri])]);
            await queryClient.invalidateQueries({
                queryKey: ["organizations", "members", org.iri],
            });
            toastSuccess("Membre ajouté.");
        } catch (error) {
            toastError("Impossible d'ajouter ce membre.");
        }
    };

    const removeMember = async (personIri: string) => {
        try {
            await api(
                `/organizations/${encodeURIComponent(org.iri)}/members/${encodeURIComponent(personIri)}`,
                { method: "DELETE" }
            );
            setMembers((m) => m.filter((x) => x !== personIri));
            await queryClient.invalidateQueries({
                queryKey: ["organizations", "members", org.iri],
            });
            toastSuccess("Membre retiré.");
        } catch (error) {
            toastError("Impossible de retirer ce membre.");
        }
    };

    const availablePersons = useMemo(
        () => persons.filter((p) => !members.includes(p.id)),
        [persons, members]
    );

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="card w-[28rem] space-y-4">
                <header className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Organisation</h3>
                    <button onClick={onClose}>
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </header>

                <label className="block text-sm font-medium">Nom</label>
                <input
                    className="input w-full"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    disabled={!canEditLabelAdmin}
                />

                <label className="block text-sm font-medium">Admin</label>
                <select
                    className="input"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    disabled={!canEditLabelAdmin || personsLoading}>
                    {persons.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.display}
                        </option>
                    ))}
                </select>

                <label className="block text-sm font-medium mt-2">Membres</label>
                <ul className="space-y-1 border rounded p-2 max-h-40 overflow-y-auto">
                    {members.map((m) => {
                        const disp =
                            persons.find((p) => p.id === m)?.display || formatLabel(m);
                        return (
                            <li
                                key={m}
                                className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded px-2 py-1 text-xs">
                                <span>{disp}</span>
                                {canManageMembers && (
                                    <button
                                        title="Retirer"
                                        onClick={() => removeMember(m)}
                                        className="text-red-600 hover:text-red-800 text-[10px]">
                                        🗑
                                    </button>
                                )}
                            </li>
                        );
                    })}
                    {members.length === 0 && !membersLoading && (
                        <li className="text-xs text-gray-500">Aucun membre pour l’instant.</li>
                    )}
                    {membersLoading && (
                        <li className="text-xs text-gray-500">Chargement…</li>
                    )}
                </ul>

                {canManageMembers && (
                    <>
                        <label className="block text-sm font-medium">
                            Ajouter un membre
                        </label>
                        <select
                            className="input"
                            onChange={(e) => {
                                const iri = e.target.value;
                                if (!iri) return;
                                addMember(iri);
                                e.target.value = "";
                            }}
                            disabled={membersLoading || personsLoading}>
                            <option value="">— choisir —</option>
                            {availablePersons.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.display}
                                </option>
                            ))}
                        </select>
                    </>
                )}

                <footer className="flex justify-end gap-3 pt-2">
                    {isSuperAdmin && (
                        <button
                            className="btn-secondary text-red-600 border-red-400 hover:bg-red-50 disabled:opacity-40"
                            disabled={deleting}
                            onClick={async () => {
                                try {
                                    await onDeleteOrganization(org.iri);
                                    onReload();
                                    onClose();
                                } catch (error) {
                                    /* le toast est géré par la mutation */
                                }
                            }}>
                            {deleting ? "Suppression…" : "Supprimer"}
                        </button>
                    )}
                    <button className="btn-primary" onClick={save} disabled={deleting}>
                        Sauvegarder
                    </button>
                </footer>
            </div>
        </div>
    );
}
