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
		<div className="modal-backdrop individual-form__backdrop">
			<div className="modal modal--lg individual-form">
				<h3 className="individual-form__title">
					{isEdit
						? t("individual.form.titleEdit")
						: t("individual.form.titleCreate")}
				</h3>

				{/* ---- Infos de base ---- */}
				<div className="individual-form__grid">
					<div className="form-field-group">
						<label className="form-label form-label--static">
							{t("common.label")}
						</label>
						<input
							className="form-input"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
						/>
					</div>
					<div className="form-field-group">
						<label className="form-label form-label--static">
							{t("individual.form.class")}
						</label>
						<div className="individual-form__static">
							{formatLabel(classId.split(/[#/]/).pop() || "")}
						</div>
					</div>
				</div>

				{/* ---- PDF Upload ---- */}
				<section className="individual-form__section">
					<label className="form-label form-label--static">
						{t("pdf.upload.label")}
					</label>
					<input
						type="file"
						accept="application/pdf"
						multiple
						onChange={handlePdfUpload}
						className="form-input form-input--file"
					/>
					{pdfs.length > 0 && (
						<ul className="individual-form__files">
							{pdfs.map((pdf, idx) => (
								<li key={idx} className="individual-form__file">
									{pdf.originalName}
								</li>
							))}
						</ul>
					)}
				</section>

				{/* ---- Data properties ---- */}
				<section className="individual-form__section">
					<div className="individual-form__section-header">
						<h4>{t("individual.form.literalProperties")}</h4>
					</div>
					{dataRows.map((row, i) => (
						<div key={i} className="individual-form__row">
							<div className="individual-form__predicate">
								{row.predicate
									? formatLabel(row.predicate.split(/[#/]/).pop() || row.predicate)
									: null}
							</div>
							<input
								className="form-input"
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
				<section className="individual-form__section">
					<div className="individual-form__section-header">
						<h4>{t("individual.form.relationsTitle")}</h4>
						<button
							onClick={() => addRow(setObjProps, false)}
							className="button button--primary button--sm">
							{t("individual.form.addRelation")}
						</button>
					</div>
					{objProps.map((row, i) => (
						<div className="individual-form__row" key={i}>
							<div className="individual-form__predicate">
								{row.predicate
									? formatLabel(row.predicate.split(/[#/]/).pop() || row.predicate)
									: null}
							</div>
							<select
								className="form-input"
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
								className="form-input"
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
								className="button button--ghost button--sm individual-form__remove"
								onClick={() => removeRow(i, setObjProps)}>
								✕
							</button>
						</div>
					))}
				</section>

				{/* ---- ACL / Visibility ---- */}
				<section className="individual-form__section">
					<div className="individual-form__section-header">
						<h4>{t("individual.form.visibilityTitle")}</h4>
					</div>
					{groups.length === 0 ? (
						<p className="individual-form__muted">
							{t("individual.form.noGroups")}
						</p>
					) : (
						<div className="individual-form__chips">
							{groups.map((g) => {
								const checked = selectedGroups.includes(g.iri);
								return (
									<label
										key={g.iri}
										className={
											"individual-form__chip" + (checked ? " is-selected" : "")
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
				<div className="individual-form__footer">
					{isEdit && (
						<button onClick={handleDelete} className="button button--danger">
							{t("common.delete")}
						</button>
					)}
					<div className="individual-form__footer-actions">
						<button onClick={onClose} className="button button--ghost">
							{t("common.cancel")}
						</button>
						<button
							disabled={!label.trim() || !classId || !ontologyIri}
							onClick={handleSave}
							className="button button--primary">
							{isEdit ? t("common.save") : t("common.create")}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
export default IndividualFormModal;
