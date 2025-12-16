import React from "react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useApi } from "../../lib/api";
import { IndividualNode, Snapshot } from "../../types";
import { formatLabel } from "../../utils/formatLabel";
import { useTranslation } from "../../language/useTranslation";
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
		mode: "create" | "update" | "delete";
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
	const { token } = useAuth();
	// --- PDF Upload State ---
	type PdfMeta = { url: string; originalName: string };
	const [pdfs, setPdfs] = useState<PdfMeta[]>(() => {
		if (initial && initial.properties) {
			// Récupère toutes les urls et tous les noms originaux
			const urls = initial.properties.filter(
				(p) =>
					p.predicate === "http://example.org/core#pdfUrl" &&
					typeof p.value === "string" &&
					p.value.endsWith(".pdf")
			);
			const names = initial.properties.filter(
				(p) =>
					p.predicate === "http://example.org/core#pdfOriginalName" &&
					typeof p.value === "string"
			);
			// Associe chaque url à son nom original (par index)
			return urls.map((u, i) => ({
				url: u.value,
				originalName: names[i]?.value || u.value.split("/").pop() || u.value,
			}));
		}
		return [];
	});

	// --- PDF Upload Handler ---
	const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;
		const formData = new FormData();
		for (let i = 0; i < files.length; i++) {
			formData.append("files", files[i]);
		}
		const res = await fetch("/ontology/upload-pdf", {
			method: "POST",
			body: formData,
			headers: {
				Authorization: token ? `Bearer ${token}` : "",
			},
		});
		if (res.ok) {
			const uploaded = await res.json(); // tableau [{url, originalName}]
			setPdfs((prev) => [...prev, ...uploaded]);
		}
	};
	const isEdit = Boolean(initial.id);
	const api = useApi();
	const { t } = useTranslation();

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
		if (!classId) return;
		api(
			`/ontologies/${encodeURIComponent(
				ontologyIri
			)}/properties?class=${encodeURIComponent(classId)}`
		)
			.then((r) => r.json())
			.then(setAvailable)
			.catch(console.error);
	}, [api, classId, ontologyIri]);

	useEffect(() => {
		api(`/groups`)
			.then((r) => r.json())
			.then((arr: Group[]) => setGroups(arr))
			.catch(console.error);
	}, [api]);

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
		if (!label.trim()) {
			alert(t("individual.form.errors.labelRequired"));
			return;
		}
		// Ajoute les PDF comme propriétés core:pdfUrl ET core:pdfOriginalName
		const pdfProps = pdfs.map((pdf) => ({
			predicate: "http://example.org/core#pdfUrl",
			value: pdf.url,
			isLiteral: true,
		}));
		const pdfNameProps = pdfs.map((pdf) => ({
			predicate: "http://example.org/core#pdfOriginalName",
			value: pdf.originalName,
			isLiteral: true,
		}));
		onSubmit({
			mode: isEdit ? "update" : "create",
			iri: isEdit ? String(initial.id) : undefined,
			label,
			classId,
			properties: [...dataProps, ...objProps, ...pdfProps, ...pdfNameProps],
			visibleToGroups: selectedGroups,
		});
		onClose();
	};
	const handleDelete = () => {
		if (!initial.id) return;
		if (!confirm(t("individual.form.confirmDelete"))) return;
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
	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
			<div className="bg-white dark:bg-slate-800 rounded-lg w-4/5 max-w-5xl p-6 shadow-lg space-y-4 overflow-y-auto max-h-[90vh]">
				<h3 className="text-lg font-semibold mb-2">
					{isEdit
						? t("individual.form.titleEdit")
						: t("individual.form.titleCreate")}
				</h3>
				{/* ---- Infos de base ---- */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium mb-1">
							{t("common.label")}
						</label>
						<input
							className="input w-full"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
						/>
					</div>
					<div>
						<label className="block text-sm font-medium mb-1">
							{t("individual.form.class")}
						</label>
						{formatLabel(classId.split(/[#/]/).pop() || "")}
					</div>
				</div>

				{/* ---- PDF Upload ---- */}
				<section>
					<label className="block text-xs font-medium mb-1">
						Ajouter des PDF
					</label>
					<input
						type="file"
						accept="application/pdf"
						multiple
						onChange={handlePdfUpload}
					/>
					{pdfs.length > 0 && (
						<ul className="text-xs mt-1">
							{pdfs.map((pdf, idx) => (
								<li key={idx} className="truncate">
									{pdf.originalName}
								</li>
							))}
						</ul>
					)}
				</section>
				{/* ---- Data properties ---- */}
				<section>
					<div className="flex items-center justify-between mb-1">
						<h4 className="text-sm font-semibold text-indigo-500">
							{t("individual.form.literalProperties")}
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
								placeholder={t("individual.form.valuePlaceholder")}
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
							{t("individual.form.relationsTitle")}
						</h4>
						<button
							onClick={() => addRow(setObjProps, false)}
							className="btn-primary text-xs">
							{t("individual.form.addRelation")}
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
								<option value="">
									{t("individual.form.predicatePlaceholder")}
								</option>
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
								<option value="">
									{t("individual.form.selectIndividual")}
								</option>
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
						{t("individual.form.visibilityTitle")}
					</h4>
					{groups.length === 0 ? (
						<p className="text-xs text-gray-500">
							{t("individual.form.noGroups")}
						</p>
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
							{t("common.delete")}
						</button>
					)}
					<div className="flex gap-4 ml-auto">
						<button onClick={onClose} className="btn-secondary">
							{t("common.cancel")}
						</button>
						<button
							disabled={!label.trim() || !classId || !ontologyIri}
							onClick={handleSave}
							className="btn-primary disabled:opacity-50 disabled:pointer-events-none">
							{isEdit ? t("common.save") : t("common.create")}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
export default IndividualFormModal;
