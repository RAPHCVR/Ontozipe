import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from "react";
import { formatLabel } from "../../utils/formatLabel";
import IndividualCard from "./IndividualCard";
import { useAuth } from "../../auth/AuthContext";
// ---------------------------------------------------------------------------
// Individuals side‑panel
// ---------------------------------------------------------------------------
const IndividualsPanel = ({ snapshot, classId, onShow, onCreate, onEdit, onDelete, onAddComment, width, }) => {
    // ------------------------------------------------------------
    // Auth & user groups
    // ------------------------------------------------------------
    const { user } = useAuth();
    const currentUserIri = user?.sub;
    const userNode = snapshot?.persons.find((p) => p.id === currentUserIri) || undefined;
    const userGroups = userNode?.groups?.map((g) => ({ iri: g.iri, label: g.label })) || [];
    // ------------------------------------------------------------
    // Local UI state
    // ------------------------------------------------------------
    const [search, setSearch] = useState("");
    const [groupFilter, setGroupFilter] = useState("all");
    // ------------------------------------------------------------
    // Memos (toujours exécutés pour garder le même nombre de hooks)
    // ------------------------------------------------------------
    const baseIndividuals = useMemo(() => {
        if (!snapshot || !classId)
            return [];
        return snapshot.individuals.filter((ind) => ind.classId === classId);
    }, [snapshot, classId]);
    // Filtrage par groupe
    const groupFiltered = useMemo(() => {
        if (groupFilter === "all")
            return baseIndividuals;
        return baseIndividuals.filter((ind) => (ind.visibleTo || []).includes(groupFilter));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseIndividuals, groupFilter]);
    // Recherche puissante (label, propriétés, commentaires)
    const normalized = (s) => s.toLowerCase();
    const term = normalized(search.trim());
    const searchedIndividuals = useMemo(() => {
        if (!term)
            return groupFiltered;
        const inLabel = [];
        const inProps = [];
        groupFiltered.forEach((ind) => {
            const labelMatch = normalized(ind.label || "").includes(term);
            let propMatch = false;
            if (!labelMatch) {
                propMatch = (ind.properties || []).some((p) => normalized((p.valueLabel || p.value || "") + " " + (p.predicateLabel || "")).includes(term));
            }
            let commentMatch = false;
            if (!labelMatch && !propMatch && snapshot?.comments) {
                commentMatch = snapshot.comments.some((c) => c.onResource === ind.id && normalized(c.body).includes(term));
            }
            if (labelMatch)
                inLabel.push(ind);
            else if (propMatch || commentMatch)
                inProps.push(ind);
        });
        return [...inLabel, ...inProps];
    }, [groupFiltered, term, snapshot?.comments]);
    if (!snapshot || !classId) {
        return (_jsx("aside", { className: "shrink-0 pr-2", style: { width }, children: _jsx("div", { className: "card h-full flex items-center justify-center text-gray-500", children: "S\u00E9lectionnez une classe" }) }));
    }
    const classLabel = classId
        ? formatLabel(classId.split(/[#/]/).pop() || classId)
        : "";
    return (_jsx("aside", { className: "max-h-full pr-2 flex flex-col shrink-0", style: { width }, children: _jsxs("div", { className: "card flex-1 min-h-0 flex flex-col divide-y divide-gray-200 dark:divide-slate-700 overflow-y-auto", children: [_jsxs("div", { className: "sticky top-0 bg-inherit pt-2 pb-3 space-y-2", children: [_jsxs("select", { value: groupFilter, onChange: (e) => setGroupFilter(e.target.value), className: "border w-full rounded px-2 py-1 text-sm dark:bg-slate-800 dark:border-slate-600", children: [_jsx("option", { value: "all", children: "Tous les groupes" }), userGroups.map((g) => (_jsx("option", { value: g.iri, children: formatLabel(g.label || g.iri.split(/[#/]/).pop() || g.iri) }, g.iri)))] }), _jsx("input", { type: "text", value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Rechercher...", className: "flex-1 w-full border rounded px-2 py-1 text-sm dark:bg-slate-800 dark:border-slate-600" })] }), _jsxs("div", { className: "flex items-center justify-between sticky top-0 bg-inherit py-2", children: [_jsxs("h2", { className: "text-lg font-semibold", children: [classLabel, " (", searchedIndividuals.length, ")"] }), _jsx("button", { title: "Nouvel individu", onClick: () => onCreate(classId), className: "text-indigo-600 hover:text-indigo-800 text-xl leading-none px-2", children: "+" })] }), searchedIndividuals.map((ind, index) => (_jsx(IndividualCard, { ind: ind, snapshot: snapshot, onShow: onShow, onEdit: onEdit, onDelete: onDelete, idx: index }, ind.id)))] }) }));
};
export default IndividualsPanel;
