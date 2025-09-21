import React, { useMemo, useState, useEffect } from "react";
import PdfViewer from "../PdfViewer";
import { IndividualNode, Snapshot, CommentNode } from "../../types";
import { formatLabel } from "../../utils/formatLabel";
import { useAuth } from "../../auth/AuthContext";
import CommentBlock from "../comment/CommentComponent";
import { v4 as uuidv4 } from "uuid";
import { useApi } from "../../lib/api";

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

	

	// Extraction des URLs PDF associées à l'individu
	const pdfUrls = useMemo(
		() =>
			(ind.properties || [])
				.filter(
					(p: typeof ind.properties[number]) =>
						p.predicate === "http://example.org/core#pdfUrl" &&
						typeof p.value === "string" &&
						p.value.endsWith(".pdf")
				)
				.map((p) => p.value),
		[ind.properties]
	);

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

    const dataProps = filteredProps.filter((p) => p.isLiteral);
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
							<textarea
								value={draftComment}
								onChange={(e) => setDraftComment(e.target.value)}
								placeholder="Ajouter un commentaire…"
								rows={2}
								className="flex-1 text-xs border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-600 resize-none"
							/>
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
		</div>
	);
};
export default IndividualCard;
