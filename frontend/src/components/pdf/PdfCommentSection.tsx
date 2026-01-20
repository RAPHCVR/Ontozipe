import React, { useState, useEffect } from "react";
import { CommentNode, Snapshot } from "../../types";
import { useApi } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";
import { v4 as uuidv4 } from "uuid";
import CommentBlock from "../comment/CommentComponent";
import { renderCommentWithPdfLinks } from "../individuals/IndividualCard";
import { usePdfModal } from "../../hooks/usePdfModal";
import PdfModal from "./PdfModal";
import { useTranslation } from "../../language/useTranslation";

interface PdfCommentSectionProps {
	pdfUrl: string;
	ontologyIri: string;
	snapshot: Snapshot;
}

const PdfCommentSection: React.FC<PdfCommentSectionProps> = ({
	pdfUrl,
	ontologyIri,
	snapshot,
}) => {
	const { t } = useTranslation();
	const api = useApi();
	const { user } = useAuth();
	const currentUserIri = user?.sub || "";

	const [comments, setComments] = useState<CommentNode[]>([]);
	const [draftComment, setDraftComment] = useState("");
	const [loading, setLoading] = useState(false);
	const [availablePdfs, setAvailablePdfs] = useState<
		{ url: string; originalName: string }[]
	>([]);

	// États pour l'auto-complétion @pdf avec navigation clavier
	const [showPdfAutocomplete, setShowPdfAutocomplete] = useState(false);
	const [pdfAutocompleteOptions, setPdfAutocompleteOptions] = useState<
		{ url: string; originalName: string }[]
	>([]);
	const [pdfAutocompleteIndex, setPdfAutocompleteIndex] = useState(0);

	// Hook pour gérer la modal PDF secondaire (pour les mentions PDF dans commentaires)
	const {
		isOpen: showSecondaryPdf,
		pdfUrl: secondaryPdfUrl,
		pdfName: secondaryPdfName,
		openModal: openSecondaryPdf,
		closeModal: closeSecondaryPdf,
	} = usePdfModal();

	useEffect(() => {
		fetchComments();
		extractPdfsFromSnapshot();
	}, [pdfUrl, ontologyIri, snapshot]);

	const fetchComments = async () => {
		// Convertir URL relative en URL absolue BACKEND (pas frontend)
		let fullPdfUrl = pdfUrl;
		if (pdfUrl && pdfUrl.startsWith("/uploads/")) {
			// URL uploads -> URL absolue BACKEND
			const API_BASE_URL =
				import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
			fullPdfUrl = `${API_BASE_URL}${pdfUrl}`;
		} else if (pdfUrl && pdfUrl.startsWith("/")) {
			// Autres URLs relatives -> frontend
			fullPdfUrl = `${window.location.origin}${pdfUrl}`;
		}

		if (!fullPdfUrl || !fullPdfUrl.startsWith("http")) {
			console.error(
				"PdfCommentSection: Cannot fetch comments, invalid pdfUrl:",
				fullPdfUrl
			);
			return;
		}

		setLoading(true);
		try {
			const url = `/ontology/comments?resource=${encodeURIComponent(
				fullPdfUrl
			)}&ontology=${encodeURIComponent(ontologyIri)}`;
			const res = await api(url);
			if (res.ok) {
				const list: CommentNode[] = await res.json();
				setComments(list);
			} else {
				console.error(
					"Failed to fetch PDF comments:",
					res.status,
					res.statusText
				);
			}
		} catch (error) {
			console.error("Error fetching PDF comments:", error);
		} finally {
			setLoading(false);
		}
	};

	const extractPdfsFromSnapshot = () => {
		if (!snapshot || !snapshot.individuals) {
			return;
		}

		// Extraire tous les PDFs des individus selon le même pattern qu'IndividualCard
		const allPdfs: { url: string; originalName: string }[] = [];
		snapshot.individuals.forEach((individual: any) => {
			if (individual.properties) {
				// Extraire URLs PDF depuis les propriétés
				const pdfUrls = individual.properties.filter(
					(p: any) =>
						p.predicate === "http://example.org/core#pdfUrl" &&
						typeof p.value === "string"
				);
				// Extraire noms originaux
				const pdfNames = individual.properties.filter(
					(p: any) =>
						p.predicate === "http://example.org/core#pdfOriginalName" &&
						typeof p.value === "string"
				);

				// Associer URL et nom
				pdfUrls.forEach((urlProp: any, i: number) => {
					allPdfs.push({
						url: urlProp.value,
						originalName:
							pdfNames[i]?.value ||
							urlProp.value.split("/").pop() ||
							"document.pdf",
					});
				});
			}
		});

		setAvailablePdfs(allPdfs);
	};

	// Détecte le déclencheur d'autocomplétion
	const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		setDraftComment(val);
		// Déclenche si @pdf ou [PDF: est tapé
		const trigger = /(@pdf|\[PDF:?)$/i;
		if (trigger.test(val)) {
			setShowPdfAutocomplete(true);
			setPdfAutocompleteOptions(availablePdfs);
			setPdfAutocompleteIndex(0);
		} else {
			setShowPdfAutocomplete(false);
		}
	};

	// Insertion de la mention PDF dans le commentaire
	const insertPdfMention = (pdf: { url: string; originalName: string }) => {
		// Remplace le dernier @pdf ou [PDF: par la balise
		setDraftComment((prev) =>
			prev.replace(/(@pdf|\[PDF:?)$/i, `[PDF:${pdf.originalName}]`)
		);
		setShowPdfAutocomplete(false);
	};

	const handleCreateComment = async (body: string, parent?: CommentNode) => {
		// Convertir URL relative en URL absolue backend
		let fullPdfUrl = pdfUrl;
		if (pdfUrl && pdfUrl.startsWith("/uploads/")) {
			const API_BASE_URL =
				import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
			fullPdfUrl = `${API_BASE_URL}${pdfUrl}`;
		} else if (pdfUrl && pdfUrl.startsWith("/")) {
			fullPdfUrl = `${window.location.origin}${pdfUrl}`;
		}

		if (!fullPdfUrl || !fullPdfUrl.startsWith("http")) {
			console.error(
				"PdfCommentSection: Invalid PDF URL for comment creation:",
				fullPdfUrl
			);
			return;
		}

		const payload = {
			id: `urn:uuid:${uuidv4()}`,
			body,
			onResource: fullPdfUrl,
			replyTo: parent?.id,
			ontologyIri: ontologyIri,
		};

		try {
			await api("/ontology/comments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			await fetchComments();
		} catch (error) {
			console.error("Error creating PDF comment:", error);
		}
	};

	const handleEditComment = async (comment: CommentNode, body: string) => {
		try {
			await api(`/ontology/comments/${encodeURIComponent(comment.id)}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					newBody: body,
					ontologyIri: ontologyIri,
				}),
			});
			await fetchComments();
		} catch (error) {
			console.error("Erreur lors de la modification du commentaire:", error);
		}
	};

	const handleDeleteComment = async (comment: CommentNode) => {
		try {
			await api(
				`/ontology/comments/${encodeURIComponent(
					comment.id
				)}?ontology=${encodeURIComponent(ontologyIri)}`,
				{ method: "DELETE" }
			);
			await fetchComments();
		} catch (error) {
			console.error("Erreur lors de la suppression du commentaire:", error);
		}
	};

	const participantCount = new Set(comments.map((c) => c.createdBy)).size;
	const rootComments = comments.filter((c) => !c.replyTo);

	// Gestionnaire pour les clics sur les mentions PDF dans les commentaires
	const handleCommentClick = (e: React.MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.classList.contains("pdf-mention-btn")) {
			e.preventDefault();
			const pdfUrl = target.getAttribute("data-pdf-url");
			const pdfName = target.textContent;
			if (pdfUrl) {
				openSecondaryPdf(pdfUrl, pdfName || "Document PDF");
			}
		}
	};

	return (
		<div className="pdf-comments">
			{/* En-tête */}
			<div className="pdf-comments__header">
				<h4 className="pdf-comments__title">
					💬 {t("pdf.comments.header")}
					{loading && (
						<span className="pdf-comments__loading">
							{t("pdf.comments.loading")}
						</span>
					)}
				</h4>
				<p className="pdf-comments__meta">
					{t("pdf.comments.meta", {
						comments: comments.length,
						participants: participantCount,
					})}
				</p>
			</div>
			{/* Zone de saisie */}
			<div className="pdf-comments__composer">
				<div className="pdf-comments__input">
					<textarea
						value={draftComment}
						onChange={handleCommentChange}
						placeholder={t("pdf.comments.placeholder")}
						rows={2}
						className="comment-block__textarea"
						onKeyDown={(e) => {
							if (showPdfAutocomplete && pdfAutocompleteOptions.length > 0) {
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
							} else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
								e.preventDefault();
								if (draftComment.trim()) {
									handleCreateComment(draftComment.trim());
									setDraftComment("");
								}
							}
						}}
					/>

					{/* Suggestions @pdf */}
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
				<div className="pdf-comments__actions">
					<span className="pdf-comments__shortcut">
						{t("pdf.comments.shortcut")}
					</span>
					<button
						disabled={!draftComment.trim()}
						onClick={() => {
							if (draftComment.trim()) {
								handleCreateComment(draftComment.trim());
								setDraftComment("");
							}
						}}
						className="button button--primary button--sm">
						{t("common.send")}
					</button>
				</div>
			</div>
			]{/* Liste des commentaires */}
			<div className="pdf-comments__list" onClick={handleCommentClick}>
				{loading ? (
					<div className="pdf-comments__empty">
						<div className="pdf-comments__empty-emoji">⏳</div>
						<p className="pdf-comments__empty-text">
							{t("pdf.comments.loading")}
						</p>
					</div>
				) : comments.length === 0 ? (
					<div className="pdf-comments__empty">
						<div className="pdf-comments__empty-emoji">📄</div>
						<p className="pdf-comments__empty-text">
							{t("pdf.comments.emptyTitle")}
						</p>
						<p className="pdf-comments__empty-subtext">
							{t("pdf.comments.emptySubtitle")}
						</p>
					</div>
				) : (
					<div className="pdf-comments__threads">
						{rootComments.map((comment) => (
							<CommentBlock
								key={comment.id}
								comment={comment}
								allComments={comments}
								snapshot={snapshot}
								onAddReply={(parent, body) => handleCreateComment(body, parent)}
								onEdit={handleEditComment}
								onDelete={handleDeleteComment}
								currentUserIri={currentUserIri}
								level={0}
								ontologyIri={ontologyIri}
								availablePdfs={availablePdfs}
								renderBody={(body: string) =>
									renderCommentWithPdfLinks(body, availablePdfs)
								}
							/>
						))}
					</div>
				)}
			</div>
			{/* Footer statistiques */}
			<div className="pdf-comments__footer">
				<span>💬 {t("pdf.comments.count", { count: comments.length })}</span>
				<span>
					👥 {t("pdf.comments.participants", { count: participantCount })}
				</span>
			</div>
			{/* Modal PDF secondaire pour les mentions dans commentaires */}
			<PdfModal
				isOpen={showSecondaryPdf}
				pdfUrl={secondaryPdfUrl}
				pdfName={secondaryPdfName}
				onClose={closeSecondaryPdf}
				ontologyIri={ontologyIri}
				snapshot={snapshot}
			/>
		</div>
	);
};

export default PdfCommentSection;
