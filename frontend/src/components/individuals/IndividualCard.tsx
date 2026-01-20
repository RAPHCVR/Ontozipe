import React, { useMemo, useState, useEffect, useRef } from "react";
import { IndividualNode, Snapshot, CommentNode } from "../../types";
import { formatLabel } from "../../utils/formatLabel";
import { useAuth } from "../../auth/AuthContext";
import CommentBlock from "../comment/CommentComponent";
import { v4 as uuidv4 } from "uuid";
import { useApi } from "../../lib/api";
import { useTranslation } from "../../language/useTranslation";
import { useCommentSummary } from "../../hooks/useCommentSummary";
import SimpleModal from "../SimpleModal";
import { SparklesIcon } from "@heroicons/react/24/solid";
import PdfModal from "../pdf/PdfModal";
import { usePdfModal } from "../../hooks/usePdfModal";

// Fonction utilitaire pour transformer [PDF:nom.pdf] en bouton cliquable et URLs PDF en liens
export function renderCommentWithPdfLinks(
	text: string,
	pdfs: { url: string; originalName: string }[]
) {
	// Regex pour détecter les URLs PDF (http/https avec extension .pdf)
	const pdfUrlRegex = /(https?:\/\/[^\s]+\.pdf)/gi;

	// Première étape : transformer les mentions [PDF:nom.pdf]
	let processedText = text.split(/(\[PDF:[^\]]+\])/g).map((part, i) => {
		const match = part.match(/^\[PDF:(.+)\]$/);
		if (match) {
			const pdf = pdfs.find((p) => p.originalName === match[1]);
			if (pdf) {
				return (
					<button
						key={`mention-${i}`}
						type="button"
						data-pdf-url={pdf.url}
						className="pdf-mention-btn">
						📄 {pdf.originalName}
					</button>
				);
			}
		}
		// Deuxième étape : transformer les URLs PDF brutes dans cette partie
		if (typeof part === "string" && pdfUrlRegex.test(part)) {
			return part.split(pdfUrlRegex).map((segment, j) => {
				if (segment.match(pdfUrlRegex)) {
					return (
						<a
							key={`url-${i}-${j}`}
							href={segment}
							target="_blank"
							rel="noopener noreferrer"
							className="pdf-link">
							{segment}
						</a>
					);
				}
				return segment;
			});
		}
		return part;
	});

	return processedText;
}

