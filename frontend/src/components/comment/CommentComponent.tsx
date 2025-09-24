import React, { useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { CommentNode, Snapshot } from "../../types";
import { formatLabel } from "../../utils/formatLabel";

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
}) => {
	const replies = allComments.filter((c) => c.replyTo === comment.id);
	const [showReplies, setShowReplies] = useState(false);

	const isAuthor = currentUserIri === comment.createdBy;
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(comment.body);

	const [replying, setReplying] = useState(false);
	const [replyDraft, setReplyDraft] = useState("");

	// PDF modal state and match
	const [showPdfModal, setShowPdfModal] = useState(false);
	const pdfMatch = comment.body.match(/https?:\/\/[^\s]+\.pdf/);

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
			className="pb-3 mb-3 text-sm max-w-prose border-l-2 pl-3 border-b border-slate-200 dark:border-slate-700">
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
						   {renderBody ? renderBody(comment.body) : comment.body}
					   </p>
				   )}
				<div className="flex items-center gap-3 text-xs text-sky-600">
					<button onClick={() => setReplying((v) => !v)} title="Répondre">
						Repondre
					</button>
					{pdfMatch && !editing && (
						<button
							onClick={() => setShowPdfModal(true)}
							title="Voir le PDF"
							className="text-yellow-700 bg-yellow-100 border border-yellow-300 rounded px-2 py-1 hover:bg-yellow-200"
						>
							📄
						</button>
					)}
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
					<div className="mt-2">
						<textarea
							value={replyDraft}
							onChange={(e) => setReplyDraft(e.target.value)}
							rows={3}
							className="w-full text-xs border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-600 resize-none"
							placeholder="Votre réponse…"
						/>
						<div className="flex gap-2 justify-end mt-1">
							<button
								disabled={!replyDraft.trim()}
								onClick={() => {
									if (replyDraft.trim()) {
										onAddReply(comment, replyDraft.trim());
										setReplyDraft("");
										setReplying(false);
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
								}}
								title="Annuler"
								className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded">
								❌
							</button>
						</div>
					</div>
				)}
			</div>

			{/* ----- PDF Modal ----- */}
			{showPdfModal && pdfMatch && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
					<div className="bg-white dark:bg-slate-900 rounded shadow-lg p-6 max-w-5xl w-full relative">
						<button
							onClick={() => setShowPdfModal(false)}
							className="absolute top-2 right-2 text-gray-600 dark:text-gray-300 hover:text-red-500 text-2xl"
							title="Fermer"
						>
							✖
						</button>
						<iframe
							src={pdfMatch[0]}
							title="Aperçu PDF"
							className="w-full h-[80vh] border"
							frameBorder="0"
						></iframe>
					</div>
				</div>
			)}

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
					/>
				))}
		</div>
	);
};

export default CommentBlock;
