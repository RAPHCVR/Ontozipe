// ---------------------------------------------------------------------------
// Modal (updated to use IndividualCard)
import { useEffect, useCallback } from "react";
import { IndividualNode, Snapshot } from "types";
import IndividualCard from "./IndividualCard";
import { useTranslation } from "../../language/useTranslation";

const Modal: React.FC<{
    individual: IndividualNode;
    snapshot: Snapshot;
    onShow: (ind: IndividualNode) => void;
    onClose: () => void;
    zIndex: number;
}> = ({ individual, snapshot, onShow, onClose, zIndex }) => {
    const { t } = useTranslation();
    const onKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
    }, [onClose]);

    useEffect(() => {
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [onKeyDown]);

    return (
        <div
            className="fixed inset-0 bg-black/40"
            style={{ zIndex }}
            // Fermer si on MOUSE DOWN sur l’overlay (et empêcher “click-through”)
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                    e.stopPropagation();
                    e.preventDefault();
                    onClose();
                }
            }}
        >
            {/* zone scrollable interne */}
            <div
                className="absolute inset-0 overflow-y-auto p-4"
                // Empêche la propagation des events souris à l’overlay
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="bg-white dark:bg-slate-800 rounded-lg w-[min(90vw,80rem)] mx-auto p-6 space-y-4 shadow-lg max-h-[90vh] overflow-y-auto">
                    <IndividualCard
                        ind={individual}
                        snapshot={snapshot}
                        onShow={onShow}
                        onEdit={() => {}}
                        onDelete={() => {}}
                        idx={0}
                        defaultOpen={true}
                    />
                    <div className="flex justify-end">
                        <button
                            className="btn-primary"
                            // Fermer sur mouse down (et empêcher propagation + défaut)
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onClose();
                            }}
                        >
                            {t("common.close")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Modal;
