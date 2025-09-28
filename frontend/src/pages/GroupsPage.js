import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { XMarkIcon, TrashIcon, EyeIcon } from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";
// util pour encoder un IRI dans les URL
const enc = encodeURIComponent;
import { useApi } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatLabel } from "../utils/formatLabel";
import { useGroups, useOrganizationMembers, useOrganizations, useProfile, } from "../hooks/apiQueries";
export default function GroupsPage() {
    const queryClient = useQueryClient();
    const api = useApi();
    const { user } = useAuth();
    const currentUserIri = user?.sub;
    const profileQuery = useProfile();
    const roles = profileQuery.data?.roles ?? [];
    const isSuperAdmin = roles.some((r) => r.endsWith("SuperAdminRole"));
    const isRolesLoaded = !profileQuery.isLoading && !profileQuery.isFetching;
    const groupsQuery = useGroups();
    const groups = useMemo(() => (groupsQuery.data ?? []).map((g) => ({
        iri: g.iri,
        label: g.label,
        createdBy: g.createdBy,
        members: g.members ?? [],
        organizationIri: g.organizationIri,
    })), [groupsQuery.data]);
    const organizationsScope = isSuperAdmin ? "all" : "mine";
    const organizationsQuery = useOrganizations(organizationsScope, {
        enabled: isRolesLoaded,
    });
    const organizations = useMemo(() => (organizationsQuery.data ?? []).map((org) => ({
        iri: org.iri,
        label: org.label ?? org.iri.split(/[#/]/).pop() ?? org.iri,
    })), [organizationsQuery.data]);
    const [showNew, setShowNew] = useState(false);
    const [selected, setSelected] = useState(null);
    const refreshGroups = () => queryClient.invalidateQueries({ queryKey: ["groups"] });
    const refreshOrganizations = () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationsScope] });
    return (_jsxs("div", { className: "container mx-auto py-8 space-y-6", children: [_jsxs("h1", { className: "text-2xl font-semibold flex justify-between items-center", children: ["Groupes (", groups.length, ")", currentUserIri && isRolesLoaded && (_jsx("button", { className: "btn-primary", onClick: () => setShowNew(true), children: "+ Nouveau" }))] }), _jsx("ul", { className: "grid md:grid-cols-2 gap-4", children: groups.map((g) => (_jsxs("li", { className: "card space-y-2 shadow-sm", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "font-medium", children: formatLabel(g.label) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { title: "Voir", className: "text-indigo-600 hover:text-indigo-800", onClick: () => setSelected(g), children: _jsx(EyeIcon, { className: "w-4 h-4" }) }), g.createdBy === currentUserIri && (_jsx("button", { title: "Supprimer", className: "text-red-600 text-sm", onClick: () => api(`/groups/${encodeURIComponent(g.iri)}`, { method: "DELETE" }).then(refreshGroups), children: "\uD83D\uDDD1" }))] })] }), _jsxs("p", { className: "text-xs text-gray-500", children: ["Membres\u00A0: ", g.members?.length ?? 0, " "] })] }, g.iri))) }), showNew && (_jsx(GroupFormModal, { currentUserIri: currentUserIri, organizations: organizations, organizationsLoading: organizationsQuery.isLoading, onClose: () => setShowNew(false), onSaved: () => {
                    refreshGroups();
                    refreshOrganizations();
                } })), selected && (_jsx(GroupDetailsModal, { group: selected, currentUserIri: currentUserIri, organizations: organizations, onClose: () => setSelected(null), onReload: () => {
                    refreshGroups();
                    refreshOrganizations();
                } }))] }));
}
function GroupFormModal({ currentUserIri, organizations, organizationsLoading, onClose, onSaved, }) {
    const api = useApi();
    const [label, setLabel] = useState("");
    const [selectedOrg, setSelectedOrg] = useState("");
    const [selected, setSelected] = useState([]);
    const disabled = label.trim() === "" || !selectedOrg;
    useEffect(() => {
        if (!selectedOrg && organizations.length > 0) {
            setSelectedOrg(organizations[0].iri);
        }
    }, [organizations, selectedOrg]);
    const { data: members = [], isFetching: membersLoading } = useOrganizationMembers(selectedOrg, { enabled: Boolean(selectedOrg) });
    const personOptions = useMemo(() => members.map((u) => {
        const iri = u.id ?? u.iri;
        const email = u.properties?.find((p) => p.predicate?.endsWith("#email"))?.value;
        return {
            id: iri,
            label: u.label ?? iri.split(/[#/]/).pop(),
            display: email ?? u.label ?? iri.split(/[#/]/).pop(),
        };
    }), [members]);
    useEffect(() => {
        if (!selectedOrg) {
            setSelected([]);
            return;
        }
        setSelected((prev) => {
            const hasCurrent = prev.includes(currentUserIri);
            const memberListHasCurrent = members.some((u) => (u.id ?? u.iri) === currentUserIri);
            if (memberListHasCurrent && !hasCurrent) {
                return [...prev, currentUserIri];
            }
            if (!memberListHasCurrent && hasCurrent) {
                return prev.filter((id) => id !== currentUserIri);
            }
            return prev;
        });
    }, [members, currentUserIri, selectedOrg]);
    const save = () => api("/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            label,
            organizationIri: selectedOrg,
            members: selected,
        }),
    })
        .then(onSaved)
        .finally(onClose);
    return (_jsx("div", { className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50", children: _jsxs("div", { className: "card w-[26rem] space-y-4", children: [_jsx("h3", { className: "font-semibold text-lg", children: "Nouveau groupe" }), _jsxs("select", { className: "input w-full", value: selectedOrg, onChange: (e) => setSelectedOrg(e.target.value), disabled: organizationsLoading || organizations.length === 0, children: [_jsx("option", { value: "", children: "\u2014 Choisir une organisation \u2014" }), organizations.map((o) => (_jsx("option", { value: o.iri, children: o.label }, o.iri)))] }), _jsx("input", { className: "input w-full", placeholder: "Nom du groupe", value: label, onChange: (e) => setLabel(e.target.value) }), selectedOrg && (_jsxs("div", { className: "space-y-1 max-h-40 overflow-y-auto border rounded p-2", children: [membersLoading && (_jsx("p", { className: "text-xs text-gray-500", children: "Chargement des membres\u2026" })), !membersLoading && personOptions.length === 0 && (_jsx("p", { className: "text-xs text-gray-500", children: "Aucun membre disponible pour cette organisation." })), personOptions.map((p) => (_jsxs("label", { className: `flex items-center gap-2 text-xs p-1 rounded cursor-pointer ${selected.includes(p.id)
                                ? "bg-indigo-100 dark:bg-slate-700"
                                : "hover:bg-indigo-50 dark:hover:bg-slate-800"}`, children: [_jsx("input", { type: "checkbox", className: "accent-indigo-600", checked: selected.includes(p.id), onChange: (e) => setSelected((prev) => e.target.checked
                                        ? [...prev, p.id]
                                        : prev.filter((x) => x !== p.id)) }), p.display] }, p.id)))] })), _jsxs("div", { className: "flex justify-end gap-4", children: [_jsx("button", { className: "btn-secondary", onClick: onClose, children: "Annuler" }), _jsx("button", { className: `btn-primary ${disabled ? "opacity-50 cursor-not-allowed" : ""}`, onClick: save, disabled: disabled, children: "Cr\u00E9er" })] })] }) }));
}
function GroupDetailsModal({ group, currentUserIri, organizations, onClose, onReload, }) {
    const api = useApi();
    const queryClient = useQueryClient();
    const isOwner = group.createdBy === currentUserIri;
    const [label, setLabel] = useState(group.label);
    const [members, setMembers] = useState(group.members);
    const [selectedOrg, setSelectedOrg] = useState(group.organizationIri ?? "");
    useEffect(() => {
        if (!selectedOrg && organizations.length > 0) {
            setSelectedOrg(organizations[0].iri);
        }
    }, [organizations, selectedOrg]);
    const { data: orgMembers = [], isFetching: memberOptionsLoading } = useOrganizationMembers(selectedOrg, { enabled: Boolean(selectedOrg) });
    const personOptions = useMemo(() => orgMembers.map((u) => {
        const iri = u.id ?? u.iri;
        const email = u.properties?.find((p) => p.predicate?.endsWith("#email"))?.value;
        return {
            id: iri,
            display: email ?? u.label ?? iri.split(/[#/]/).pop(),
        };
    }), [orgMembers]);
    /* ----- Mutations ----- */
    const patchLabel = async () => {
        if (label === group.label)
            return;
        await api(`/groups/${encodeURIComponent(group.iri)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label }),
        });
    };
    const addMember = async (personIri) => {
        await api(`/groups/${encodeURIComponent(group.iri)}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIri: personIri }),
        });
        setMembers((m) => [...new Set([...m, personIri])]);
        await queryClient.invalidateQueries({
            queryKey: ["organizations", "members", selectedOrg],
        });
    };
    const removeMember = async (personIri) => {
        await api(`/groups/${encodeURIComponent(group.iri)}/members/${encodeURIComponent(personIri)}`, { method: "DELETE" });
        setMembers((m) => m.filter((x) => x !== personIri));
        await queryClient.invalidateQueries({
            queryKey: ["organizations", "members", selectedOrg],
        });
    };
    const saveAndClose = async () => {
        try {
            if (isOwner) {
                if (label !== group.label)
                    await patchLabel();
                if (selectedOrg && selectedOrg !== group.organizationIri) {
                    await api(`/groups/${encodeURIComponent(group.iri)}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ organizationIri: selectedOrg }),
                    });
                    await queryClient.invalidateQueries({
                        queryKey: ["organizations", "members", selectedOrg],
                    });
                }
            }
            onReload();
        }
        finally {
            onClose();
        }
    };
    const deletable = isOwner && members.length === 1; // only owner left
    return (_jsx("div", { className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50", children: _jsxs("div", { className: "card w-[28rem] max-h-[80vh] overflow-y-auto space-y-4", children: [_jsxs("header", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "font-semibold text-lg", children: "D\u00E9tails du groupe" }), _jsx("button", { onClick: onClose, children: _jsx(XMarkIcon, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("label", { className: "block text-sm font-medium", children: "Organisation" }), _jsxs("select", { className: "input w-full", disabled: !isOwner, value: selectedOrg, onChange: (e) => setSelectedOrg(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 choisir \u2014" }), organizations.map((o) => (_jsx("option", { value: o.iri, children: o.label }, o.iri)))] }), _jsx("label", { className: "block text-sm font-medium", children: "Nom" }), _jsx("input", { className: "input w-full", disabled: !isOwner, value: label, onChange: (e) => setLabel(e.target.value) }), _jsx("label", { className: "block text-sm font-medium", children: "Membres" }), _jsx("ul", { className: "space-y-1 border rounded p-2", children: members.map((m) => {
                                const person = personOptions.find((p) => p.id.toLowerCase() === m.toLowerCase());
                                const display = person?.display || formatLabel(m);
                                return (_jsxs("li", { className: "flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded px-2 py-1", children: [_jsxs("span", { className: "text-xs flex items-center gap-1", children: [display, m === group.createdBy && (_jsx("span", { className: "ml-1 text-[10px] text-gray-400 italic", children: "(owner)" }))] }), isOwner && m !== currentUserIri && (_jsx("button", { title: "Retirer", onClick: () => removeMember(m), className: "text-red-600 hover:text-red-800", children: _jsx(TrashIcon, { className: "w-4 h-4" }) }))] }, m));
                            }) }), isOwner && (_jsxs(_Fragment, { children: [_jsx("label", { className: "block text-sm font-medium", children: "Ajouter un membre" }), _jsxs("select", { className: "input", onChange: (e) => {
                                        const iri = e.target.value;
                                        if (!iri)
                                            return;
                                        addMember(iri);
                                        e.target.value = "";
                                    }, disabled: memberOptionsLoading, children: [_jsx("option", { value: "", children: "\u2014 choisir \u2014" }), personOptions
                                            .filter((p) => !members.includes(p.id))
                                            .map((p) => (_jsx("option", { value: p.id, children: p.display }, p.id)))] })] }))] }), _jsxs("footer", { className: "flex justify-end gap-3 pt-2", children: [deletable && (_jsx("button", { className: "btn-secondary text-red-600 border-red-400 hover:bg-red-50", onClick: async () => {
                                await api(`/groups/${encodeURIComponent(group.iri)}`, { method: "DELETE" });
                                onReload();
                                onClose();
                            }, children: "Supprimer le groupe" })), _jsx("button", { className: "btn-primary", onClick: saveAndClose, children: "Terminer" })] })] }) }));
}
