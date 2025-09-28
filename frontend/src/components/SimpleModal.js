import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function SimpleModal({ title, onClose, onSubmit, children, disableSubmit, }) {
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40", children: _jsxs("div", { className: "card w-[28rem] max-w-full space-y-4", children: [_jsx("h3", { className: "text-lg font-semibold", children: title }), children, _jsxs("div", { className: "flex justify-end gap-4 pt-2", children: [_jsx("button", { className: "btn-secondary", onClick: onClose, children: "Annuler" }), _jsx("button", { className: "btn-primary", onClick: onSubmit, disabled: disableSubmit, children: "Valider" })] })] }) }));
}
