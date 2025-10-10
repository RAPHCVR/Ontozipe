import React, { useMemo, useState, useEffect } from "react";
import PdfViewer from "../PdfViewer";
import { IndividualNode, Snapshot, CommentNode } from "../../types";
import { formatLabel } from "../../utils/formatLabel";
import { useAuth } from "../../auth/AuthContext";
import CommentBlock from "../comment/CommentComponent";
import { v4 as uuidv4 } from "uuid";
import { useApi } from "../../lib/api";

// Fonction utilitaire pour transformer [PDF:nom.pdf] en bouton cliquable et URLs PDF en liens
export function renderCommentWithPdfLinks(text: string, pdfs: { url: string, originalName: string }[]) {
	// Regex pour détecter les URLs PDF (http/https avec extension .pdf)
	const pdfUrlRegex = /(https?:\/\/[^\s]+\.pdf)/gi;
	
	// Première étape : transformer les mentions [PDF:nom.pdf]
	let processedText = text.split(/(\[PDF:[^\]]+\])/g).map((part, i) => {
		const match = part.match(/^\[PDF:(.+)\]$/);
		if (match) {
			const pdf = pdfs.find(p => p.originalName === match[1]);
			if (pdf) {
				return (
					<button
						key={`mention-${i}`}
						type="button"
						data-pdf-url={pdf.url}
						className="text-blue-700 hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit pdf-mention-btn"
					>
						{pdf.originalName}
					</button>
				);
			}
		}
		// Deuxième étape : transformer les URLs PDF brutes dans cette partie
		if (typeof part === 'string' && pdfUrlRegex.test(part)) {
			return part.split(pdfUrlRegex).map((segment, j) => {
				if (segment.match(pdfUrlRegex)) {
					return (
						<a
							key={`url-${i}-${j}`}
							href={segment}
							target="_blank"
							rel="noopener noreferrer"
							className="text-blue-700 hover:underline cursor-pointer"
						>
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
	onEdit: (ind: IndividualNode) => void;
	onDelete: (ind: IndividualNode) => void;
}> = ({
	ind,
	snapshot,
	onShow,
	idx,
	defaultOpen = false,
	onEdit,
	onDelete,
}) => {
	// Utilisateur courant depuis le contexte d’authentification
	const { user } = useAuth();
	const api = useApi();
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
	const pdfUrls = useMemo(() =>
		(ind.properties || [])
			.filter(
				(p) =>
					p.predicate === "http://example.org/core#pdfUrl" &&
					typeof p.value === "string" &&
					p.value.endsWith(".pdf")
			),
		[ind.properties]
	);
	const pdfNames = useMemo(() =>
		(ind.properties || [])
			.filter(
				(p) =>
					p.predicate === "http://example.org/core#pdfOriginalName" &&
					typeof p.value === "string"
			),
		[ind.properties]
	);
	// Associe chaque url à son nom original (par index)
	const pdfs = pdfUrls.map((u, i) => ({
		url: u.value,
		originalName: pdfNames[i]?.value || u.value.split('/').pop() || u.value,
	}));

	const uniqueProps = useMemo(() => {
		const m = new Map<string, typeof ind.properties[number]>();
		for (const p of ind.properties || []) {
			const key = `${p.predicate}||${p.isLiteral ? "L" : "R"}||${p.value}`;
			const prev = m.get(key);
			if (!prev) m.set(key, p);
			else {
				// conserve la variante la plus "riche" en libellés
				if ((!prev.valueLabel && p.valueLabel) || (!prev.predicateLabel && p.predicateLabel)) {
					m.set(key, p);
				}
			}
		}
		return Array.from(m.values());
	}, [ind.properties]);

    // Puis utilise uniqueProps à la place de ind.properties
    const filteredProps =
        (uniqueProps || []).filter((prop) => !prop.predicate.endsWith("label")) || [];

	const dataProps = filteredProps.filter(
		(p) =>
			p.isLiteral &&
			p.predicate !== "http://example.org/core#pdfUrl" &&
			p.predicate !== "http://example.org/core#pdfOriginalName"
	);
    const relProps  = filteredProps.filter((p) => !p.isLiteral);

	const hasData = dataProps.length > 0 || relProps.length > 0;

	// ---- COMMENTS (stateful) ----
	const [comments, setComments] = useState<CommentNode[]>([]);

	// état d’ouverture de la carte
	const [open, setOpen] = useState(defaultOpen);

	// récupère les commentaires dès que la carte s'ouvre ou change de ressource
	useEffect(() => {
		if (open) {
			fetchComments();
		}
	}, [open, ind.id, ontologyIri]);

	// saisie rapide d'un nouveau commentaire
	const [draftComment, setDraftComment] = useState("");
	const [showPdfAutocomplete, setShowPdfAutocomplete] = useState(false);
	const [pdfAutocompleteOptions, setPdfAutocompleteOptions] = useState(pdfs);
	const [pdfAutocompleteIndex, setPdfAutocompleteIndex] = useState(0);

	// États pour la modal PDF des documents associés
	const [showPdfModal, setShowPdfModal] = useState(false);
	const [currentPdfUrl, setCurrentPdfUrl] = useState<string>("");

	// Handler pour ouvrir la modal PDF
	const openPdfModal = (pdfUrl: string) => {
		setCurrentPdfUrl(pdfUrl);
		setShowPdfModal(true);
	};

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
	const insertPdfMention = (pdf: typeof pdfs[number]) => {
		// Remplace le dernier @pdf ou [PDF: par la balise
		setDraftComment((prev) =>
			prev.replace(/(@pdf|\[PDF:?)$/i, `[PDF:${pdf.originalName}]`)
		);
		setShowPdfAutocomplete(false);
	};

	// helper: refresh from API after mutation
	const fetchComments = async () => {
		const url = `/ontology/comments?resource=${encodeURIComponent(
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
		await api("/ontology/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		await fetchComments();
	};

	// UPDATE
	const handleEditComment = async (comment: CommentNode, body: string) => {
		await api(
			`/ontology/comments/${encodeURIComponent(
				comment.id
			)}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					newBody: body,
					ontologyIri: ontologyIri,
				}),
			}
		);
		await fetchComments();
	};

	// DELETE
	const handleDeleteComment = async (comment: CommentNode) => {
		await api(
			`/ontology/comments/${encodeURIComponent(
				comment.id
			)}?ontology=${encodeURIComponent(ontologyIri)}`,
			{ method: "DELETE" }
		);
		await fetchComments();
	};

	return (
		<div
			className={`p-3 pl-4 border-l-4 border-indigo-500 space-y-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
				idx % 2 === 0
					? "bg-white dark:bg-slate-700"
					: "bg-slate-50 dark:bg-slate-800"
			}`}>
			<div
				className="flex items-center justify-between cursor-pointer"
				onClick={() => setOpen((v: any) => !v)}>
				<span className="font-medium">{formatLabel(ind.label)}</span>
				<div className="flex items-center gap-2">
					{isCreator && (
						<>
							<button
								title="Supprimer"
								onClick={(e) => {
									e.stopPropagation();
									onDelete(ind);
								}}
								className="text-red-500 hover:text-red-700 text-sm">
								🗑
							</button>
							<button
								title="Modifier"
								onClick={(e) => {
									e.stopPropagation();
									onEdit(ind);
								}}
								className="text-indigo-500 hover:text-indigo-700 text-sm">
								✎
							</button>
						</>
					)}
					<span className="text-gray-400 dark:text-gray-500">
						{open ? "▼" : "▶"}
					</span>
				</div>
			</div>
				{open && (
					<div className="space-y-3">
						{/* ---- PDFS ASSOCIÉS ---- */}
						{pdfs.length > 0 && (
							<div>
								<h4 className="text-xs font-semibold text-blue-600 mb-1">
									Documents PDF associés
								</h4>
								<ul className="space-y-1">
									{pdfs.map((pdf, idx) => (
										<li key={idx}>
											<button
												type="button"
												onClick={() => openPdfModal(pdf.url)}
												className="text-blue-700 hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
											>
												{pdf.originalName}
											</button>
											<span className="ml-2 text-xs text-gray-400">(cliquer pour prévisualiser)</span>
										</li>
									))}
								</ul>
							</div>
						)}
					{/* ---- DATA SECTION ---- */}
					{dataProps.length > 0 && (
						<div>
							<h4 className="text-xs font-semibold text-indigo-500 mb-1">
								Données
							</h4>
							<div className="overflow-x-auto">
								<table className="text-xs min-w-full">
									<tbody className="divide-y divide-slate-600/30 dark:divide-slate-600/60">
										{dataProps.map((prop, idx) => (
											<tr key={idx} className="align-top">
												<th className="py-1 pr-2 text-left font-medium whitespace-nowrap">
													{formatLabel(
														prop.predicateLabel ||
															prop.predicate.split(/[#/]/).pop() ||
															""
													)}
												</th>
												<td className="py-1 break-all">
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
																	className="text-sky-600 hover:underline">
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

					{/* ---- RELATIONS SECTION ---- */}
					{relProps.length > 0 && (
						<div>
							<h4 className="text-xs font-semibold text-emerald-600 mb-1">
								Relations
							</h4>
							<div className="flex flex-wrap gap-1">
								{relProps.map((prop, idx) => {
									const target =
										snapshot.individuals.find((t) => t.id === prop.value) ||
										snapshot.persons.find((t) => t.id === prop.value);

									const hasData = !!target && (target.properties?.length ?? 0) > 0;

									const label = formatLabel(
										target?.label ||
										prop.valueLabel ||
										(prop.value.startsWith("http")
											? prop.value.split(/[#/]/).pop() || prop.value
											: prop.value)
									);

									const chipClass = hasData
										? "bg-emerald-700/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300 hover:bg-emerald-700/20"
										: "bg-slate-400/10 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300 border border-dashed border-slate-400/50 hover:bg-slate-400/20";

									const title = hasData
										? "Ouvrir les détails (données disponibles)"
										: "Ouvrir les détails (aucune donnée spécifique)";

									return (
										<span key={idx} className="relative group">
											<button
												onClick={() => target && onShow(target)}
												className={`${chipClass} text-xs px-2 py-0.5 rounded-full transition-colors cursor-pointer`}
												title={title}
											>
											{hasData ? "● " : "○ "}
												{label}
											</button>
											<span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 invisible group-hover:visible opacity-100 text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-20 bg-gray-800 text-white">
											{formatLabel(
												prop.predicateLabel || prop.predicate.split(/[#/]/).pop() || ""
											)}
											</span>
										</span>
									);
								})}
							</div>
						</div>
					)}

					{/* ---- GROUPES COMMUNS ---- */}
					{commonGroups.length > 0 && (
						<div>
							<h4 className="text-xs font-semibold text-purple-600 mb-1">
								Groupes communs
							</h4>
							<div className="flex flex-wrap gap-1">
								{commonGroups.map((g, idx) => (
									<span
										key={idx}
										className="bg-purple-700/10 text-purple-700 dark:bg-purple-400/10 dark:text-purple-300 text-xs px-2 py-0.5 rounded-full">
										{formatLabel(
											g.label || g.iri.split(/[#/]/).pop() || g.iri
										)}
									</span>
								))}
							</div>
						</div>
					)}

					{/* ---- COMMENTAIRES ---- */}
					<div>
						<h4 className="text-xs font-semibold text-yellow-600 mb-1">
							Commentaires
						</h4>
						{/* zone de saisie */}
						<div className="flex items-start gap-2 mb-2">
							<div className="relative w-full">
								<textarea
									value={draftComment}
									onChange={handleCommentChange}
									placeholder="Ajouter un commentaire…"
									rows={2}
									className="flex-1 text-xs border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-600 resize-none w-full"
									onKeyDown={(e) => {
										if (showPdfAutocomplete && pdfAutocompleteOptions.length > 0) {
											if (e.key === "ArrowDown") {
												e.preventDefault();
												setPdfAutocompleteIndex((i) => (i + 1) % pdfAutocompleteOptions.length);
											} else if (e.key === "ArrowUp") {
												e.preventDefault();
												setPdfAutocompleteIndex((i) => (i - 1 + pdfAutocompleteOptions.length) % pdfAutocompleteOptions.length);
											} else if (e.key === "Enter") {
												e.preventDefault();
												insertPdfMention(pdfAutocompleteOptions[pdfAutocompleteIndex]);
											} else if (e.key === "Escape") {
												setShowPdfAutocomplete(false);
											}
										}
									}}
								/>
								{showPdfAutocomplete && pdfAutocompleteOptions.length > 0 && (
									<ul className="absolute left-0 top-full z-50 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded shadow w-64 max-h-40 overflow-auto text-xs mt-1">
										{pdfAutocompleteOptions.map((pdf, idx) => (
											<li
												key={pdf.url}
												className={
													"px-2 py-1 cursor-pointer " +
													(idx === pdfAutocompleteIndex
														? "bg-indigo-600 text-white"
														: "hover:bg-indigo-100 dark:hover:bg-slate-700")
												}
												onMouseDown={() => insertPdfMention(pdf)}
											>
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
								className="self-stretch px-3 py-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white text-xs rounded">
								Envoyer
							</button>
						</div>
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
																renderBody={(body: string) => renderCommentWithPdfLinks(body, pdfs)}
															/>
														))}
												</div>
					</div>

					{dataProps.length === 0 && relProps.length === 0 && (
						<p className="text-xs italic text-gray-500">
							Aucune donnée disponible
						</p>
					)}
				</div>
			)}

			{/* Modal PDF pour les documents associés */}
			{showPdfModal && currentPdfUrl && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
					<div className="bg-white dark:bg-slate-900 rounded shadow-lg p-6 max-w-5xl w-full relative">
						<button
							onClick={() => setShowPdfModal(false)}
							className="absolute top-2 right-2 text-gray-600 dark:text-gray-300 hover:text-red-500 text-2xl"
							title="Fermer"
						>
							✖
						</button>
						<PdfViewer fileUrl={currentPdfUrl} height={window.innerHeight * 0.8 - 100} />
					</div>
				</div>
			)}
		</div>
	);
};
export default IndividualCard;
