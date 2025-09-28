import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ---------------------------------------------------------------------------
// Modal (updated to use IndividualCard)
import { useEffect, useCallback } from "react";
import IndividualCard from "./IndividualCard";
const Modal = ({ individual, snapshot, onShow, onClose, zIndex }) => {
    const onKeyDown = useCallback((e) => {
        if (e.key === "Escape")
            onClose();
    }, [onClose]);
    useEffect(() => {
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [onKeyDown]);
    return (_jsx("div", { className: "fixed inset-0 bg-black/40", style: { zIndex }, 
        // Fermer si on MOUSE DOWN sur l’overlay (et empêcher “click-through”)
        onMouseDown: (e) => {
            if (e.target === e.currentTarget) {
                e.stopPropagation();
                e.preventDefault();
                onClose();
            }
        }, children: _jsx("div", { className: "absolute inset-0 overflow-y-auto p-4", 
            // Empêche la propagation des events souris à l’overlay
            onMouseDown: (e) => e.stopPropagation(), children: _jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-lg w-[min(90vw,80rem)] mx-auto p-6 space-y-4 shadow-lg max-h-[90vh] overflow-y-auto", children: [_jsx(IndividualCard, { ind: individual, snapshot: snapshot, onShow: onShow, onEdit: () => { }, onDelete: () => { }, idx: 0, defaultOpen: true }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { className: "btn-primary", 
                            // Fermer sur mouse down (et empêcher propagation + défaut)
                            onMouseDown: (e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onClose();
                            }, children: "Quitter" }) })] }) }) }));
};
export default Modal;
