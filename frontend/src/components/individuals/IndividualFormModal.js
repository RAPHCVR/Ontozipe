import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { useApi } from "../../lib/api";
import { formatLabel } from "../../utils/formatLabel";
const IndividualFormModal = ({ snapshot, ontologyIri, initial = {}, activeClassId = "", onClose, onSubmit, }) => {
    const isEdit = Boolean(initial.id);
    const api = useApi();
    const [label, setLabel] = useState(initial.label || "");
    const [classId, setClassId] = useState(initial?.classId || activeClassId);
    const [dataProps, setDataProps] = useState((initial.properties || []).filter((p) => p.isLiteral));
    const [objProps, setObjProps] = useState((initial.properties || []).filter((p) => !p.isLiteral));
    const [groups, setGroups] = useState([]);
    const [selectedGroups, setSelectedGroups] = useState(initial.visibleToGroups ?? []);
    // --- helper: all subclasses (recursively) of a given class ---
    const getDescendantClasses = useCallback((base) => {
        const set = new Set([base]);
        const stack = [base];
        while (stack.length) {
            const cur = stack.pop();
            snapshot.graph.edges.forEach((e) => {
                if (e.to === cur && !set.has(e.from)) {
                    set.add(e.from);
                    stack.push(e.from);
                }
            });
        }
        return set;
    }, [snapshot.graph.edges]);
    // --- Available properties for this class ---
    const [available, setAvailable] = useState({ dataProps: [], objectProps: [] });
    // fetch when classId changes
    useEffect(() => {
        if (!classId)
            return;
        api(`/ontologies/${encodeURIComponent(ontologyIri)}/properties?class=${encodeURIComponent(classId)}`)
            .then((r) => r.json())
            .then(setAvailable)
            .catch(console.error);
    }, [api, classId, ontologyIri]);
    useEffect(() => {
        api(`/groups`)
            .then((r) => r.json())
            .then((arr) => setGroups(arr))
            .catch(console.error);
    }, [api]);
    const toggleGroup = (iri) => setSelectedGroups((prev) => prev.includes(iri) ? prev.filter((g) => g !== iri) : [...prev, iri]);
    // --- Handlers helpers ----
    const addRow = (setter, isLiteral) => setter((prev) => [...prev, { predicate: "", value: "", isLiteral }]);
    const updateRow = (index, field, value, setter) => setter((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    const removeRow = (index, setter) => setter((prev) => prev.filter((_, i) => i !== index));
    // --- Data properties merge: always show all available dataProps ---
    const dataRows = available.dataProps.map((prop) => {
        const existing = dataProps.find((dp) => dp.predicate === prop.iri);
        return existing || { predicate: prop.iri, value: "", isLiteral: true };
    });
    // --- Submit ---
    const handleSave = () => {
        if (!label.trim())
            return alert("Le label est requis");
        onSubmit({
            mode: isEdit ? "update" : "create",
            iri: isEdit ? String(initial.id) : undefined,
            label,
            classId,
            properties: [...dataProps, ...objProps],
            visibleToGroups: selectedGroups,
        });
        onClose();
    };
    const handleDelete = () => {
        if (!initial.id)
            return;
        if (!confirm("Supprimer définitivement cet individu ?"))
            return;
        onSubmit({
            mode: "delete",
            iri: String(initial.id),
            label,
            classId,
            properties: [],
            visibleToGroups: [],
        });
        onClose();
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-lg w-4/5 max-w-5xl p-6 shadow-lg space-y-4 overflow-y-auto max-h-[90vh]", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: isEdit ? "Modifier Individu" : "Nouvel Individu" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Label" }), _jsx("input", { className: "input w-full", value: label, onChange: (e) => setLabel(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Classe" }), formatLabel(classId.split(/[#/]/).pop() || "")] })] }), _jsxs("section", { children: [_jsx("div", { className: "flex items-center justify-between mb-1", children: _jsx("h4", { className: "text-sm font-semibold text-indigo-500", children: "Propri\u00E9t\u00E9s litt\u00E9rales" }) }), dataRows.map((row, i) => (_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("div", { className: "flex-1", children: row.predicate ? (_jsx("span", { className: "text-xs text-gray-500", children: formatLabel(row.predicate.split(/[#/]/).pop() || row.predicate) })) : null }), _jsx("input", { className: "input flex-1", placeholder: "Valeur", value: row.value, onChange: (e) => {
                                        const val = e.target.value;
                                        setDataProps((prev) => {
                                            const idxFound = prev.findIndex((dp) => dp.predicate === row.predicate);
                                            if (idxFound >= 0) {
                                                const copy = [...prev];
                                                copy[idxFound] = { ...copy[idxFound], value: val };
                                                return copy;
                                            }
                                            return [
                                                ...prev,
                                                { predicate: row.predicate, value: val, isLiteral: true },
                                            ];
                                        });
                                    } })] }, i)))] }), _jsxs("section", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("h4", { className: "text-sm font-semibold text-emerald-600", children: "Relations" }), _jsx("button", { onClick: () => addRow(setObjProps, false), className: "btn-primary text-xs", children: "+ Ajouter" })] }), objProps.map((row, i) => (_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("div", { className: "flex-1", children: row.predicate ? (_jsx("span", { className: "text-xs text-gray-500", children: formatLabel(row.predicate.split(/[#/]/).pop() || row.predicate) })) : null }), _jsxs("select", { className: "input flex-1", value: row.predicate, onChange: (e) => updateRow(i, "predicate", e.target.value, setObjProps), children: [_jsx("option", { value: "", children: "-- Pr\u00E9dicat --" }), available.objectProps.map((p) => (_jsx("option", { value: p.iri, children: formatLabel(p.label) }, p.iri)))] }), _jsxs("select", { className: "input flex-1", value: row.value, onChange: (e) => updateRow(i, "value", e.target.value, setObjProps), children: [_jsx("option", { value: "", children: "-- S\u00E9lectionner Individu --" }), (() => {
                                            const rangeIri = available.objectProps.find((p) => p.iri === row.predicate)?.range?.iri;
                                            const allowed = rangeIri
                                                ? getDescendantClasses(rangeIri)
                                                : null;
                                            return snapshot.individuals
                                                .filter((ind) => !allowed || allowed.has(ind.classId))
                                                .map((ind) => (_jsx("option", { value: ind.id, children: formatLabel(ind.label) }, ind.id)));
                                        })()] }), _jsx("button", { className: "text-red-500 text-sm px-2", onClick: () => removeRow(i, setObjProps), children: "\u2715" })] }, i)))] }), _jsxs("section", { children: [_jsx("h4", { className: "text-sm font-semibold text-purple-600 mb-1", children: "Visibilit\u00E9 \u2013 Groupes autoris\u00E9s" }), groups.length === 0 ? (_jsx("p", { className: "text-xs text-gray-500", children: "Aucun groupe disponible" })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: groups.map((g) => {
                                const checked = selectedGroups.includes(g.iri);
                                return (_jsxs("label", { className: "cursor-pointer rounded px-2 py-1 text-xs border " +
                                        (checked
                                            ? "bg-indigo-600 text-white border-indigo-600"
                                            : "bg-gray-100 dark:bg-slate-700 border-gray-300 dark:border-slate-600"), children: [_jsx("input", { type: "checkbox", className: "sr-only", checked: checked, onChange: () => toggleGroup(g.iri) }), formatLabel(g.label || g.iri.split(/[#/]/).pop() || "")] }, g.iri));
                            }) }))] }), _jsxs("div", { className: "flex justify-between items-center pt-4", children: [isEdit && (_jsx("button", { onClick: handleDelete, className: "btn-danger", children: "Supprimer" })), _jsxs("div", { className: "flex gap-4 ml-auto", children: [_jsx("button", { onClick: onClose, className: "btn-secondary", children: "Annuler" }), _jsx("button", { disabled: !label.trim() || !classId || !ontologyIri, onClick: handleSave, className: "btn-primary disabled:opacity-50 disabled:pointer-events-none", children: isEdit ? "Enregistrer" : "Créer" })] })] })] }) }));
};
export default IndividualFormModal;
