import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { formatLabel } from "../../utils/formatLabel";
dayjs.extend(relativeTime);
/**
 * Bloc de commentaire (style StackOverflow) – gère récursivement ses réponses.
 */
const CommentBlock = ({ comment, allComments, snapshot, onAddReply, onEdit, onDelete, currentUserIri, level = 0, }) => {
    const replies = allComments.filter((c) => c.replyTo === comment.id);
    const [showReplies, setShowReplies] = useState(false);
    const isAuthor = currentUserIri === comment.createdBy;
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(comment.body);
    const [replying, setReplying] = useState(false);
    const [replyDraft, setReplyDraft] = useState("");
    const authorNode = snapshot.persons.find((p) => p.id === comment.createdBy);
    const authorName = authorNode?.properties?.find((pr) => /foaf.*name$/i.test(pr.predicate))
        ?.value ||
        authorNode?.label ||
        comment.createdBy.split(/[#/]/).pop() ||
        "Utilisateur";
    return (_jsxs("div", { style: { marginLeft: level * 16 }, className: "pb-3 mb-3 text-sm max-w-prose border-l-2 pl-3 border-b border-slate-200 dark:border-slate-700", children: [_jsxs("div", { className: "flex-1 space-y-0.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-semibold", children: formatLabel(authorName) }), _jsx("span", { className: "text-xs text-gray-500", children: dayjs(comment.createdAt).fromNow() })] }), editing ? (_jsxs("div", { children: [_jsx("textarea", { value: draft, onChange: (e) => setDraft(e.target.value), rows: 3, className: "w-full text-xs border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-600 resize-none" }), _jsxs("div", { className: "flex gap-2 justify-end mt-1", children: [_jsx("button", { onClick: () => {
                                            setEditing(false);
                                            if (draft.trim() && draft.trim() !== comment.body) {
                                                onEdit(comment, draft.trim());
                                            }
                                        }, title: "Envoyer", className: "px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded", children: "\uD83D\uDCE4" }), _jsx("button", { onClick: () => {
                                            setEditing(false);
                                            setDraft(comment.body);
                                        }, title: "Annuler", className: "px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded", children: "\u274C" })] })] })) : (_jsx("p", { className: "whitespace-pre-wrap", children: comment.body })), _jsxs("div", { className: "flex items-center gap-3 text-xs text-sky-600", children: [_jsx("button", { onClick: () => setReplying((v) => !v), title: "R\u00E9pondre", children: "Repondre" }), isAuthor && !editing && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setEditing(true), title: "Modifier", children: "\uD83D\uDCDD" }), _jsx("button", { onClick: () => onDelete(comment), title: "Supprimer", className: "text-red-500", children: "\uD83D\uDDD1\uFE0F" })] }))] }), replying && (_jsxs("div", { className: "mt-2", children: [_jsx("textarea", { value: replyDraft, onChange: (e) => setReplyDraft(e.target.value), rows: 3, className: "w-full text-xs border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-600 resize-none", placeholder: "Votre r\u00E9ponse\u2026" }), _jsxs("div", { className: "flex gap-2 justify-end mt-1", children: [_jsx("button", { disabled: !replyDraft.trim(), onClick: () => {
                                            if (replyDraft.trim()) {
                                                onAddReply(comment, replyDraft.trim());
                                                setReplyDraft("");
                                                setReplying(false);
                                            }
                                        }, title: "Envoyer", className: "px-3 py-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white text-xs rounded", children: "\uD83D\uDCE4" }), _jsx("button", { onClick: () => {
                                            setReplying(false);
                                            setReplyDraft("");
                                        }, title: "Annuler", className: "px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded", children: "\u274C" })] })] }))] }), replies.length > 0 && (_jsx("div", { className: "mt-1", children: !showReplies ? (_jsxs("button", { onClick: () => setShowReplies(true), className: "flex items-center gap-1 text-xs text-blue-600 hover:underline", title: "Afficher les r\u00E9ponses", children: ["\u21B3", _jsxs("span", { children: [replies.length, "\u202Fr\u00E9ponse", replies.length > 1 && "s", " \u00E0 ce message"] })] })) : (_jsxs("button", { onClick: () => setShowReplies(false), className: "flex items-center gap-1 text-xs text-blue-600 hover:underline", title: "Fermer les r\u00E9ponses", children: ["\u21A9\uFE0E", _jsx("span", { children: "Refermer les r\u00E9ponses" })] })) })), showReplies &&
                replies.map((rep) => (_jsx(CommentBlock, { comment: rep, allComments: allComments, snapshot: snapshot, onAddReply: onAddReply, onEdit: onEdit, onDelete: onDelete, currentUserIri: currentUserIri, level: level + 1 }, rep.id)))] }));
};
export default CommentBlock;
