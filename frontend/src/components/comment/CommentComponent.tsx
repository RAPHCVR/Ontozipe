import React, { useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { CommentNode, Snapshot } from "../../types";
import { formatLabel } from "../../utils/formatLabel";
import { useTranslation } from "../../language/useTranslation";

dayjs.extend(relativeTime);

/**
 * Bloc de commentaire (style StackOverflow) – gère récursivement ses réponses.
 */
const CommentBlock: React.FC<{
	comment: CommentNode;
	allComments: CommentNode[];
	snapshot: Snapshot;
	onAddReply: (parent: CommentNode, body: string) => void;
	onEdit: (comment: CommentNode, body: string) => void;
	onDelete: (comment: CommentNode) => void;
	currentUserIri: string;
	level?: number;
}> = ({
	comment,
	allComments,
	snapshot,
	onAddReply,
	onEdit,
	onDelete,
	currentUserIri,
	level = 0,
}) => {
	const replies = allComments.filter((c) => c.replyTo === comment.id);
	const [showReplies, setShowReplies] = useState(false);
	const { t } = useTranslation();

	const isAuthor = currentUserIri === comment.createdBy;
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(comment.body);

	const [replying, setReplying] = useState(false);
	const [replyDraft, setReplyDraft] = useState("");

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
								title={t("common.send")}
								className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded">
								📤
							</button>
							<button
								onClick={() => {
									setEditing(false);
									setDraft(comment.body);
								}}
								title={t("common.cancel")}
								className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded">
								❌
							</button>
						</div>
					</div>
				) : (
					<p className="whitespace-pre-wrap">{comment.body}</p>
				)}
				<div className="flex items-center gap-3 text-xs text-sky-600">
					<button onClick={() => setReplying((v) => !v)} title={t("comment.replyAction")}>
						{t("comment.reply")}
					</button>
					{isAuthor && !editing && (
						<>
							<button onClick={() => setEditing(true)} title={t("common.edit")}>
								📝
							</button>
							<button
								onClick={() => onDelete(comment)}
								title={t("common.delete")}
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
							placeholder={t("comment.replyPlaceholder")}
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
								title={t("common.send")}
								className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white text-xs rounded">
								📤
							</button>
							<button
								onClick={() => {
									setReplying(false);
									setReplyDraft("");
								}}
								title={t("common.cancel")}
								className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded">
								❌
							</button>
						</div>
					</div>
				)}
			</div>

			{/* ----- link to show/hide replies ----- */}
			{replies.length > 0 && (
				<div className="mt-1">
					{!showReplies ? (
						<button
							onClick={() => setShowReplies(true)}
							className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
							title={t("comment.showReplies")}
						>
							↳
							<span>
								{replies.length === 1
									? t("comment.replyCount.one")
									: t("comment.replyCount.other", { count: replies.length })}
							</span>
						</button>
					) : (
						<button
							onClick={() => setShowReplies(false)}
							className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
							title={t("comment.hideReplies")}
						>
							↩︎
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
					/>
				))}
		</div>
	);
};

export default CommentBlock;
