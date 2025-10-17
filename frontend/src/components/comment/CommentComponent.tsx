import React, { useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { CommentNode, Snapshot } from "../../types";
import { formatLabel } from "../../utils/formatLabel";
import PdfModal from "../pdf/PdfModal";
import { usePdfModal } from "../../hooks/usePdfModal";

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
	availablePdfs?: {url: string, originalName: string}[];
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

	const isAuthor = currentUserIri === comment.createdBy;
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(comment.body);

	const [replying, setReplying] = useState(false);
	const [replyDraft, setReplyDraft] = useState("");
	
	// États pour l'auto-complétion @pdf avec navigation clavier
	const [pdfSuggestions, setPdfSuggestions] = useState<{ url: string; originalName: string }[]>([]);
	const [selectedPdfIndex, setSelectedPdfIndex] = useState(0);
	const [showPdfSuggestions, setShowPdfSuggestions] = useState(false);

	// Hook pour gérer la modal PDF (uniquement pour les mentions [PDF:...])
	const { isOpen: showPdfModal, pdfUrl: currentPdfUrl, pdfName: currentPdfName, openModal: openPdfModal, closeModal: closePdfModal } = usePdfModal();

	// Rendu du corps du commentaire
	const renderedBody = renderBody ? renderBody(comment.body) : comment.body;

	// Handler pour intercepter les clics sur les boutons PDF mentions (modal)
	const handleCommentClick = (e: React.MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.classList.contains('pdf-mention-btn')) {
			e.preventDefault();
			e.stopPropagation();
			const pdfUrl = target.getAttribute('data-pdf-url');
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
				case 'ArrowDown':
					e.preventDefault();
					setSelectedPdfIndex(prev => (prev + 1) % pdfSuggestions.length);
					break;
				case 'ArrowUp':
					e.preventDefault();
					setSelectedPdfIndex(prev => (prev - 1 + pdfSuggestions.length) % pdfSuggestions.length);
					break;
				case 'Enter':
					e.preventDefault();
					const selectedPdf = pdfSuggestions[selectedPdfIndex];
					insertPdfMention(selectedPdf);
					break;
				case 'Escape':
					setShowPdfSuggestions(false);
					setSelectedPdfIndex(0);
					break;
			}
		}
	};

	// Fonction pour insérer une mention PDF
	const insertPdfMention = (pdf: {url: string, originalName: string}) => {
		const cursorPosition = replyDraft.length; // Position à la fin pour simplifier
		const beforeCursor = replyDraft.slice(0, cursorPosition);
		const afterCursor = replyDraft.slice(cursorPosition);
		
		// Remplacer @pdf par [PDF:filename]
		const beforeMatch = beforeCursor.replace(/@pdf\s*$/i, '');
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
		"Utilisateur";

	return (
		<div
			style={{ marginLeft: level * 16 }}
			className="pb-3 mb-3 text-sm max-w-prose border-l-2 pl-3 border-b border-slate-200 dark:border-slate-700"
			onClick={handleCommentClick}>
			<div className="flex-1 space-y-0.5">
				<div className="flex items-center gap-2">
					<span className="font-semibold">{formatLabel(authorName)}</span>
					<span className="text-xs text-gray-500">
						{dayjs(comment.createdAt).fromNow()}
					</span>
				</div>
				{editing ? (
					<div>
						<textarea
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							rows={3}
							className="w-full text-xs border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-600 resize-none"
						/>
						<div className="flex gap-2 justify-end mt-1">
							<button
								onClick={() => {
									setEditing(false);
									if (draft.trim() && draft.trim() !== comment.body) {
										   onEdit(comment, draft.trim());
									   }
								   }}
								   className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded">
									   📤
								   </button>
							<button
								onClick={() => {
									setEditing(false);
									setDraft(comment.body);
								}}
								title="Annuler"
								className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded">
								❌
							</button>
						</div>
					</div>
				   ) : (
					   <p className="whitespace-pre-wrap">
						   {renderedBody}
					   </p>
				   )}
				<div className="flex items-center gap-3 text-xs text-sky-600">
					<button onClick={() => setReplying((v) => !v)} title="Répondre">
						Repondre
					</button>
					{isAuthor && !editing && (
						<>
							<button onClick={() => setEditing(true)} title="Modifier">
								📝
							</button>
							<button
								onClick={() => onDelete(comment)}
								title="Supprimer"
								className="text-red-500">
								🗑️
							</button>
						</>
					)}
				</div>
				{replying && (
					<div className="mt-2 relative">
						<textarea
							value={replyDraft}
							onChange={handleReplyTextChange}
							onKeyDown={handleReplyKeyDown}
							rows={3}
							className="w-full text-xs border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-600 resize-none"
							placeholder="Votre réponse… (tapez @pdf pour suggérer des documents)"
						/>
						
						{/* Suggestions @pdf */}
						{showPdfSuggestions && pdfSuggestions.length > 0 && (
							<ul className="absolute left-0 top-full z-50 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded shadow w-64 max-h-40 overflow-auto text-xs mt-1">
								{pdfSuggestions.map((pdf, index) => (
									<li
										key={pdf.url}
										className={
											"px-2 py-1 cursor-pointer " +
											(index === selectedPdfIndex
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
						<div className="flex gap-2 justify-end mt-1">
							<button
								disabled={!replyDraft.trim()}
								onClick={() => {
									if (replyDraft.trim()) {
										onAddReply(comment, replyDraft.trim());
										setReplyDraft("");
										setReplying(false);
										setShowPdfSuggestions(false);
										setSelectedPdfIndex(0);
									}
								}}
								title="Envoyer"
								className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white text-xs rounded">
								📤
							</button>
							<button
								onClick={() => {
									setReplying(false);
									setReplyDraft("");
									setShowPdfSuggestions(false);
									setSelectedPdfIndex(0);
								}}
								title="Annuler"
								className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded">
								❌
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Modal PDF unifiée (uniquement pour mentions [PDF:...]) */}

			<PdfModal
				isOpen={showPdfModal}
				pdfUrl={currentPdfUrl}
				pdfName={currentPdfName}
				onClose={closePdfModal}
				ontologyIri={ontologyIri}
				snapshot={snapshot}
			/>

			{/* ----- link to show/hide replies ----- */}
			{replies.length > 0 && (
				<div className="mt-1">
					{!showReplies ? (
						<button
							onClick={() => setShowReplies(true)}
							className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
							title="Afficher les réponses">
							↳
							<span>
								{replies.length} réponse{replies.length > 1 && "s"} à ce message
							</span>
						</button>
					) : (
						<button
							onClick={() => setShowReplies(false)}
							className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
							title="Fermer les réponses">
							↩︎
							<span>Refermer les réponses</span>
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
