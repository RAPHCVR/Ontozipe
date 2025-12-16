import React, { useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { CommentNode, Snapshot } from "../../types";
import { formatLabel } from "../../utils/formatLabel";
import PdfModal from "../pdf/PdfModal";
import { usePdfModal } from "../../hooks/usePdfModal";
import { useTranslation } from "../../language/useTranslation";

dayjs.extend(relativeTime);

/**
 * Bloc de commentaire (style StackOverflow) – gère récursivement ses réponses.
 */
// Removed duplicate CommentBlock declaration
type CommentBlockProps = {
	comment: CommentNode;
	allComments: CommentNode[];
	snapshot: Snapshot;
	onAddReply: (parent: CommentNode, body: string) => void;
	onEdit: (comment: CommentNode, body: string) => void;
	onDelete: (comment: CommentNode) => void;
	currentUserIri: string;
	level?: number;
	renderBody?: (body: string) => React.ReactNode;
	ontologyIri?: string;
	availablePdfs?: { url: string; originalName: string }[];
};

const CommentBlock: React.FC<CommentBlockProps> = ({
	comment,
	allComments,
	snapshot,
	onAddReply,
	onEdit,
	onDelete,
	currentUserIri,
	level = 0,
	renderBody,
	ontologyIri,
	availablePdfs = [],
}) => {
	const replies = allComments.filter((c) => c.replyTo === comment.id);
	const [showReplies, setShowReplies] = useState(false);
	const { t } = useTranslation();

	const isAuthor = currentUserIri === comment.createdBy;
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(comment.body);

	const [replying, setReplying] = useState(false);
	const [replyDraft, setReplyDraft] = useState("");

	// États pour l'auto-complétion @pdf avec navigation clavier
	const [pdfSuggestions, setPdfSuggestions] = useState<
		{ url: string; originalName: string }[]
	>([]);
	const [selectedPdfIndex, setSelectedPdfIndex] = useState(0);
	const [showPdfSuggestions, setShowPdfSuggestions] = useState(false);

	// Hook pour gérer la modal PDF (uniquement pour les mentions [PDF:...])
	const {
		isOpen: showPdfModal,
		pdfUrl: currentPdfUrl,
		pdfName: currentPdfName,
		openModal: openPdfModal,
		closeModal: closePdfModal,
	} = usePdfModal();

	// Rendu du corps du commentaire
	const renderedBody = renderBody ? renderBody(comment.body) : comment.body;

	// Handler pour intercepter les clics sur les boutons PDF mentions (modal)
	const handleCommentClick = (e: React.MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.classList.contains("pdf-mention-btn")) {
			e.preventDefault();
			e.stopPropagation();
			const pdfUrl = target.getAttribute("data-pdf-url");
			const pdfName = target.textContent;
			if (pdfUrl) {
				openPdfModal(pdfUrl, pdfName || undefined);
			}
		}
	};

	// Fonction pour gérer les changements dans la zone de réponse avec auto-complétion @pdf
	const handleReplyTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const value = e.target.value;
		setReplyDraft(value);

		// Détecter @pdf pour afficher suggestions
		const cursorPosition = e.target.selectionStart;
		const beforeCursor = value.slice(0, cursorPosition);
		const match = beforeCursor.match(/@pdf\s*$/i);

		if (match && availablePdfs.length > 0) {
			setPdfSuggestions(availablePdfs);
			setSelectedPdfIndex(0); // Toujours réinitialiser à 0
			setShowPdfSuggestions(true);
		} else {
			setShowPdfSuggestions(false);
			setSelectedPdfIndex(0);
		}
	};

	// Fonction pour gérer la navigation au clavier dans les suggestions
	const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (showPdfSuggestions && pdfSuggestions.length > 0) {
			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedPdfIndex((prev) => (prev + 1) % pdfSuggestions.length);
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedPdfIndex(
						(prev) => (prev - 1 + pdfSuggestions.length) % pdfSuggestions.length
					);
					break;
				case "Enter":
					e.preventDefault();
					const selectedPdf = pdfSuggestions[selectedPdfIndex];
					insertPdfMention(selectedPdf);
					break;
				case "Escape":
					setShowPdfSuggestions(false);
					setSelectedPdfIndex(0);
					break;
			}
		}
	};

	// Fonction pour insérer une mention PDF
	const insertPdfMention = (pdf: { url: string; originalName: string }) => {
		const cursorPosition = replyDraft.length; // Position à la fin pour simplifier
		const beforeCursor = replyDraft.slice(0, cursorPosition);
		const afterCursor = replyDraft.slice(cursorPosition);

		// Remplacer @pdf par [PDF:filename]
		const beforeMatch = beforeCursor.replace(/@pdf\s*$/i, "");
		const newValue = `${beforeMatch}[PDF:${pdf.originalName}]${afterCursor}`;

		setReplyDraft(newValue);
		setShowPdfSuggestions(false);
		setSelectedPdfIndex(0); // Réinitialiser après insertion
	};

	const authorNode = snapshot.persons.find((p) => p.id === comment.createdBy);
	const authorName =
		authorNode?.properties?.find((pr) => /foaf.*name$/i.test(pr.predicate))
			?.value ||
		authorNode?.label ||
		comment.createdBy.split(/[#/]/).pop() ||
		t("common.user");

	return (
		<div
			style={{ marginLeft: level * 16 }}
			className="comment-block"
			onClick={handleCommentClick}>
			<div className="comment-block__content">
				<div className="comment-block__meta">
					<div className="comment-block__avatar" aria-hidden>
						<i className="fas fa-user" />
					</div>
					<div>
						<div className="comment-block__author">
							{formatLabel(authorName)}
						</div>
						<div className="comment-block__time">
							{dayjs(comment.createdAt).fromNow()}
						</div>
					</div>
				</div>
				{editing ? (
					<div className="comment-block__editor">
						<textarea
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							rows={3}
							className="comment-block__textarea"
						/>
						<div className="comment-block__actions comment-block__actions--end">
							<button
								onClick={() => {
									setEditing(false);
									if (draft.trim() && draft.trim() !== comment.body) {
										onEdit(comment, draft.trim());
									}
								}}
								title={t("common.send")}
								className="button button--primary button--sm">
								<i className="fas fa-check" aria-hidden /> {t("common.save")}
							</button>
							<button
								onClick={() => {
									setEditing(false);
									setDraft(comment.body);
								}}
								title={t("common.cancel")}
								className="button button--ghost button--sm">
								<i className="fas fa-times" aria-hidden /> {t("common.cancel")}
							</button>
						</div>
					</div>
				) : (
					<p className="comment-block__body">{renderedBody}</p>
				)}
				<div className="comment-block__actions">
					<button
						onClick={() => setReplying((v) => !v)}
						title={t("comment.replyAction")}>
						<i className="fas fa-reply" aria-hidden /> {t("comment.reply")}
					</button>
					{isAuthor && !editing && (
						<>
							<button onClick={() => setEditing(true)} title={t("common.edit")}>
								<i className="fas fa-edit" aria-hidden /> {t("common.edit")}
							</button>
							<button
								onClick={() => {
									if (!window.confirm(t("comment.confirm.delete"))) return;
									onDelete(comment);
								}}
								title={t("common.delete")}
								className="comment-block__action--danger">
								<i className="fas fa-trash" aria-hidden /> {t("common.delete")}
							</button>
						</>
					)}
				</div>
				{replying && (
					<div className="comment-block__reply">
						<textarea
							value={replyDraft}
							onChange={handleReplyTextChange}
							onKeyDown={handleReplyKeyDown}
							rows={3}
							className="comment-block__textarea"
							placeholder={t("comment.replyPlaceholder")}
						/>

						{showPdfSuggestions && pdfSuggestions.length > 0 && (
							<ul className="comment-suggestions">
								{pdfSuggestions.map((pdf, index) => (
									<li
										key={pdf.url}
										className={
											"comment-suggestions__item" +
											(index === selectedPdfIndex ? " is-active" : "")
										}
										onMouseDown={() => insertPdfMention(pdf)}>
										{pdf.originalName}
									</li>
								))}
							</ul>
						)}
						<div className="comment-block__actions comment-block__actions--end">
							<button
								onClick={() => {
									if (replyDraft.trim()) {
										onAddReply(comment, replyDraft.trim());
										setReplyDraft("");
										setReplying(false);
										setShowPdfSuggestions(false);
										setSelectedPdfIndex(0);
									}
								}}
								title={t("common.send")}
								className="button button--primary button--sm"
								disabled={!replyDraft.trim()}>
								<i className="fas fa-paper-plane" aria-hidden /> {t("common.send")}
							</button>
							<button
								onClick={() => {
									setReplying(false);
									setReplyDraft("");
									setShowPdfSuggestions(false);
									setSelectedPdfIndex(0);
								}}
								title={t("common.cancel")}
								className="button button--ghost button--sm">
								<i className="fas fa-times" aria-hidden /> {t("common.cancel")}
							</button>
						</div>
					</div>
				)}
			</div>

			<PdfModal
				isOpen={showPdfModal}
				pdfUrl={currentPdfUrl}
				pdfName={currentPdfName}
				onClose={closePdfModal}
				ontologyIri={ontologyIri}
				snapshot={snapshot}
			/>

			{replies.length > 0 && (
				<div className="comment-block__toggle-wrap">
					{!showReplies ? (
						<button
							onClick={() => setShowReplies(true)}
							className="comment-block__toggle"
							title={t("comment.showReplies")}>
							<i className="fas fa-chevron-down" aria-hidden />
							<span>
								{replies.length === 1
									? t("comment.replyCount.one")
									: t("comment.replyCount.other", { count: replies.length })}
							</span>
						</button>
					) : (
						<button
							onClick={() => setShowReplies(false)}
							className="comment-block__toggle"
							title={t("comment.hideReplies")}>
							<i className="fas fa-chevron-up" aria-hidden />
							<span>{t("comment.hideReplies")}</span>
						</button>
					)}
				</div>
			)}

			{showReplies &&
				replies.map((rep) => (
					<CommentBlock
						key={rep.id}
						comment={rep}
						allComments={allComments}
						snapshot={snapshot}
						onAddReply={onAddReply}
						onEdit={onEdit}
						onDelete={onDelete}
						currentUserIri={currentUserIri}
						level={level + 1}
						renderBody={renderBody}
						ontologyIri={ontologyIri}
						availablePdfs={availablePdfs}
					/>
				))}
		</div>
	);
};

export default CommentBlock;
