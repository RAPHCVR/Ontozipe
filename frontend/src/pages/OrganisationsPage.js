import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { XMarkIcon, PlusIcon, EyeIcon } from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatLabel } from "../utils/formatLabel";
import { useOrganizationMembers, useOrganizations, usePersons, useProfile, } from "../hooks/apiQueries";
/** Page de gestion des organisations (super‑admin only) */
export default function OrganisationsPage() {
    const api = useApi();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const currentUserIri = user?.sub;
    const profileQuery = useProfile();
    const roles = profileQuery.data?.roles ?? [];
    const isSuperAdmin = roles.some((r) => r.endsWith("SuperAdminRole"));
    const rolesLoaded = !profileQuery.isLoading && !profileQuery.isFetching;
    const organizationsScope = isSuperAdmin ? "all" : "mine";
    const organizationsQuery = useOrganizations(organizationsScope, {
        enabled: rolesLoaded,
    });
    const orgs = useMemo(() => (organizationsQuery.data ?? []).map((o) => ({
        iri: o.iri,
        label: o.label,
        owner: o.owner,
        createdAt: o.createdAt,
    })), [organizationsQuery.data]);
    const personsQuery = usePersons();
    const persons = useMemo(() => (personsQuery.data ?? []).map((u) => ({
        id: u.id,
        display: u.properties?.find((p) => p.predicate.endsWith("#name"))
            ?.value ||
            u.properties?.find((p) => p.predicate.endsWith("#email"))
                ?.value ||
            u.label ||
            u.id.split(/[#/]/).pop(),
    })), [personsQuery.data]);
    const [showNew, setShowNew] = useState(false);
    const [selected, setSelected] = useState(null);
    const refreshOrganizations = () => queryClient.invalidateQueries({
        queryKey: ["organizations", organizationsScope],
    });
    return (_jsxs("div", { className: "container mx-auto py-8 space-y-6", children: [_jsxs("h1", { className: "text-2xl font-semibold flex justify-between items-center", children: ["Organisations (", orgs.length, ")", isSuperAdmin && currentUserIri && (_jsxs("button", { className: "btn-primary flex items-center gap-1", onClick: () => setShowNew(true), children: [_jsx(PlusIcon, { className: "w-4 h-4" }), "Nouvelle"] }))] }), _jsxs("ul", { className: "grid md:grid-cols-2 gap-4", children: [organizationsQuery.isLoading && (_jsx("li", { className: "text-sm text-gray-500", children: "Chargement\u2026" })), !organizationsQuery.isLoading &&
                        orgs.map((o) => (_jsxs("li", { className: "card space-y-2 shadow-sm", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "font-medium", children: formatLabel(o.label ?? o.iri) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { title: "Voir", className: "text-indigo-600 hover:text-indigo-800", onClick: () => setSelected(o), children: _jsx(EyeIcon, { className: "w-4 h-4" }) }), isSuperAdmin && (_jsx("button", { title: "Supprimer", className: "text-red-600 text-sm", onClick: () => api(`/organizations/${encodeURIComponent(o.iri)}`, { method: "DELETE" }).then(refreshOrganizations), children: "\uD83D\uDDD1" }))] })] }), _jsxs("p", { className: "text-xs text-gray-500", children: ["Admin\u00A0:", " ", persons.find((p) => p.id === o.owner)?.display ||
                                            formatLabel(o.owner.split(/[#/]/).pop())] })] }, o.iri)))] }), showNew && (_jsx(OrganisationFormModal, { onClose: () => setShowNew(false), onSaved: refreshOrganizations, persons: persons, personsLoading: personsQuery.isLoading })), selected && (_jsx(OrganisationDetailsModal, { org: selected, isSuperAdmin: isSuperAdmin || false, isManager: isSuperAdmin || selected.owner === currentUserIri, onClose: () => setSelected(null), onReload: refreshOrganizations, persons: persons, personsLoading: personsQuery.isLoading }))] }));
}
function OrganisationFormModal({ onClose, onSaved, persons, personsLoading, }) {
    const api = useApi();
    const [label, setLabel] = useState("");
    const [owner, setOwner] = useState("");
    const disabled = label.trim() === "" || owner === "";
    const save = () => api("/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, ownerIri: owner }),
    })
        .then(onSaved)
        .finally(onClose);
    return (_jsx("div", { className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50", children: _jsxs("div", { className: "card w-[26rem] space-y-4", children: [_jsx("h3", { className: "font-semibold text-lg", children: "Nouvelle organisation" }), _jsx("input", { className: "input", placeholder: "Nom de l'organisation", value: label, onChange: (e) => setLabel(e.target.value) }), _jsxs("select", { className: "input", value: owner, onChange: (e) => setOwner(e.target.value), disabled: personsLoading, children: [_jsx("option", { value: "", children: "\u2014 Choisir un admin \u2014" }), persons.map((p) => (_jsx("option", { value: p.id, children: p.display }, p.id)))] }), _jsxs("div", { className: "flex justify-end gap-4", children: [_jsx("button", { className: "btn-secondary", onClick: onClose, children: "Annuler" }), _jsx("button", { className: `btn-primary ${disabled ? "opacity-50 cursor-not-allowed" : ""}`, disabled: disabled, onClick: save, children: "Cr\u00E9er" })] })] }) }));
}
function OrganisationDetailsModal({ org, isSuperAdmin, isManager, onClose, onReload, persons, personsLoading, }) {
    const api = useApi();
    const queryClient = useQueryClient();
    const [label, setLabel] = useState(org.label || "");
    const [owner, setOwner] = useState(org.owner);
    const [members, setMembers] = useState([]);
    const canEditLabelAdmin = isSuperAdmin;
    const canManageMembers = isSuperAdmin || isManager;
    const { data: memberList = [], isFetching: membersLoading } = useOrganizationMembers(org.iri, { enabled: true });
    useEffect(() => {
        setMembers(memberList.map((m) => m.iri));
    }, [memberList]);
    const save = async () => {
        const payload = {};
        if (canEditLabelAdmin)
            payload.label = label;
        if (canEditLabelAdmin)
            payload.ownerIri = owner;
        await api(`/organizations/${encodeURIComponent(org.iri)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        onReload();
        onClose();
    };
    const addMember = async (personIri) => {
        await api(`/organizations/${encodeURIComponent(org.iri)}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIri: personIri }),
        });
        setMembers((m) => [...new Set([...m, personIri])]);
        await queryClient.invalidateQueries({
            queryKey: ["organizations", "members", org.iri],
        });
    };
    const removeMember = async (personIri) => {
        await api(`/organizations/${encodeURIComponent(org.iri)}/members/${encodeURIComponent(personIri)}`, { method: "DELETE" });
        setMembers((m) => m.filter((x) => x !== personIri));
        await queryClient.invalidateQueries({
            queryKey: ["organizations", "members", org.iri],
        });
    };
    const availablePersons = useMemo(() => persons.filter((p) => !members.includes(p.id)), [persons, members]);
    return (_jsx("div", { className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50", children: _jsxs("div", { className: "card w-[28rem] space-y-4", children: [_jsxs("header", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "font-semibold text-lg", children: "Organisation" }), _jsx("button", { onClick: onClose, children: _jsx(XMarkIcon, { className: "w-5 h-5" }) })] }), _jsx("label", { className: "block text-sm font-medium", children: "Nom" }), _jsx("input", { className: "input w-full", value: label, onChange: (e) => setLabel(e.target.value), disabled: !canEditLabelAdmin }), _jsx("label", { className: "block text-sm font-medium", children: "Admin" }), _jsx("select", { className: "input", value: owner, onChange: (e) => setOwner(e.target.value), disabled: !canEditLabelAdmin || personsLoading, children: persons.map((p) => (_jsx("option", { value: p.id, children: p.display }, p.id))) }), _jsx("label", { className: "block text-sm font-medium mt-2", children: "Membres" }), _jsxs("ul", { className: "space-y-1 border rounded p-2 max-h-40 overflow-y-auto", children: [members.map((m) => {
                            const disp = persons.find((p) => p.id === m)?.display || formatLabel(m);
                            return (_jsxs("li", { className: "flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded px-2 py-1 text-xs", children: [_jsx("span", { children: disp }), canManageMembers && (_jsx("button", { title: "Retirer", onClick: () => removeMember(m), className: "text-red-600 hover:text-red-800 text-[10px]", children: "\uD83D\uDDD1" }))] }, m));
                        }), members.length === 0 && !membersLoading && (_jsx("li", { className: "text-xs text-gray-500", children: "Aucun membre pour l\u2019instant." })), membersLoading && (_jsx("li", { className: "text-xs text-gray-500", children: "Chargement\u2026" }))] }), canManageMembers && (_jsxs(_Fragment, { children: [_jsx("label", { className: "block text-sm font-medium", children: "Ajouter un membre" }), _jsxs("select", { className: "input", onChange: (e) => {
                                const iri = e.target.value;
                                if (!iri)
                                    return;
                                addMember(iri);
                                e.target.value = "";
                            }, disabled: membersLoading || personsLoading, children: [_jsx("option", { value: "", children: "\u2014 choisir \u2014" }), availablePersons.map((p) => (_jsx("option", { value: p.id, children: p.display }, p.id)))] })] })), _jsxs("footer", { className: "flex justify-end gap-3 pt-2", children: [isSuperAdmin && (_jsx("button", { className: "btn-secondary text-red-600 border-red-400 hover:bg-red-50", onClick: async () => {
                                await api(`/organizations/${encodeURIComponent(org.iri)}`, {
                                    method: "DELETE",
                                });
                                onReload();
                                onClose();
                            }, children: "Supprimer" })), _jsx("button", { className: "btn-primary", onClick: save, children: "Sauvegarder" })] })] }) }));
}
