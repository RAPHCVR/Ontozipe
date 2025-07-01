import React from "react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";

import CommentFormModal from "../components/comment/CommentFormModal";
import IndividualFormModal from "../components/individuals/IndividualFormModal";
import Modal from "../components/individuals/Modal";
import { Snapshot, IndividualNode } from "types";
import IndividualsPanel from "../components/individuals/IndividualsPanel";
import OntologyGraph from "../components/OntologyGraph";

export default function OntologyPage() {
	const { token } = useAuth();
	const api = useApi();
	const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
	const [loading, setLoading] = useState(true);
	const [hoveredClassId, setHoveredClassId] = useState<string | null>(null);
	const [clickedClassId, setClickedClassId] = useState<string | null>(() => {
		return localStorage.getItem("lastClassId") || null;
	});
	const activeClassId = hoveredClassId || clickedClassId;
	const [modalStack, setModalStack] = useState<IndividualNode[]>([]);
	const openModal = (ind: IndividualNode) =>
		setModalStack((prev) => [...prev, ind]);
	const closeModal = () =>
		setModalStack((prev) => prev.slice(0, prev.length - 1));
	const [formInfo, setFormInfo] = useState<{
		mode: "create" | "edit";
		initial?: Partial<IndividualNode>;
		classId?: string;
	} | null>(null);
	// Sidebar width
	const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
		const saved = localStorage.getItem("sidebarWidth");
		return saved ? Number(saved) : Math.floor(window.innerWidth * 0.33);
	});
	const [commentTarget, setCommentTarget] = useState<IndividualNode | null>(
		null
	);
	const startDrag = (e: React.MouseEvent) => {
		e.preventDefault();
		const startX = e.clientX;
		const init = sidebarWidth;
		const onMove = (ev: MouseEvent) => {
			const delta = ev.clientX - startX;
			const newW = Math.min(
				Math.max(init + delta, 220),
				window.innerWidth - 320
			);
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
	const handleClassClick = useCallback((id: string) => {
		setClickedClassId(id);
		localStorage.setItem("lastClassId", id);
	}, []);
	// Get ontology IRI from querystring
	const params = new URLSearchParams(window.location.search);
	const ontologyIri = params.get("iri") || "";
	const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

	useEffect(() => {
		setLoading(true);
		api(`${base}/ontology/snapshot?ontology=${encodeURIComponent(ontologyIri)}`)
			.then((r) => r.json())
			.then((data) => {
				setSnapshot({ ...data });
			})
			.catch(console.error)
			.finally(() => setLoading(false));
		// eslint-disable-next-line
	}, [ontologyIri, token]);

	const reloadSnapshot = () =>
		api(`${base}/ontology/snapshot?ontology=${encodeURIComponent(ontologyIri)}`)
			.then((r) => r.json())
			.then(setSnapshot);

	if (loading || !snapshot) {
		return (
			<div className="flex items-center justify-center h-screen">
				Chargement des données…
			</div>
		);
	}
	return (
		<>
			<IndividualsPanel
				snapshot={snapshot}
				classId={activeClassId}
				onShow={openModal}
				onCreate={(cid) => setFormInfo({ mode: "create", classId: cid })}
				onEdit={(ind) => setFormInfo({ mode: "edit", initial: ind })}
				width={sidebarWidth}
				onDelete={function (ind: IndividualNode): void {
					throw new Error("Function not implemented.");
				}}
				onAddComment={function (ind: IndividualNode): void {
					throw new Error("Function not implemented.");
				}}
			/>
			<div
				onMouseDown={startDrag}
				className="cursor-ew-resize w-2 min-h-full bg-[radial-gradient(circle,_#cbd5e1_1px,transparent_1px)] [background-size:4px_4px]"
			/>
			<div className="w-2" />
			<div className="flex-grow card pl-2-important min-h-0">
				<OntologyGraph
					graph={snapshot.graph}
					onClassHover={setHoveredClassId}
					onClassClick={handleClassClick}
				/>
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
						const urlBase = `${base}/ontology/individuals`;
						const req =
							payload.mode === "create"
								? api(urlBase, {
										method: "POST",
										headers: {
											"Content-Type": "application/json",
										},
										body: JSON.stringify({
											id: `http://example.org/va#${payload.label.replaceAll(
												" ",
												""
											)}`,
											label: payload.label,
											classId: payload.classId,
											properties: payload.properties,
										}),
								  })
								: api(`${urlBase}/${encodeURIComponent(payload.iri!)}`, {
										method: "PATCH",
										headers: {
											"Content-Type": "application/json",
										},
										body: JSON.stringify({
											addProps: payload.properties,
										}),
								  });
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
