import React from "react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
import { useLanguage } from "../language/LanguageContext";
import { useTranslation } from "../language/useTranslation";
import { formatLabel } from "../utils/formatLabel";

import CommentFormModal from "../components/comment/CommentFormModal";
import IndividualFormModal from "../components/individuals/IndividualFormModal";
import Modal from "../components/individuals/Modal";
import { Snapshot, IndividualNode } from "types";
import IndividualsPanel from "../components/individuals/IndividualsPanel";
import OntologyGraph from "../components/OntologyGraph";

const extractHandle = (value: string): string => {
	const hashIdx = value.lastIndexOf("#");
	if (hashIdx >= 0 && hashIdx < value.length - 1) {
		return value.slice(hashIdx + 1);
	}
	const slashIdx = value.lastIndexOf("/");
	if (slashIdx >= 0 && slashIdx < value.length - 1) {
		return value.slice(slashIdx + 1);
	}
	return value;
};

const findMatchingNodeId = (identifier: string, nodes: Array<{ id: string; label?: string }>): string | null => {
	const trimmed = identifier.trim();
	if (!trimmed) return null;
	const lower = trimmed.toLowerCase();

	for (const node of nodes) {
		const idStr = String(node.id);
		if (idStr === trimmed) return idStr;
		const handle = extractHandle(idStr);
		if (handle === trimmed || handle.toLowerCase() === lower) return idStr;
		if (node.label) {
			const labelStr = String(node.label);
			if (labelStr === trimmed || labelStr.toLowerCase() === lower) return idStr;
		}
	}
	return null;
};

