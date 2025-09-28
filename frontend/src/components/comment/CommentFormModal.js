import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useApi } from "../../lib/api";
import dayjs from "dayjs";
export default function CommentFormModal({ parentInd, onClose, onSaved, }) {
    const api = useApi();
    const [text, setText] = useState("");
    const params = new URLSearchParams(window.location.search);
    const ontologyIri = params.get("iri") || "";
    const save = () => api("/individuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id: `http://example.org/va#comment-${Date.now()}`,
            label: `Comment ${dayjs().format("YYYY-MM-DD HH:mm")}`,
            classId: "http://example.org/va#Commentaire",
            properties: [
                {
                    predicate: "http://example.org/va#texteCommentaire",
                    value: text,
                    isLiteral: true,
                },
                {
                    predicate: "http://example.org/va#objetCommente",
                    value: parentInd.id,
                    isLiteral: false,
                },
            ],
            ontologyIri,
        }),
    })
        .then(onSaved)
        .finally(onClose);
    return (_jsx("div", { className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50", children: _jsxs("div", { className: "card w-[26rem] space-y-4", children: [_jsx("h3", { className: "font-semibold", children: "Nouveau commentaire" }), _jsx("textarea", { className: "input h-28 resize-none", value: text, onChange: (e) => setText(e.target.value) }), _jsxs("div", { className: "flex justify-end gap-4", children: [_jsx("button", { className: "btn-secondary", onClick: onClose, children: "Annuler" }), _jsx("button", { className: "btn-primary", onClick: save, disabled: !text.trim(), children: "Publier" })] })] }) }));
}
