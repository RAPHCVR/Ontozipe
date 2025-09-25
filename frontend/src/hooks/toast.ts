import { useCallback } from "react";

import { useToastContext } from "../components/ui/ToastProvider";

export const useToast = () => {
    const { showToast, dismissToast } = useToastContext();

    return {
        showToast,
        dismissToast,
        success: useCallback((message: string) => showToast(message, "success"), [showToast]),
        error: useCallback((message: string) => showToast(message, "error"), [showToast]),
        info: useCallback((message: string) => showToast(message, "info"), [showToast]),
    };
};
