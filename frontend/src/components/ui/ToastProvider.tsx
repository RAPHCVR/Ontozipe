import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type ToastVariant = "success" | "error" | "info";

type ToastDefinition = {
    id: string;
    message: string;
    type: ToastVariant;
};

type ToastContextValue = {
    showToast: (message: string, type?: ToastVariant) => string;
    dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const createId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const AUTO_DISMISS_MS = 4_000;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<ToastDefinition[]>([]);

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback(
        (message: string, type: ToastVariant = "info") => {
            const id = createId();
            setToasts((prev) => [...prev, { id, message, type }]);
            setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
            return id;
        },
        [dismissToast]
    );

    const value = useMemo<ToastContextValue>(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`min-w-[220px] rounded-md px-4 py-3 shadow-lg text-sm text-white transition-opacity duration-200 bg-opacity-90 ${
                            toast.type === "success"
                                ? "bg-emerald-500"
                                : toast.type === "error"
                                    ? "bg-rose-500"
                                    : "bg-slate-600"
                        }`}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToastContext = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error("useToastContext must be used within a ToastProvider");
    }
    return ctx;
};