export default function OntologyPage() {
	const { token } = useAuth();
	const api = useApi();
	const { language } = useLanguage();
	const { t } = useTranslation();
	const [searchParams, setSearchParams] = useSearchParams();
	const ontologyIri = searchParams.get("iri") || "";
	const focusParam = searchParams.get("focus");

	const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
	const [loading, setLoading] = useState(true);

	const [hoveredClassId, setHoveredClassId] = useState<string | null>(null);
	const [clickedClassId, setClickedClassId] = useState<string | null>(() => {
		return localStorage.getItem("lastClassId") || null;
	});
	const activeClassId = hoveredClassId || clickedClassId;
	const [focusedIndividualId, setFocusedIndividualId] = useState<string | null>(null);
	const [graphFocusKey, setGraphFocusKey] = useState(0);
	const pendingGraphFocusRef = useRef<string | null>(null);

    const [modalStack, setModalStack] = useState<IndividualNode[]>([]);
    const [graphReady, setGraphReady] = useState(false);
	const openModal = (ind: IndividualNode) =>
		setModalStack((prev) => [...prev, ind]);
	const closeModal = () =>
		setModalStack((prev) => prev.slice(0, prev.length - 1));

	const [formInfo, setFormInfo] = useState<{
		mode: "create" | "edit";
		initial?: Partial<IndividualNode>;
		classId?: string;
	} | null>(null);

	const PANEL_KEY = "ontology.sidebarPercent";
	const DEFAULT_PERCENT = 0.34;
	const MIN_PERCENT = 0.2;
	const MAX_PERCENT = 0.6;
	const MIN_WIDTH = 260;
	const MARGINAL_SPACE = 320; // ensure graph keeps reasonable width

	const initialPercent = (() => {
		if (typeof window === "undefined") return DEFAULT_PERCENT;
		const stored = Number(localStorage.getItem(PANEL_KEY));
		if (Number.isFinite(stored) && stored > 0 && stored < 1) {
			return Math.min(Math.max(stored, MIN_PERCENT), MAX_PERCENT);
		}
		return DEFAULT_PERCENT;
	})();

    const [panelPercent, setPanelPercent] = useState(initialPercent);
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        if (typeof window === "undefined") return 360;
        return Math.round(window.innerWidth * initialPercent);
    });

    const [commentTarget, setCommentTarget] = useState<IndividualNode | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const handleResize = () => {
			const width = Math.round(window.innerWidth * panelPercent);
			setSidebarWidth(Math.max(width, MIN_WIDTH));
		};
		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [panelPercent]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		localStorage.setItem(PANEL_KEY, String(panelPercent));
	}, [panelPercent]);

    const setActiveClass = useCallback((id: string | null) => {
        if (id) {
            setClickedClassId(id);
            localStorage.setItem("lastClassId", id);
        } else {
            setClickedClassId(null);
            localStorage.removeItem("lastClassId");
        }
		setFocusedIndividualId(null);
    }, []);

    const updateFocusParam = useCallback(
        (nextFocus: string | null) => {
            const params = new URLSearchParams();
            if (ontologyIri) {
                params.set("iri", ontologyIri);
            }
            if (nextFocus) {
                params.set("focus", nextFocus);
            }
            setSearchParams(params, { replace: true });
        },
        [ontologyIri, setSearchParams]
    );

    const startDrag = (e: React.MouseEvent) => {
        e.preventDefault();
        if (typeof window === "undefined") return;

		const viewportWidth = window.innerWidth;
		const startX = e.clientX;
		const startWidth = sidebarWidth;
		let pendingPercent = panelPercent;

		const onMove = (ev: MouseEvent) => {
			const delta = ev.clientX - startX;
			const minPx = Math.max(viewportWidth * MIN_PERCENT, MIN_WIDTH);
			const maxPx = Math.min(
				viewportWidth * MAX_PERCENT,
				viewportWidth - MARGINAL_SPACE
			);
			let nextWidth = startWidth + delta;
			nextWidth = Math.min(Math.max(nextWidth, minPx), maxPx);
			pendingPercent = nextWidth / viewportWidth;
			setPanelPercent(pendingPercent);
			setSidebarWidth(nextWidth);
		};

		const onUp = () => {
			localStorage.setItem(PANEL_KEY, String(pendingPercent));
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

    const handleClassClick = useCallback(
        (id: string) => {
            setActiveClass(id);
            updateFocusParam(extractHandle(id));
        },
        [setActiveClass, updateFocusParam]
    );

	// Reset la classe sélectionnée quand on change d’ontologie
	useEffect(() => {
		localStorage.removeItem("lastClassId");
		setActiveClass(null);
		setHoveredClassId(null);
		setFocusedIndividualId(null);
	}, [ontologyIri]);

    // Charger le snapshot
    useEffect(() => {
        setLoading(true);
        const query = `/ontologies/${encodeURIComponent(ontologyIri)}/snapshot${
            language ? `?lang=${language}` : ""
        }`;
        api(query)
            .then((r) => r.json())
            .then((data) => {
                setGraphReady(false);
                setSnapshot({ ...data });
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [ontologyIri, token, api, language]);

    const reloadSnapshot = () => {
        const query = `/ontologies/${encodeURIComponent(ontologyIri)}/snapshot${
            language ? `?lang=${language}` : ""
        }`;
        return api(query)
            .then((r) => r.json())
            .then((data) => {
                setGraphReady(false);
                setSnapshot(data);
            });
    };

    useEffect(() => {
        if (!snapshot) return;

        if (!focusParam) {
            pendingGraphFocusRef.current = null;
            setFocusedIndividualId(null);
            return;
        }

        const nodes = snapshot.graph?.nodes ?? [];
        const targetId = findMatchingNodeId(focusParam, nodes);
        if (targetId) {
            if (targetId !== clickedClassId) {
                pendingGraphFocusRef.current = targetId;
                setActiveClass(targetId);
            } else {
                pendingGraphFocusRef.current = null;
                setGraphFocusKey((key) => key + 1);
            }
            setFocusedIndividualId(null);
            return;
        }

        const individuals = snapshot.individuals ?? [];
        const matchedIndividual = individuals.find((ind) => {
            const handle = extractHandle(ind.id);
            if (handle === focusParam) return true;
            if (handle.toLowerCase() === focusParam.toLowerCase()) return true;
            if (ind.label && ind.label === focusParam) return true;
            if (ind.label && ind.label.toLowerCase() === focusParam.toLowerCase()) return true;
            return false;
        });
        if (matchedIndividual) {
            if (matchedIndividual.classId) {
                if (matchedIndividual.classId !== clickedClassId) {
                    pendingGraphFocusRef.current = matchedIndividual.classId;
                    setActiveClass(matchedIndividual.classId);
                } else {
                    pendingGraphFocusRef.current = null;
                    setGraphFocusKey((key) => key + 1);
                }
            }
            setFocusedIndividualId(matchedIndividual.id);
            return;
        }

        pendingGraphFocusRef.current = null;
        setFocusedIndividualId(null);
    }, [focusParam, snapshot, setActiveClass, clickedClassId]);

    useEffect(() => {
        const pending = pendingGraphFocusRef.current;
        if (!pending) return;
        if (pending === clickedClassId) {
            pendingGraphFocusRef.current = null;
            setGraphFocusKey((key) => key + 1);
        }
    }, [clickedClassId]);

    const classOptions = useMemo<{ id: string; label: string }[]>(() => {
        const nodes = snapshot?.graph?.nodes ?? [];
        return nodes.map((node: any) => ({
            id: String(node.id),
            label:
                node.label ||
                formatLabel(String(node.id).split(/[#/]/).pop() || String(node.id)),
        }));
    }, [snapshot?.graph]);

    const handleClassSelect = useCallback(
        (event: React.ChangeEvent<HTMLSelectElement>) => {
            const value = event.target.value;
            if (!value) {
                setActiveClass(null);
                updateFocusParam(null);
            } else {
                setActiveClass(value);
                updateFocusParam(extractHandle(value));
            }
			setFocusedIndividualId(null);
        },
        [setActiveClass, updateFocusParam]
    );

    if (loading || !snapshot) {
        return (
            <div className="flex items-center justify-center h-screen">
                {t("ontology.loading")}
            </div>
        );
    }

    const totalIndividuals = snapshot.individuals?.length ?? 0;
    const activeIndividualsCount = activeClassId
        ? snapshot.individuals.filter((ind) => ind.classId === activeClassId).length
        : totalIndividuals;

	return (
		<>
			<div className="ontology-page">
				<div className="ontology-page__sidebar" style={{ width: sidebarWidth }}>
						<IndividualsPanel
							snapshot={snapshot}
							classId={activeClassId}
							focusedIndividualId={focusedIndividualId}
							onShow={openModal}
							onCreate={(cid) => setFormInfo({ mode: "create", classId: cid })}
							onEdit={(ind) => setFormInfo({ mode: "edit", initial: ind })}
							width={sidebarWidth}
							onDelete={(ind) => {
							api(
								`/individuals/${encodeURIComponent(
									ind.id
								)}?ontology=${encodeURIComponent(ontologyIri)}`,
								{ method: "DELETE" }
							)
								.then(reloadSnapshot)
								.catch(console.error);
						}}
						onAddComment={function (_ind: IndividualNode): void {
							console.warn(
								"onAddComment non implémenté (utiliser CommentFormModal si besoin)"
							);
						}}
					/>
				</div>

				<div
					onMouseDown={startDrag}
					className="ontology-page__resizer"
					role="separator"
					aria-orientation="vertical"
					aria-label={t("ontology.resizeSidebar")}
				/>

				<div className="ontology-page__main">
					<div className="ontology-page__summary card">
						<div className="ontology-page__summary-left">
							<label className="ontology-page__summary-label" htmlFor="ontology-class-select">
								{t("ontology.activeClass")}
							</label>
						<select
							id="ontology-class-select"
							value={activeClassId ?? ""}
							onChange={handleClassSelect}
							className="select-control ontology-page__class-select">
								<option value="">{t("ontology.allClasses")}</option>
								{classOptions.map((option) => (
									<option key={option.id} value={option.id}>
										{option.label}
									</option>
								))}
							</select>
						</div>
						<div className="ontology-page__stats">
							<div className="ontology-page__stat">
								<span className="ontology-page__stat-value">{activeIndividualsCount}</span>
								<span className="ontology-page__stat-label">{t("ontology.summary.filtered")}</span>
							</div>
							<div className="ontology-page__stat">
								<span className="ontology-page__stat-value">{totalIndividuals}</span>
								<span className="ontology-page__stat-label">{t("ontology.summary.total")}</span>
							</div>
						</div>
					</div>

					<div className="ontology-page__graph card">
						{!graphReady && (
							<div className="ontology-page__graph-loading">
								<div className="ontology-page__graph-spinner" />
							</div>
						)}
						<OntologyGraph
							graph={snapshot.graph}
							onClassHover={setHoveredClassId}
							onClassClick={handleClassClick}
							onReady={() => setGraphReady(true)}
							selectedNodeId={clickedClassId}
							highlightNodeId={activeClassId}
							focusKey={graphFocusKey}
						/>
					</div>
				</div>
			</div>

			{modalStack.map((ind, idx) => (
				<Modal
					key={ind.id}
					zIndex={50 + idx}
					individual={ind}
					snapshot={snapshot}
					onShow={openModal}
					onClose={closeModal}
				/>
			))}

			{formInfo && (
				<IndividualFormModal
					ontologyIri={ontologyIri}
					snapshot={snapshot}
					initial={formInfo.initial}
					activeClassId={activeClassId || ""}
					onClose={() => setFormInfo(null)}
					onSubmit={(payload) => {
						const urlBase = `/individuals`;

						let req: Promise<Response>;
						if (payload.mode === "create") {
							req = api(urlBase, {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									id: `http://example.org/va#${payload.label.replaceAll(
										" ",
										""
									)}`,
									label: payload.label,
									classId: payload.classId,
									properties: payload.properties,
									ontologyIri,
									visibleToGroups: payload.visibleToGroups ?? [],
								}),
							});
						} else if (payload.mode === "update") {
							req = api(
								`${urlBase}/${encodeURIComponent(
									payload.iri!
								)}?ontology=${encodeURIComponent(ontologyIri)}`,
								{
									method: "PATCH",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										addProps: [
											{
												predicate: "http://www.w3.org/2000/01/rdf-schema#label",
												value: payload.label,
												isLiteral: true,
											},
											...payload.properties,
										],
										visibleToGroups: payload.visibleToGroups,
									}),
								}
							);
						} else {
							// delete
							req = api(
								`${urlBase}/${encodeURIComponent(
									payload.iri!
								)}?ontology=${encodeURIComponent(ontologyIri)}`,
								{ method: "DELETE" }
							);
						}

						req
							.then(() => reloadSnapshot())
							.catch(console.error)
							.finally(() => setFormInfo(null));
					}}
				/>
			)}

			{commentTarget && (
				<CommentFormModal
					parentInd={commentTarget}
					onClose={() => setCommentTarget(null)}
					onSaved={reloadSnapshot}
				/>
			)}
		</>
	);
}

