import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
import CommentFormModal from "../components/comment/CommentFormModal";
import IndividualFormModal from "../components/individuals/IndividualFormModal";
import Modal from "../components/individuals/Modal";
import IndividualsPanel from "../components/individuals/IndividualsPanel";
import OntologyGraph from "../components/OntologyGraph";
export default function OntologyPage() {
    const { token } = useAuth();
    const api = useApi();
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hoveredClassId, setHoveredClassId] = useState(null);
    const [clickedClassId, setClickedClassId] = useState(() => {
        return localStorage.getItem("lastClassId") || null;
    });
    const activeClassId = hoveredClassId || clickedClassId;
    const [modalStack, setModalStack] = useState([]);
    const openModal = (ind) => setModalStack((prev) => [...prev, ind]);
    const closeModal = () => setModalStack((prev) => prev.slice(0, prev.length - 1));
    const [formInfo, setFormInfo] = useState(null);
    // Sidebar width
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem("sidebarWidth");
        return saved ? Number(saved) : Math.floor(window.innerWidth * 0.33);
    });
    const [commentTarget, setCommentTarget] = useState(null);
    const startDrag = (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const init = sidebarWidth;
        const onMove = (ev) => {
            const delta = ev.clientX - startX;
            const newW = Math.min(Math.max(init + delta, 220), window.innerWidth - 320);
            setSidebarWidth(newW);
        };
        const onUp = () => {
            localStorage.setItem("sidebarWidth", String(sidebarWidth));
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };
    const handleClassClick = useCallback((id) => {
        setClickedClassId(id);
        localStorage.setItem("lastClassId", id);
    }, []);
    // Get ontology IRI from querystring
    const params = new URLSearchParams(window.location.search);
    const ontologyIri = params.get("iri") || "";
    // Reset la classe sélectionnée quand on change d’ontologie
    useEffect(() => {
        localStorage.removeItem("lastClassId");
        setClickedClassId(null);
        setHoveredClassId(null);
    }, [ontologyIri]);
    // Charger le snapshot
    useEffect(() => {
        setLoading(true);
        api(`/ontologies/${encodeURIComponent(ontologyIri)}/snapshot`)
            .then((r) => r.json())
            .then((data) => setSnapshot({ ...data }))
            .catch(console.error)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ontologyIri, token]);
    const reloadSnapshot = () => api(`/ontologies/${encodeURIComponent(ontologyIri)}/snapshot`)
        .then((r) => r.json())
        .then(setSnapshot);
    if (loading || !snapshot) {
        return (_jsx("div", { className: "flex items-center justify-center h-screen", children: "Chargement des donn\u00E9es\u2026" }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(IndividualsPanel, { snapshot: snapshot, classId: activeClassId, onShow: openModal, onCreate: (cid) => setFormInfo({ mode: "create", classId: cid }), onEdit: (ind) => setFormInfo({ mode: "edit", initial: ind }), width: sidebarWidth, onDelete: (ind) => {
                    api(`/individuals/${encodeURIComponent(ind.id)}?ontology=${encodeURIComponent(ontologyIri)}`, { method: "DELETE" })
                        .then(reloadSnapshot)
                        .catch(console.error);
                }, onAddComment: function (_ind) {
                    console.warn("onAddComment non implémenté (utiliser CommentFormModal si besoin)");
                } }), _jsx("div", { onMouseDown: startDrag, className: "cursor-ew-resize w-2 min-h-full bg-[radial-gradient(circle,_#cbd5e1_1px,transparent_1px)] [background-size:4px_4px]" }), _jsx("div", { className: "w-2" }), _jsx("div", { className: "flex-grow card pl-2 min-h-0", children: _jsx(OntologyGraph, { graph: snapshot.graph, onClassHover: setHoveredClassId, onClassClick: handleClassClick }) }), modalStack.map((ind, idx) => (_jsx(Modal, { zIndex: 50 + idx, individual: ind, snapshot: snapshot, onShow: openModal, onClose: closeModal }, ind.id))), formInfo && (_jsx(IndividualFormModal, { ontologyIri: ontologyIri, snapshot: snapshot, initial: formInfo.initial, activeClassId: activeClassId || "", onClose: () => setFormInfo(null), onSubmit: (payload) => {
                    const urlBase = `/individuals`;
                    let req;
                    if (payload.mode === "create") {
                        req = api(urlBase, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                id: `http://example.org/va#${payload.label.replaceAll(" ", "")}`,
                                label: payload.label,
                                classId: payload.classId,
                                properties: payload.properties,
                                ontologyIri,
                                visibleToGroups: payload.visibleToGroups ?? [],
                            }),
                        });
                    }
                    else if (payload.mode === "update") {
                        req = api(`${urlBase}/${encodeURIComponent(payload.iri)}?ontology=${encodeURIComponent(ontologyIri)}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                addProps: [
                                    { predicate: "http://www.w3.org/2000/01/rdf-schema#label", value: payload.label, isLiteral: true },
                                    ...payload.properties,
                                ],
                                visibleToGroups: payload.visibleToGroups,
                            }),
                        });
                    }
                    else {
                        // delete
                        req = api(`${urlBase}/${encodeURIComponent(payload.iri)}?ontology=${encodeURIComponent(ontologyIri)}`, { method: "DELETE" });
                    }
                    req
                        .then(() => reloadSnapshot())
                        .catch(console.error)
                        .finally(() => setFormInfo(null));
                } })), commentTarget && (_jsx(CommentFormModal, { parentInd: commentTarget, onClose: () => setCommentTarget(null), onSaved: reloadSnapshot }))] }));
}
