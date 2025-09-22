import { useState, useEffect, useCallback } from "react";
import { XMarkIcon, PlusIcon, EyeIcon } from "@heroicons/react/24/outline";
import { useApi } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatLabel } from "../utils/formatLabel";

type Organisation = {
    iri: string;
    label?: string;
    owner: string; // IRI du user admin/super‑admin désigné
    createdAt: string;
};

type OrganisationDetails = Organisation;

/** Page de gestion des organisations (super‑admin only) */
export default function OrganisationsPage() {
    const api = useApi();
    const { user } = useAuth();
    const currentUserIri = user?.sub;
    const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null); // null = inconnu
    const [orgs, setOrgs] = useState<Organisation[]>([]);
    const [showNew, setShowNew] = useState(false);
    const [selected, setSelected] = useState<OrganisationDetails | null>(null);
    const [persons, setPersons] = useState<PersonOption[]>([]);

    const fetchOrgs = useCallback(async () => {
        if (isSuperAdmin === null) return;
        const url = isSuperAdmin
            ? "/organizations"
            : "/organizations?mine=true";
        const data = await api(url).then((r) => r.json());
        setOrgs(data);
    }, [api, isSuperAdmin]);

    useEffect(() => {
        api("/auth/me")
            .then(res => res.json())
            .then(profile => {
                const roles: string[] = profile.roles || [];
                setIsSuperAdmin(roles.some(r => r.endsWith("SuperAdminRole")));
            })
            .catch(err => {
                console.error("Échec de la récupération du profil utilisateur", err);
                setIsSuperAdmin(false); // Sécurité par défaut
            });
    }, [api]);

    useEffect(() => {
        fetchOrgs();
    }, [fetchOrgs]); // Se redéclenche si isSuperAdmin change

    // Charge la liste de tous les utilisateurs une seule fois pour les modales
    useEffect(() => {
        api("/individuals/persons")
            .then((r) => r.json())
            .then((data) => {
                setPersons(
                    data.map((u: any) => ({
                        id: u.id,
                        display:
                            u.properties?.find((p: any) => p.predicate.endsWith("#name"))
                                ?.value ||
                            u.label ||
                            u.id.split(/[#/]/).pop(),
                    }))
                );
            });
    }, [api]);

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
                {orgs.map((o) => (
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
                                        className="text-red-600 text-sm"
                                        onClick={() =>
                                            api(
                                                `/organizations/${encodeURIComponent(
                                                    o.iri
                                                )}`,
                                                { method: "DELETE" }
                                            ).then(fetchOrgs)
                                        }>
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
                    onSaved={fetchOrgs}
                    existingPersonsEndpoint="/individuals/persons"
                />
            )}

            {selected && (
                <OrganisationDetailsModal
                    org={selected}
                    isSuperAdmin={isSuperAdmin || false}
                    isManager={isSuperAdmin || selected.owner === currentUserIri}
                    onClose={() => setSelected(null)}
                    onReload={fetchOrgs}
                    existingPersonsEndpoint="/individuals/persons"
                />
            )}
        </div>
    );
}

interface PersonOption {
    id: string;
    display: string;
    roles?: string[];
}

function OrganisationFormModal({
                                   onClose,
                                   onSaved,
                                   existingPersonsEndpoint,
                               }: {
    onClose: () => void;
    onSaved: () => void;
    existingPersonsEndpoint: string;
}) {
    const api = useApi();
    const [label, setLabel] = useState("");
    const [owner, setOwner] = useState<string>("");
    const [allPersons, setAllPersons] = useState<PersonOption[]>([]);

    const disabled = label.trim() === "" || owner === "";

    const loadPersons = useCallback(async () => {
        const res = await api(existingPersonsEndpoint);
        const data = await res.json();
        setAllPersons(
            data.map((u: any) => ({
                id: u.id,
                display:
                    u.properties?.find((p: any) => p.predicate.endsWith("name"))?.value ||
                    u.properties?.find((p: any) => p.predicate.endsWith("email"))
                        ?.value ||
                    u.label ||
                    u.id,
            }))
        );
    }, [api, existingPersonsEndpoint]);

    useEffect(() => {
        loadPersons();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // charge une fois à l’ouverture de la modale

    const save = () =>
        api("/organizations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label, ownerIri: owner }),
        })
            .then(onSaved)
            .finally(onClose);

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
                    onChange={(e) => setOwner(e.target.value)}>
                    <option value="">— Choisir un admin —</option>
                    {allPersons.map((p) => (
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
                            disabled ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        disabled={disabled}
                        onClick={save}>
                        Créer
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
                                      existingPersonsEndpoint,
                                  }: {
    org: OrganisationDetails;
    isSuperAdmin: boolean;
    isManager: boolean;
    onClose: () => void;
    onReload: () => void;
    existingPersonsEndpoint: string;
}) {
    const api = useApi();
    const [label, setLabel] = useState(org.label || "");
    const [owner, setOwner] = useState(org.owner);
    const [allPersons, setAllPersons] = useState<PersonOption[]>([]);
    const [members, setMembers] = useState<string[]>([]); // IRIs

    const canEditLabelAdmin = isSuperAdmin;
    const canManageMembers = isManager;

    const loadPersons = useCallback(async () => {
        const res = await api(existingPersonsEndpoint);
        const data = await res.json();
        const mapped = data.map((u: any) => ({
            id: u.id,
            display:
                u.properties?.find((p: any) => p.predicate.endsWith("name"))?.value ||
                u.properties?.find((p: any) => p.predicate.endsWith("email"))?.value ||
                u.label ||
                u.id,
        }));
        setAllPersons(mapped);
    }, [api, existingPersonsEndpoint]);

    const loadMembers = useCallback(async () => {
        const res = await api(
            `/organizations/${encodeURIComponent(
                org.iri
            )}/members`
        );
        const data = await res.json(); // [{ iri, label? }]
        setMembers(data.map((m: any) => m.iri));
    }, [api, org.iri]);

    useEffect(() => {
        loadPersons();
        loadMembers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [org.iri]); // se déclenche uniquement à l’affichage ou changement d’orga

    const save = async () => {
        const payload: any = {};
        if (canEditLabelAdmin) payload.label = label;
        if (canEditLabelAdmin) payload.ownerIri = owner;

        await api(
            `/organizations/${encodeURIComponent(
                org.iri
            )}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            }
        );
        onReload();
        onClose();
    };

    const addMember = async (personIri: string) => {
        await api(
            `/organizations/${encodeURIComponent(
                org.iri
            )}/members`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userIri: personIri }),
            }
        );
        setMembers((m) => [...m, personIri]);
    };

    const removeMember = async (personIri: string) => {
        await api(
            `/organizations/${encodeURIComponent(
                org.iri
            )}/members/${encodeURIComponent(personIri)}`,
            { method: "DELETE" }
        );
        setMembers((m) => m.filter((x) => x !== personIri));
    };

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
                    disabled={!canEditLabelAdmin}>
                    {allPersons.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.display}
                        </option>
                    ))}
                </select>

                <label className="block text-sm font-medium mt-2">Membres</label>
                <ul className="space-y-1 border rounded p-2 max-h-40 overflow-y-auto">
                    {members.map((m) => {
                        const disp =
                            allPersons.find((p) => p.id === m)?.display || formatLabel(m);
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
                            }}>
                            <option value="">— choisir —</option>
                            {allPersons
                                .filter((p) => !members.includes(p.id))
                                .map((p) => (
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
                            className="btn-secondary text-red-600 border-red-400 hover:bg-red-50"
                            onClick={async () => {
                                await api(
                                    `/organizations/${encodeURIComponent(
                                        org.iri
                                    )}`,
                                    { method: "DELETE" }
                                );
                                onReload();
                                onClose();
                            }}>
                            Supprimer
                        </button>
                    )}
                    <button className="btn-primary" onClick={save}>
                        Sauvegarder
                    </button>
                </footer>
            </div>
        </div>
    );
}