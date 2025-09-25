import { useEffect, useMemo, useState } from "react";
import { XMarkIcon, TrashIcon, EyeIcon } from "@heroicons/react/24/outline";
import { useMutation, useQueryClient } from "@tanstack/react-query";
// util pour encoder un IRI dans les URL
const enc = encodeURIComponent;
import { useApi } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatLabel } from "../utils/formatLabel";
import {
    useGroups,
    useOrganizationMembers,
    useOrganizations,
    useProfile,
} from "../hooks/apiQueries";
import { useToast } from "../hooks/toast";

type Group = {
    iri: string;
    label?: string;
    members?: string[];
    createdBy?: string;
    organizationIri?: string;
};

type GroupDetails = Group & { members: string[] };

type CreateGroupInput = {
    label: string;
    organizationIri: string;
    members: string[];
};

type DeleteGroupInput = { iri: string };

type GroupsMutationContext = {
    previousGroups: Group[];
};

export default function GroupsPage() {
    const queryClient = useQueryClient();
    const api = useApi();
    const { user } = useAuth();
    const currentUserIri = user?.sub;
    const { success: toastSuccess, error: toastError } = useToast();

    const profileQuery = useProfile();
    const roles = profileQuery.data?.roles ?? [];
    const isSuperAdmin = roles.some((r) => r.endsWith("SuperAdminRole"));
    const isRolesLoaded = !profileQuery.isLoading && !profileQuery.isFetching;

    const groupsQuery = useGroups();
    const groups = useMemo(
        () =>
            (groupsQuery.data ?? []).map(
                (g: any): Group => ({
                    iri: g.iri,
                    label: g.label,
                    createdBy: g.createdBy,
                    members: g.members ?? [],
                    organizationIri: g.organizationIri,
                })
            ),
        [groupsQuery.data]
    );

    const createGroupMutation = useMutation<string | undefined, Error, CreateGroupInput, GroupsMutationContext>({
        mutationFn: async (input) => {
            const res = await api("/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    label: input.label,
                    organizationIri: input.organizationIri,
                    members: input.members,
                }),
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
        onMutate: async (input) => {
            await queryClient.cancelQueries({ queryKey: ["groups"] });
            const previousGroups = (queryClient.getQueryData<Group[]>(["groups"]) ?? []).slice();
            const optimistic: Group = {
                iri: `temp-${Date.now()}`,
                label: input.label,
                createdBy: currentUserIri,
                members: input.members,
                organizationIri: input.organizationIri,
            };
            queryClient.setQueryData<Group[]>(["groups"], [...previousGroups, optimistic]);
            return { previousGroups };
        },
        onError: (_error, _input, context) => {
            if (context) {
                queryClient.setQueryData<Group[]>(["groups"], context.previousGroups);
            }
            toastError("Impossible de créer le groupe.");
        },
        onSuccess: () => {
            toastSuccess("Groupe créé avec succès.");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["groups"] });
        },
    });

    const deleteGroupMutation = useMutation<void, Error, DeleteGroupInput, GroupsMutationContext>({
        mutationFn: async ({ iri }) => {
            const res = await api(`/groups/${encodeURIComponent(iri)}`, { method: "DELETE" });
            if (!res.ok) {
                throw new Error(await res.text());
            }
        },
        onMutate: async ({ iri }) => {
            await queryClient.cancelQueries({ queryKey: ["groups"] });
            const previousGroups = (queryClient.getQueryData<Group[]>(["groups"]) ?? []).slice();
            queryClient.setQueryData<Group[]>(
                ["groups"],
                previousGroups.filter((group) => group.iri !== iri)
            );
            return { previousGroups };
        },
        onError: (_error, _input, context) => {
            if (context) {
                queryClient.setQueryData<Group[]>(["groups"], context.previousGroups);
            }
            toastError("Suppression du groupe impossible.");
        },
        onSuccess: () => {
            toastSuccess("Groupe supprimé.");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["groups"] });
        },
    });

    const organizationsScope = isSuperAdmin ? "all" : "mine";
    const organizationsQuery = useOrganizations(organizationsScope, {
        enabled: isRolesLoaded,
    });
    const organizations = useMemo(
        () =>
            (organizationsQuery.data ?? []).map((org: any) => ({
                iri: org.iri,
                label: org.label ?? org.iri.split(/[#/]/).pop() ?? org.iri,
            })),
        [organizationsQuery.data]
    );

    const [showNew, setShowNew] = useState(false);
    const [selected, setSelected] = useState<GroupDetails | null>(null);

    const refreshGroups = () =>
        queryClient.invalidateQueries({ queryKey: ["groups"] });

    const refreshOrganizations = () =>
        queryClient.invalidateQueries({ queryKey: ["organizations", organizationsScope] });

    return (
        <div className="container mx-auto py-8 space-y-6">
            <h1 className="text-2xl font-semibold flex justify-between items-center">
                Groupes ({groups.length})
                {currentUserIri && isRolesLoaded && (
                    <button className="btn-primary" onClick={() => setShowNew(true)}>
                        + Nouveau
                    </button>
                )}
            </h1>

            <ul className="grid md:grid-cols-2 gap-4">
                {groups.map((g) => (
                    <li key={g.iri} className="card space-y-2 shadow-sm">
                        <div className="flex justify-between items-center">
                            <span className="font-medium">{formatLabel(g.label ?? g.iri)}</span>
                            <div className="flex items-center gap-2">
                                {/* Voir les membres */}
                                <button
                                    title="Voir"
                                    className="text-indigo-600 hover:text-indigo-800"
                                    onClick={() => setSelected(g as GroupDetails)}>
                                    <EyeIcon className="w-4 h-4" />
                                </button>
                                {/* Actions réservées au créateur */}
                                {g.createdBy === currentUserIri && (
                                    <button
                                        title="Supprimer"
                                        className="text-red-600 text-sm disabled:opacity-40"
                                        disabled={deleteGroupMutation.isPending}
                                        onClick={() => deleteGroupMutation.mutate({ iri: g.iri })}>
                                        🗑
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            Membres&nbsp;: {g.members?.length ?? 0}{" "}
                        </p>
                    </li>
                ))}
            </ul>

            {showNew && (
                <GroupFormModal
                    currentUserIri={currentUserIri ?? ""}
                    organizations={organizations}
                    organizationsLoading={organizationsQuery.isLoading}
                    isSubmitting={createGroupMutation.isPending}
                    onClose={() => setShowNew(false)}
                    onCreate={async (input) => {
                        await createGroupMutation.mutateAsync(input);
                        refreshOrganizations();
                    }}
                />
            )}

            {selected && (
                <GroupDetailsModal
                    group={selected}
                    currentUserIri={currentUserIri ?? ""}
                    organizations={organizations}
                    onClose={() => setSelected(null)}
                    onReload={() => {
                        refreshGroups();
                        refreshOrganizations();
                    }}
                    onDeleteGroup={async (iri) => {
                        await deleteGroupMutation.mutateAsync({ iri });
                    }}
                    deleting={deleteGroupMutation.isPending}
                />
            )}
        </div>
    );
}

interface PersonOption {
    id: string; // full IRI of the user individual
    label: string; // rdfs:label or fallback
    display: string; // string shown in the list (e‑mail or name)
    email?: string;
}

function GroupFormModal({
                            currentUserIri,
                            organizations,
                            organizationsLoading,
                            isSubmitting,
                            onClose,
                            onCreate,
                        }: {
    currentUserIri: string;
    organizations: { iri: string; label: string }[];
    organizationsLoading: boolean;
    isSubmitting: boolean;
    onClose: () => void;
    onCreate: (input: CreateGroupInput) => Promise<void>;
}) {
    const [label, setLabel] = useState("");
    const [selectedOrg, setSelectedOrg] = useState<string>("");
    const [selected, setSelected] = useState<string[]>([]);

    const disabled = label.trim() === "" || !selectedOrg;

    useEffect(() => {
        if (!selectedOrg && organizations.length > 0) {
            setSelectedOrg(organizations[0].iri);
        }
    }, [organizations, selectedOrg]);

    const { data: members = [], isFetching: membersLoading } = useOrganizationMembers(
        selectedOrg,
        { enabled: Boolean(selectedOrg) }
    );

    const personOptions = useMemo<PersonOption[]>(
        () =>
            members.map((u: any) => {
                const iri: string = u.id ?? u.iri;
                const email = u.properties?.find((p: any) =>
                    p.predicate?.endsWith("#email")
                )?.value;
                return {
                    id: iri,
                    label: u.label ?? iri.split(/[#/]/).pop(),
                    display: email ?? u.label ?? iri.split(/[#/]/).pop(),
                };
            }),
        [members]
    );

    useEffect(() => {
        if (!selectedOrg) {
            setSelected([]);
            return;
        }
        setSelected((prev) => {
            const hasCurrent = prev.includes(currentUserIri);
            const memberListHasCurrent = members.some(
                (u: any) => (u.id ?? u.iri) === currentUserIri
            );
            if (memberListHasCurrent && !hasCurrent) {
                return [...prev, currentUserIri];
            }
            if (!memberListHasCurrent && hasCurrent) {
                return prev.filter((id) => id !== currentUserIri);
            }
            return prev;
        });
    }, [members, currentUserIri, selectedOrg]);

    const save = async () => {
        if (disabled) return;
        await onCreate({
            label: label.trim(),
            organizationIri: selectedOrg,
            members: selected,
        });
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="card w-[26rem] space-y-4">
                <h3 className="font-semibold text-lg">Nouveau groupe</h3>

                {/* --- Organisation selector --- */}
                <select
                    className="input w-full"
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                    disabled={organizationsLoading || organizations.length === 0}>
                    <option value="">— Choisir une organisation —</option>
                    {organizations.map((o) => (
                        <option key={o.iri} value={o.iri}>
                            {o.label}
                        </option>
                    ))}
                </select>

                {/* --- Nom du groupe --- */}
                <input
                    className="input w-full"
                    placeholder="Nom du groupe"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                />

                {selectedOrg && (
                    <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-2">
                        {membersLoading && (
                            <p className="text-xs text-gray-500">
                                Chargement des membres…
                            </p>
                        )}
                        {!membersLoading && personOptions.length === 0 && (
                            <p className="text-xs text-gray-500">
                                Aucun membre disponible pour cette organisation.
                            </p>
                        )}
                        {personOptions.map((p) => (
                            <label
                                key={p.id}
                                className={`flex items-center gap-2 text-xs p-1 rounded cursor-pointer ${
                                    selected.includes(p.id)
                                        ? "bg-indigo-100 dark:bg-slate-700"
                                        : "hover:bg-indigo-50 dark:hover:bg-slate-800"
                                }`}>
                                <input
                                    type="checkbox"
                                    className="accent-indigo-600"
                                    checked={selected.includes(p.id)}
                                    onChange={(e) =>
                                        setSelected((prev) =>
                                            e.target.checked
                                                ? [...prev, p.id]
                                                : prev.filter((x) => x !== p.id)
                                        )
                                    }
                                />
                                {p.display}
                            </label>
                        ))}
                    </div>
                )}
                <div className="flex justify-end gap-4">
                    <button className="btn-secondary" onClick={onClose}>
                        Annuler
                    </button>
                    <button
                        className={`btn-primary ${
                            disabled || isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        onClick={save}
                        disabled={disabled || isSubmitting}>
                        {isSubmitting ? "Création…" : "Créer"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function GroupDetailsModal({
                               group,
                               currentUserIri,
                               organizations,
                               onClose,
                               onReload,
                               onDeleteGroup,
                               deleting,
                           }: {
    group: GroupDetails & { organizationIri?: string };
    currentUserIri: string;
    organizations: { iri: string; label: string }[];
    onClose: () => void;
    onReload: () => void;
    onDeleteGroup: (iri: string) => Promise<void>;
    deleting: boolean;
}) {
    const api = useApi();
    const queryClient = useQueryClient();
    const { success: toastSuccess, error: toastError } = useToast();
    const isOwner = group.createdBy === currentUserIri;

    const [label, setLabel] = useState(group.label);
    const [members, setMembers] = useState<string[]>(group.members);
    const [selectedOrg, setSelectedOrg] = useState(group.organizationIri ?? "");

    useEffect(() => {
        if (!selectedOrg && organizations.length > 0) {
            setSelectedOrg(organizations[0].iri);
        }
    }, [organizations, selectedOrg]);

    const { data: orgMembers = [], isFetching: memberOptionsLoading } = useOrganizationMembers(
        selectedOrg,
        { enabled: Boolean(selectedOrg) }
    );

    const personOptions = useMemo<PersonOption[]>(
        () =>
            orgMembers.map((u: any) => {
                const iri: string = u.id ?? u.iri;
                const email = u.properties?.find((p: any) =>
                    p.predicate?.endsWith("#email")
                )?.value;
                const fallback = iri.split(/[#/]/).pop() ?? iri;
                return {
                    id: iri,
                    label: u.label ?? fallback,
                    display: email ?? u.label ?? fallback,
                };
            }),
        [orgMembers]
    );

    /* ----- Mutations ----- */
    const patchLabel = async () => {
        if (label === group.label) return;
        await api(
            `/groups/${encodeURIComponent(group.iri)}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label }),
            }
        );
    };

    const addMember = async (personIri: string) => {
        try {
            await api(`/groups/${encodeURIComponent(group.iri)}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userIri: personIri }),
            });
            setMembers((m) => [...new Set([...m, personIri])]);
            await queryClient.invalidateQueries({
                queryKey: ["organizations", "members", selectedOrg],
            });
            toastSuccess("Membre ajouté au groupe.");
        } catch (error) {
            toastError("Impossible d'ajouter ce membre.");
        }
    };

    const removeMember = async (personIri: string) => {
        try {
            await api(`/groups/${encodeURIComponent(group.iri)}/members/${encodeURIComponent(personIri)}`, {
                method: "DELETE",
            });
            setMembers((m) => m.filter((x) => x !== personIri));
            await queryClient.invalidateQueries({
                queryKey: ["organizations", "members", selectedOrg],
            });
            toastSuccess("Membre retiré du groupe.");
        } catch (error) {
            toastError("Impossible de retirer ce membre.");
        }
    };

    const saveAndClose = async () => {
        try {
            let changed = false;
            if (isOwner) {
                if (label !== group.label) {
                    await patchLabel();
                    changed = true;
                }
                if (selectedOrg && selectedOrg !== group.organizationIri) {
                    await api(`/groups/${encodeURIComponent(group.iri)}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ organizationIri: selectedOrg }),
                    });
                    await queryClient.invalidateQueries({
                        queryKey: ["organizations", "members", selectedOrg],
                    });
                    changed = true;
                }
            }
            if (changed) {
                toastSuccess("Modifications enregistrées.");
            }
            onReload();
            onClose();
        } catch (error) {
            toastError("Impossible de mettre à jour le groupe.");
        }
    };

    const deletable = isOwner && members.length === 1; // only owner left

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="card w-[28rem] max-h-[80vh] overflow-y-auto space-y-4">
                <header className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Détails du groupe</h3>
                    <button onClick={onClose}>
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </header>

                <div className="space-y-3">
                    <label className="block text-sm font-medium">Organisation</label>
                    <select
                        className="input w-full"
                        disabled={!isOwner}
                        value={selectedOrg}
                        onChange={(e) => setSelectedOrg(e.target.value)}>
                        <option value="">— choisir —</option>
                        {organizations.map((o) => (
                            <option key={o.iri} value={o.iri}>
                                {o.label}
                            </option>
                        ))}
                    </select>

                    <label className="block text-sm font-medium">Nom</label>
                    <input
                        className="input w-full"
                        disabled={!isOwner}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                    />

                    <label className="block text-sm font-medium">Membres</label>
                    <ul className="space-y-1 border rounded p-2">
                        {members.map((m) => {
                            const person = personOptions.find(
                                (p) => p.id.toLowerCase() === m.toLowerCase()
                            );
                            const display = person?.display || formatLabel(m);
                            return (
                                <li
                                    key={m}
                                    className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded px-2 py-1">
									<span className="text-xs flex items-center gap-1">
										{display}
                                        {m === group.createdBy && (
                                            <span className="ml-1 text-[10px] text-gray-400 italic">
												(owner)
											</span>
                                        )}
									</span>
                                    {isOwner && m !== currentUserIri && (
                                        <button
                                            title="Retirer"
                                            onClick={() => removeMember(m)}
                                            className="text-red-600 hover:text-red-800">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>

                    {isOwner && (
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
                                disabled={memberOptionsLoading}>
                                <option value="">— choisir —</option>
                                {personOptions
                                    .filter((p) => !members.includes(p.id))
                                    .map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.display}
                                        </option>
                                    ))}
                            </select>
                        </>
                    )}
                </div>

                <footer className="flex justify-end gap-3 pt-2">
                    {deletable && (
                        <button
                            className="btn-secondary text-red-600 border-red-400 hover:bg-red-50 disabled:opacity-40"
                            disabled={deleting}
                            onClick={async () => {
                                try {
                                    await onDeleteGroup(group.iri);
                                    onReload();
                                    onClose();
                                } catch (error) {
                                    /* le toast est géré par la mutation */
                                }
                            }}>
                            {deleting ? "Suppression…" : "Supprimer le groupe"}
                        </button>
                    )}
                    <button className="btn-primary" onClick={saveAndClose}>
                        Terminer
                    </button>
                </footer>
            </div>
        </div>
    );
}
