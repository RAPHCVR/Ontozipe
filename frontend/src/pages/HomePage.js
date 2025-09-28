import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
import SimpleModal from "../components/SimpleModal";
import { useOntologies, useProfile } from "../hooks/apiQueries";
export default function HomePage() {
    const queryClient = useQueryClient();
    const { token } = useAuth();
    const payload = token ? JSON.parse(atob(token.split(".")[1])) : {};
    const username = payload.name || payload.email || "Utilisateur";
    const profileQuery = useProfile();
    const ontologiesQuery = useOntologies();
    const api = useApi();
    const [showNew, setShowNew] = useState(false);
    const [newLabel, setNewLabel] = useState("");
    const [newIri, setNewIri] = useState("");
    const [rdfFile, setRdfFile] = useState(null);
    const navigate = useNavigate();
    const handleFile = (e) => {
        const file = e.target.files?.[0] || null;
        setRdfFile(file);
    };
    const roles = profileQuery.data?.roles ?? [];
    const isSuperAdmin = roles.some((r) => r.endsWith("SuperAdminRole"));
    const rolesLoaded = !profileQuery.isLoading && !profileQuery.isFetching;
    const ontos = (ontologiesQuery.data ?? []);
    if (ontologiesQuery.isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-screen", children: "Chargement\u2026" }));
    }
    if (ontologiesQuery.isError) {
        return (_jsx("div", { className: "flex items-center justify-center h-screen", children: _jsx("div", { className: "text-sm text-red-500", children: "Impossible de charger les ontologies." }) }));
    }
    return (_jsxs(_Fragment, { children: [_jsx("section", { className: "w-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 dark:from-slate-800 dark:to-slate-700 text-white mb-8", children: _jsxs("div", { className: "max-w-7xl mx-auto py-12 px-6", children: [_jsxs("h1", { className: "text-3xl md:text-4xl font-bold", children: ["Bonjour, ", _jsx("span", { className: "text-yellow-300", children: username }), " !"] }), _jsx("p", { className: "mt-2 opacity-90", children: "S\u00E9lectionnez une ontologie ou cr\u00E9ez-en une nouvelle." }), rolesLoaded && isSuperAdmin && (_jsx("button", { className: "btn-primary mt-6", onClick: () => setShowNew(true), children: "+ Nouvelle ontologie" }))] }) }), _jsx("div", { className: "max-w-7xl mx-auto px-6 mb-16", children: _jsx("div", { className: "overflow-x-auto rounded-lg shadow ring-1 ring-black/5", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200 dark:divide-slate-700", children: [_jsx("thead", { className: "bg-gray-50 dark:bg-slate-800/60", children: _jsxs("tr", { className: "text-xs font-semibold uppercase tracking-wider text-left", children: [_jsx("th", { className: "px-4 py-3", children: "Ontologie" }), _jsx("th", { className: "px-4 py-3 w-32 text-center", children: "Actions" })] }) }), _jsxs("tbody", { className: "bg-white dark:bg-slate-800 divide-y dark:divide-slate-700", children: [ontos.map((o) => (_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-slate-700/60", children: [_jsx("td", { className: "px-4 py-3 whitespace-nowrap", children: o.label || o.iri.split(/[#/]/).pop() || o.iri }), _jsxs("td", { className: "px-4 py-2 text-center space-x-2", children: [_jsx(Link, { to: `/ontology?iri=${encodeURIComponent(o.iri)}`, className: "btn-primary !py-0.5 !px-2 text-xs", title: "Ouvrir", children: "Ouvrir" }), _jsx("button", { onClick: () => alert("config à implémenter"), title: "Configurer", className: "btn-secondary !py-0.5 !px-2 text-xs", children: "\u2699" }), _jsx("button", { onClick: () => navigate(`/groups?ontology=${encodeURIComponent(o.iri)}`), title: "Groupes", className: "btn-secondary !py-0.5 !px-2 text-xs", children: "\uD83D\uDC65" })] })] }, o.iri))), ontos.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 2, className: "px-4 py-8 text-center text-sm text-gray-500", children: "Aucune ontologie visible pour le moment." }) }))] })] }) }) }), showNew && isSuperAdmin && (_jsx(SimpleModal, { title: "Nouvelle ontologie", onClose: () => {
                    setShowNew(false);
                    setNewLabel("");
                    setNewIri("");
                    setRdfFile(null);
                }, onSubmit: () => {
                    const fd = new FormData();
                    fd.append("iri", newIri.trim());
                    fd.append("label", newLabel.trim());
                    if (rdfFile)
                        fd.append("file", rdfFile);
                    api("/ontologies", {
                        method: "POST",
                        body: fd,
                    })
                        .then(async () => {
                        await queryClient.invalidateQueries({ queryKey: ["ontologies"] });
                    })
                        .finally(() => {
                        setShowNew(false);
                        setNewLabel("");
                        setNewIri("");
                        setRdfFile(null);
                    });
                }, disableSubmit: !newLabel.trim() || !newIri.trim(), children: _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Label" }), _jsx("input", { className: "input", value: newLabel, onChange: (e) => setNewLabel(e.target.value), placeholder: "Nom lisible" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "IRI" }), _jsx("input", { className: "input", value: newIri, onChange: (e) => setNewIri(e.target.value), placeholder: "http://example.org/monOnto" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "L\u2019IRI doit \u00EAtre unique dans votre triple store." })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Fichier RDF / TTL (optionnel)" }), _jsx("input", { type: "file", accept: ".ttl,.rdf,.owl,.nt,.nq,.trig,.jsonld", onChange: handleFile, className: "block w-full text-sm text-gray-700 dark:text-gray-200" }), rdfFile && (_jsxs("p", { className: "text-xs text-green-600 mt-1", children: ["Fichier s\u00E9lectionn\u00E9 : ", rdfFile.name, " (", (rdfFile.size / 1024).toFixed(1), " kio)"] }))] })] }) }))] }));
}
