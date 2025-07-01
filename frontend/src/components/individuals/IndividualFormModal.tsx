import React from "react";
import { useState, useEffect, useCallback } from "react";
import { useApi } from "../../lib/api";
import { IndividualNode, Snapshot } from "../../types";
import { formatLabel } from "../../utils/formatLabel";
// ---------------------------------------------------------------------------
// IndividualFormModal – création / édition d'un individu
// ---------------------------------------------------------------------------
type PropertyInput = { predicate: string; value: string; isLiteral: boolean };

type Group = { iri: string; label?: string };

const IndividualFormModal: React.FC<{
	snapshot: Snapshot;
	ontologyIri: string; // <-- NEW: active ontology IRI
	initial?: Partial<IndividualNode> & { visibleToGroups?: string[] };
	activeClassId?: string; // <-- NEW: initial classId if provided
	onClose: () => void;
	onSubmit: (payload: {
		mode: "create" | "update";
		iri?: string;
		label: string;
		classId: string;
		properties: PropertyInput[];
		visibleToGroups: string[];
	}) => void;
}> = ({
	snapshot,
	ontologyIri,
	initial = {},
	activeClassId = "",
	onClose,
	onSubmit,
}) => {
	const isEdit = Boolean(initial.id);
	const api = useApi();

	const [label, setLabel] = useState(initial.label || "");
	const [classId, setClassId] = useState(initial?.classId || activeClassId);

	const [dataProps, setDataProps] = useState<PropertyInput[]>(
		(initial.properties || []).filter((p) => p.isLiteral)
	);
	const [objProps, setObjProps] = useState<PropertyInput[]>(
		(initial.properties || []).filter((p) => !p.isLiteral)
	);

	const [groups, setGroups] = useState<Group[]>([]);
	const [selectedGroups, setSelectedGroups] = useState<string[]>(
		initial.visibleToGroups ?? []
	);

	// --- helper: all subclasses (recursively) of a given class ---
	const getDescendantClasses = useCallback(
		(base: string): Set<string> => {
			const set = new Set<string>([base]);
			const stack = [base];
			while (stack.length) {
				const cur = stack.pop()!;
				snapshot.graph.edges.forEach((e: any) => {
					if (e.to === cur && !set.has(e.from)) {
						set.add(e.from);
						stack.push(e.from);
					}
				});
			}
			return set;
		},
		[snapshot.graph.edges]
	);

	// --- Available properties for this class ---
	const [available, setAvailable] = useState<{
		dataProps: { iri: string; label: string }[];
		objectProps: {
			iri: string;
			label: string;
			range?: { iri: string; label: string };
		}[];
	}>({ dataProps: [], objectProps: [] });

	// fetch when classId changes
	useEffect(() => {
		const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
		const { token } = (window as any).authCtx || {};
		api(`${base}/ontology/properties?class=${encodeURIComponent(classId)}`)
			.then((r) => r.json())
			.then(setAvailable)
			.catch(console.error);
	}, [classId]);

	useEffect(() => {
		const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
		api(`${base}/ontology/groups`)
			.then((r) => r.json())
			.then((arr: Group[]) => setGroups(arr))
			.catch(console.error);
	}, []);

	const toggleGroup = (iri: string) =>
		setSelectedGroups((prev) =>
			prev.includes(iri) ? prev.filter((g) => g !== iri) : [...prev, iri]
		);

	// --- Handlers helpers ----
	const addRow = (
		setter: React.Dispatch<React.SetStateAction<PropertyInput[]>>,
		isLiteral: boolean
	) => setter((prev) => [...prev, { predicate: "", value: "", isLiteral }]);

	const updateRow = (
		index: number,
		field: keyof PropertyInput,
		value: string,
		setter: React.Dispatch<React.SetStateAction<PropertyInput[]>>
	) =>
		setter((prev) =>
			prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
		);

	const removeRow = (
		index: number,
		setter: React.Dispatch<React.SetStateAction<PropertyInput[]>>
	) => setter((prev) => prev.filter((_, i) => i !== index));

	// --- Data properties merge: always show all available dataProps ---
	const dataRows = available.dataProps.map((prop) => {
		const existing = dataProps.find((dp) => dp.predicate === prop.iri);
		return existing || { predicate: prop.iri, value: "", isLiteral: true };
	});

	// --- Submit ---
	const handleSave = () => {
		if (!label.trim()) return alert("Le label est requis");

		const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
		const newBody = {
			id: `http://example.org/va#${label.replace(/\s+/g, "")}`,
			label,
			classId,
			properties: [...dataProps, ...objProps],
			ontologyIri,
			visibleToGroups: selectedGroups,
		};

		let promise: Promise<Response>;

		if (isEdit && initial.id) {
			// delete then create
			promise = api(
				`${base}/ontology/individuals/${encodeURIComponent(initial.id)}`,
				{ method: "DELETE" }
			).then(() =>
				api(`${base}/ontology/individuals`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(newBody),
				})
			);
		} else {
			// plain creation
			promise = api(`${base}/ontology/individuals`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(newBody),
			});
		}

		promise
			.then(() =>
				onSubmit({
					mode: isEdit ? "update" : "create",
					label,
					classId,
					properties: [],
					visibleToGroups: selectedGroups,
				})
			)
			.catch((err) => {
				console.error(err);
				alert("Erreur lors de l'enregistrement");
			})
			.finally(onClose);
	};
	const handleDelete = () => {
		if (!initial.id) return;
		if (!confirm("Supprimer définitivement cet individu ?")) return;

		const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
		api(`${base}/ontology/individuals/${encodeURIComponent(initial.id)}`, {
			method: "DELETE",
		})
			.then(() =>
				onSubmit({
					mode: "update",
					label,
					classId,
					properties: [],
					visibleToGroups: [],
				})
			)
			.catch((err) => {
				console.error(err);
				alert("Erreur lors de la suppression");
			})
			.finally(onClose);
	};
	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
			<div className="bg-white dark:bg-slate-800 rounded-lg w-4/5 max-w-5xl p-6 shadow-lg space-y-4 overflow-y-auto max-h-[90vh]">
				<h3 className="text-lg font-semibold mb-2">
					{isEdit ? "Modifier Individu" : "Nouvel Individu"}
				</h3>
				{/* ---- Infos de base ---- */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium mb-1">Label</label>
						<input
							className="input w-full"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
						/>
					</div>
					<div>
						<label className="block text-sm font-medium mb-1">Classe</label>
						{formatLabel(classId.split(/[#/]/).pop() || "")}
					</div>
				</div>

				{/* ---- Data properties ---- */}
				<section>
					<div className="flex items-center justify-between mb-1">
						<h4 className="text-sm font-semibold text-indigo-500">
							Propriétés littérales
						</h4>
					</div>
					{dataRows.map((row, i) => (
						<div key={i} className="flex items-center gap-2 mb-1">
							<div className="flex-1">
								{row.predicate ? (
									<span className="text-xs text-gray-500">
										{formatLabel(
											row.predicate.split(/[#/]/).pop() || row.predicate
										)}
									</span>
								) : null}
							</div>
							<input
								className="input flex-1"
								placeholder="Valeur"
								value={row.value}
								onChange={(e) => {
									const val = e.target.value;
									setDataProps((prev) => {
										const idxFound = prev.findIndex(
											(dp) => dp.predicate === row.predicate
										);
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
								}}
							/>
						</div>
					))}
				</section>

				{/* ---- Object properties ---- */}
				<section>
					<div className="flex items-center justify-between mb-1">
						<h4 className="text-sm font-semibold text-emerald-600">
							Relations
						</h4>
						<button
							onClick={() => addRow(setObjProps, false)}
							className="btn-primary text-xs">
							+ Ajouter
						</button>
					</div>
					{objProps.map((row, i) => (
						<div className="flex items-center gap-2 mb-1" key={i}>
							<div className="flex-1">
								{row.predicate ? (
									<span className="text-xs text-gray-500">
										{formatLabel(
											row.predicate.split(/[#/]/).pop() || row.predicate
										)}
									</span>
								) : null}
							</div>
							<select
								className="input flex-1"
								value={row.predicate}
								onChange={(e) =>
									updateRow(i, "predicate", e.target.value, setObjProps)
								}>
								<option value="">-- Prédicat --</option>
								{available.objectProps.map((p) => (
									<option key={p.iri} value={p.iri}>
										{formatLabel(p.label)}
									</option>
								))}
							</select>
							<select
								className="input flex-1"
								value={row.value}
								onChange={(e) =>
									updateRow(i, "value", e.target.value, setObjProps)
								}>
								<option value="">-- Sélectionner Individu --</option>
								{(() => {
									const rangeIri = available.objectProps.find(
										(p) => p.iri === row.predicate
									)?.range?.iri;
									const allowed = rangeIri
										? getDescendantClasses(rangeIri)
										: null;
									return snapshot.individuals
										.filter((ind) => !allowed || allowed.has(ind.classId))
										.map((ind) => (
											<option key={ind.id} value={ind.id}>
												{formatLabel(ind.label)}
											</option>
										));
								})()}
							</select>
							<button
								className="text-red-500 text-sm px-2"
								onClick={() => removeRow(i, setObjProps)}>
								✕
							</button>
						</div>
					))}
				</section>

				{/* ---- ACL / Visibility ---- */}
				<section>
					<h4 className="text-sm font-semibold text-purple-600 mb-1">
						Visibilité – Groupes autorisés
					</h4>
					{groups.length === 0 ? (
						<p className="text-xs text-gray-500">Aucun groupe disponible</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{groups.map((g) => {
								const checked = selectedGroups.includes(g.iri);
								return (
									<label
										key={g.iri}
										className={
											"cursor-pointer rounded px-2 py-1 text-xs border " +
											(checked
												? "bg-indigo-600 text-white border-indigo-600"
												: "bg-gray-100 dark:bg-slate-700 border-gray-300 dark:border-slate-600")
										}>
										<input
											type="checkbox"
											className="sr-only"
											checked={checked}
											onChange={() => toggleGroup(g.iri)}
										/>
										{formatLabel(g.label || g.iri.split(/[#/]/).pop() || "")}
									</label>
								);
							})}
						</div>
					)}
				</section>

				{/* ---- Actions ---- */}
				<div className="flex justify-between items-center pt-4">
					{isEdit && (
						<button onClick={handleDelete} className="btn-danger">
							Supprimer
						</button>
					)}
					<div className="flex gap-4 ml-auto">
						<button onClick={onClose} className="btn-secondary">
							Annuler
						</button>
						<button
							disabled={!label.trim() || !classId || !ontologyIri}
							onClick={handleSave}
							className="btn-primary disabled:opacity-50 disabled:pointer-events-none">
							{isEdit ? "Enregistrer" : "Créer"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
export default IndividualFormModal;