const IndividualCard: React.FC<{
	ind: IndividualNode;
	snapshot: Snapshot;
	onShow: (target: IndividualNode) => void;
	idx: number;
	defaultOpen?: boolean;
	highlighted?: boolean;
	onEdit: (ind: IndividualNode) => void;
	onDelete: (ind: IndividualNode) => void;
}> = ({
	ind,
	snapshot,
	onShow,
	idx,
	defaultOpen = false,
	highlighted = false,
	onEdit,
	onDelete,
}) => {
	// Utilisateur courant depuis le contexte d’authentification
	const { user } = useAuth();
	const api = useApi();
	const { t } = useTranslation();
	const currentUserIri: string | undefined = user?.sub;

	// Get ontology IRI from querystring
	const params = new URLSearchParams(window.location.search);
	const ontologyIri = params.get("iri") || "";

	// Est‑ce le créateur ?
	const isCreator = ind.createdBy && ind.createdBy === currentUserIri;

	// Groupes de l’utilisateur : on les récupère dans le snapshot
	const userNode =
		snapshot.persons.find((p) => p.id === currentUserIri) || undefined;

	// Liste des groupes de l'utilisateur (objet { iri, label? })
	const userGroups = userNode?.groups || [];

	// Intersection entre les groupes de l'individu (visibleTo) et ceux du user
	const commonGroups =
		userGroups.filter((g) => (ind.visibleTo || []).includes(g.iri)) || [];

	// Extraction des PDFs associés à l'individu (url + nom original)
	const pdfUrls = useMemo(
		() =>
			(ind.properties || []).filter(
				(p) =>
					p.predicate === "http://example.org/core#pdfUrl" &&
					typeof p.value === "string" &&
					p.value.endsWith(".pdf")
			),
		[ind.properties]
	);
	const pdfNames = useMemo(
		() =>
			(ind.properties || []).filter(
				(p) =>
					p.predicate === "http://example.org/core#pdfOriginalName" &&
					typeof p.value === "string"
			),
		[ind.properties]
	);
	// Associe chaque url à son nom original (par index)
	const pdfs = pdfUrls.map((u, i) => ({
		url: u.value,
		originalName: pdfNames[i]?.value || u.value.split("/").pop() || u.value,
	}));

	const uniqueProps = useMemo(() => {
		const m = new Map<string, (typeof ind.properties)[number]>();
		for (const p of ind.properties || []) {
			const key = `${p.predicate}||${p.isLiteral ? "L" : "R"}||${p.value}`;
			const prev = m.get(key);
			if (!prev) m.set(key, p);
			else {
				// conserve la variante la plus "riche" en libellés
				if (
					(!prev.valueLabel && p.valueLabel) ||
					(!prev.predicateLabel && p.predicateLabel)
				) {
					m.set(key, p);
				}
			}
		}
		return Array.from(m.values());
	}, [ind.properties]);

	// Puis utilise uniqueProps à la place de ind.properties
	const filteredProps =
		(uniqueProps || []).filter((prop) => !prop.predicate.endsWith("label")) ||
		[];

	const dataProps = filteredProps.filter(
		(p) =>
			p.isLiteral &&
			p.predicate !== "http://example.org/core#pdfUrl" &&
			p.predicate !== "http://example.org/core#pdfOriginalName"
	);
	const relProps = filteredProps.filter((p) => !p.isLiteral);

	const hasData = dataProps.length > 0 || relProps.length > 0;

	// ---- COMMENTS (stateful) ----
	const [comments, setComments] = useState<CommentNode[]>([]);
	const [summaryOpen, setSummaryOpen] = useState(false);

	// état d’ouverture de la carte
	const [open, setOpen] = useState(defaultOpen);

	const cardRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setOpen(defaultOpen);
	}, [defaultOpen]);

	// récupère les commentaires dès que la carte s'ouvre ou change de ressource
	useEffect(() => {
		if (open) {
			fetchComments();
		}
	}, [open, ind.id, ontologyIri]);

	useEffect(() => {
		if ((defaultOpen || highlighted) && cardRef.current) {
			cardRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
		}
	}, [defaultOpen, highlighted]);

	// saisie rapide d'un nouveau commentaire
	const [draftComment, setDraftComment] = useState("");
	const [showPdfAutocomplete, setShowPdfAutocomplete] = useState(false);
	const [pdfAutocompleteOptions, setPdfAutocompleteOptions] = useState(pdfs);
	const [pdfAutocompleteIndex, setPdfAutocompleteIndex] = useState(0);

	// Hook pour gérer la modal PDF
	const {
		isOpen: showPdfModal,
		pdfUrl: currentPdfUrl,
		pdfName: currentPdfName,
		openModal: openPdfModal,
		closeModal: closePdfModal,
	} = usePdfModal();

	// Détecte le déclencheur d'autocomplétion
	const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		setDraftComment(val);
		// Déclenche si @pdf ou [PDF: est tapé
		const trigger = /(@pdf|\[PDF:?)$/i;
		if (trigger.test(val)) {
			setShowPdfAutocomplete(true);
			setPdfAutocompleteOptions(pdfs);
			setPdfAutocompleteIndex(0);
		} else {
			setShowPdfAutocomplete(false);
		}
	};

	// Insertion de la mention PDF dans le commentaire
	const insertPdfMention = (pdf: (typeof pdfs)[number]) => {
		// Remplace le dernier @pdf ou [PDF: par la balise
		setDraftComment((prev) =>
			prev.replace(/(@pdf|\[PDF:?)$/i, `[PDF:${pdf.originalName}]`)
		);
		setShowPdfAutocomplete(false);
	};

	const summaryInput = useMemo(() => {
		if (!open) return null;
		const properties = (filteredProps || []).slice(0, 12).map((p) => ({
			predicate: p.predicateLabel || p.predicate,
			value: p.valueLabel || p.value,
		}));
		return {
			individual: {
				id: ind.id,
				label: ind.label,
				properties,
			},
			comments: comments.map((c) => ({
				body: c.body,
				replyTo: c.replyTo,
			})),
		};
	}, [open, ind, filteredProps, comments]);

	const summaryQuery = useCommentSummary(summaryInput);

	// helper: refresh from API after mutation
	const fetchComments = async () => {
		const url = `/comments?resource=${encodeURIComponent(
			ind.id
		)}&ontology=${encodeURIComponent(ontologyIri)}`;
		const res = await api(url);
		if (res.ok) {
			const list: CommentNode[] = await res.json();
			setComments(list);
		}
	};

	// CREATE
	const handleCreateComment = async (body: string, parent?: CommentNode) => {
		const payload = {
			id: `urn:uuid:${uuidv4()}`,
			body,
			onResource: ind.id,
			replyTo: parent?.id,
			ontologyIri: ontologyIri,
		};
		await api("/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		await fetchComments();
	};

	// UPDATE
	const handleEditComment = async (comment: CommentNode, body: string) => {
		await api(`/comments/${encodeURIComponent(comment.id)}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				newBody: body,
				ontologyIri: ontologyIri,
			}),
		});
		await fetchComments();
	};

	// DELETE
	const handleDeleteComment = async (comment: CommentNode) => {
		await api(
			`/comments/${encodeURIComponent(
				comment.id
			)}?ontology=${encodeURIComponent(ontologyIri)}`,
			{ method: "DELETE" }
		);
		await fetchComments();
	};

	return (
		<div
			ref={cardRef}
			className={`individual-card has-data${idx % 2 ? " is-alt" : ""}${
				highlighted ? " is-highlighted" : ""
			}`}>
			<div
				className="individual-card__header"
				onClick={() => setOpen((v: any) => !v)}>
				<span className="individual-card__title">{formatLabel(ind.label)}</span>
				<div className="individual-card__actions">
					{isCreator && (
						<>
							<button
								title={t("common.delete")}
								onClick={(e) => {
									e.stopPropagation();
									if (!window.confirm(t("individual.form.confirmDelete")))
										return;
									onDelete(ind);
								}}
								className="button button--ghost button--sm individual-card__action--danger">
								{t("common.delete")}
							</button>
							<button
								title={t("common.edit")}
								onClick={(e) => {
									e.stopPropagation();
									onEdit(ind);
								}}
								className="button button--ghost button--sm">
								{t("common.edit")}
							</button>
						</>
					)}
					<span className="individual-card__caret">{open ? "▼" : "▶"}</span>
				</div>
			</div>
			{open && (
				<div className="individual-card__body">
					{/* ---- GROUPES COMMUNS ---- */}
					{commonGroups.length > 0 && (
						<div className="individual-card__section">
							<h4 className="individual-card__section-title">
								{t("individual.commonGroups")}
							</h4>
							<div className="individual-card__chips">
								{commonGroups.map((g, idx) => (
									<span key={idx} className="group-chip">
										{formatLabel(g.label || g.iri.split(/[#/]/).pop() || g.iri)}
									</span>
								))}
							</div>
						</div>
					)}

					{/* ---- RELATIONS SECTION ---- */}
					{relProps.length > 0 && (
						<div className="individual-card__section individual-card__section--relations">
							<h4 className="individual-card__section-title">
								{t("individual.relations.title")}
							</h4>
							<div className="individual-card__chips">
								{relProps.map((prop, idx) => {
									const target =
										snapshot.individuals.find((t) => t.id === prop.value) ||
										snapshot.persons.find((t) => t.id === prop.value);

									const hasData =
										!!target && (target.properties?.length ?? 0) > 0;

									const label = formatLabel(
										target?.label ||
											prop.valueLabel ||
											(prop.value.startsWith("http")
												? prop.value.split(/[#/]/).pop() || prop.value
												: prop.value)
									);

									const title = hasData
										? t("individual.relations.openWithData")
										: t("individual.relations.openWithoutData");

									return (
										<span key={idx} className="relation-chip__wrapper">
											<button
												onClick={() => target && onShow(target)}
												className={
													"relation-chip" + (hasData ? " has-data" : " no-data")
												}
												title={title}>
												<span className="relation-chip__bullet">
													{hasData ? "●" : "○"}
												</span>
												{label}
											</button>
											<span className="relation-chip__tooltip">
												{formatLabel(
													prop.predicateLabel ||
														prop.predicate.split(/[#/]/).pop() ||
														""
												)}
											</span>
										</span>
									);
								})}
							</div>
						</div>
					)}
					{relProps.length === 0 && (
						<div className="individual-card__section individual-card__section--relations individual-card__empty">
							<p className="individual-card__muted">
								{t("individual.relations.empty")}
							</p>
						</div>
					)}

					{/* ---- DATA SECTION ---- */}
					{dataProps.length > 0 && (
						<div className="individual-card__section individual-card__section--data">
							<h4 className="individual-card__section-title">
								{t("individual.data.title")}
							</h4>
							<div className="individual-card__table-wrapper">
								<table className="individual-card__table">
									<tbody>
										{dataProps.map((prop, idx) => (
											<tr key={idx}>
												<th>
													{formatLabel(
														prop.predicateLabel ||
															prop.predicate.split(/[#/]/).pop() ||
															""
													)}
												</th>
												<td>
													{(() => {
														const isURL =
															typeof prop.value === "string" &&
															prop.value.startsWith("http");
														if (isURL) {
															return (
																<a
																	href={prop.value}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="pdf-link">
																	{prop.valueLabel || prop.value}
																</a>
															);
														}
														return prop.value;
													})()}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}
					{dataProps.length === 0 && (
						<div className="individual-card__section individual-card__section--data individual-card__empty">
							<p className="individual-card__muted">
								{t("individual.data.empty")}
							</p>
						</div>
					)}

					{/* ---- PDFS ASSOCIÉS ---- */}
					{pdfs.length > 0 && (
						<div className="individual-card__section">
							<h4 className="individual-card__section-title">
								{t("individual.pdf.associated")}
							</h4>
							<ul className="individual-card__list">
								{pdfs.map((pdf, idx) => (
									<li key={idx}>
										<button
											type="button"
											onClick={() => openPdfModal(pdf.url, pdf.originalName)}
											className="pdf-link pdf-link--button">
											{pdf.originalName}
										</button>
										<span className="individual-card__muted individual-card__hint">
											{t("individual.pdf.hint")}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{/* ---- COMMENTAIRES ---- */}
					<div className="individual-card__section individual-card__section--comments">
						<div className="individual-card__section-header">
							<h4 className="individual-card__section-title">
								{t("individual.comments.title")}
							</h4>
						</div>
						<div className="individual-comments__composer">
							<textarea
								value={draftComment}
								onChange={(e) => setDraftComment(e.target.value)}
								placeholder={t("individual.comments.placeholder")}
								rows={2}
								className="comment-block__textarea"
								onKeyDown={(e) => {
									if (
										showPdfAutocomplete &&
										pdfAutocompleteOptions.length > 0
									) {
										if (e.key === "ArrowDown") {
											e.preventDefault();
											setPdfAutocompleteIndex(
												(i) => (i + 1) % pdfAutocompleteOptions.length
											);
										} else if (e.key === "ArrowUp") {
											e.preventDefault();
											setPdfAutocompleteIndex(
												(i) =>
													(i - 1 + pdfAutocompleteOptions.length) %
													pdfAutocompleteOptions.length
											);
										} else if (e.key === "Enter") {
											e.preventDefault();
											insertPdfMention(
												pdfAutocompleteOptions[pdfAutocompleteIndex]
											);
										} else if (e.key === "Escape") {
											setShowPdfAutocomplete(false);
										}
									}
								}}
							/>
							{showPdfAutocomplete && pdfAutocompleteOptions.length > 0 && (
								<ul className="comment-suggestions">
									{pdfAutocompleteOptions.map((pdf, idx) => (
										<li
											key={pdf.url}
											className={
												"comment-suggestions__item" +
												(idx === pdfAutocompleteIndex ? " is-active" : "")
											}
											onMouseDown={() => insertPdfMention(pdf)}>
											{pdf.originalName}
										</li>
									))}
								</ul>
							)}
						</div>
						<button
							disabled={!draftComment.trim()}
							onClick={() => {
								if (draftComment.trim()) {
									handleCreateComment(draftComment.trim());
									setDraftComment("");
								}
							}}
							className="button button--primary button--sm individual-comments__send">
							{t("common.send")}
						</button>
						<button
							type="button"
							className="button button--ghost button--sm"
							onClick={() => setSummaryOpen(true)}>
							<SparklesIcon className="icon--sm" aria-hidden="true" />
							{t("dashboard.section.summary")}
						</button>
						<div>
							{comments
								.filter((c) => !c.replyTo)
								.map((c) => (
									<CommentBlock
										key={c.id}
										comment={c}
										allComments={comments}
										snapshot={snapshot}
										onAddReply={(parent, body) =>
											handleCreateComment(body, parent)
										}
										onEdit={handleEditComment}
										onDelete={handleDeleteComment}
										currentUserIri={currentUserIri || ""}
										ontologyIri={ontologyIri}
										availablePdfs={pdfs}
										renderBody={(body: string) =>
											renderCommentWithPdfLinks(body, pdfs)
										}
									/>
								))}
							{comments.filter((c) => !c.replyTo).length === 0 && (
								<p className="individual-card__muted">
									{t("individual.comments.empty")}
								</p>
							)}
						</div>
					</div>

					{summaryOpen && (
						<SimpleModal
							title={t("dashboard.section.summary")}
							onClose={() => setSummaryOpen(false)}
							onSubmit={() => setSummaryOpen(false)}>
							{summaryQuery.isLoading && (
								<div className="individual-card__muted">
									<div className="page-state__spinner" aria-hidden />
								</div>
							)}
							{summaryQuery.isError && (
								<p className="individual-card__muted">
									{t("dashboard.state.error")}
								</p>
							)}
							{summaryQuery.data && (
								<p className="individual-card__summary-text">
									{summaryQuery.data}
								</p>
							)}
						</SimpleModal>
					)}
				</div>
			)}
			{/* Modal PDF unifiée avec commentaires */}
			<PdfModal
				isOpen={showPdfModal}
				pdfUrl={currentPdfUrl}
				pdfName={currentPdfName}
				onClose={closePdfModal}
				ontologyIri={ontologyIri}
				snapshot={snapshot}
			/>
		</div>
	);
};
export default IndividualCard;
