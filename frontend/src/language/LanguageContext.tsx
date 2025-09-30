import dayjs from "dayjs";
import { createContext, useContext, useMemo, useState, useEffect, ReactNode } from "react";

import {
    DAYJS_LOCALES,
    FALLBACK_LANGUAGE,
    SUPPORTED_LANGUAGES,
    normalizeLanguage,
} from "./config";
import type { SupportedLanguage } from "./config";

export { SUPPORTED_LANGUAGES } from "./config";
export type { SupportedLanguage } from "./config";

const STORAGE_KEY = "preferredLanguage";

type LanguageContextValue = {
    language: SupportedLanguage;
    setLanguage: (lang: string) => void;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<SupportedLanguage>(() => {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (stored) return normalizeLanguage(stored);
        if (typeof navigator !== "undefined" && navigator.language) {
            return normalizeLanguage(navigator.language);
        }
        return FALLBACK_LANGUAGE;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, language);
        }
    }, [language]);

    const setLanguage = (lang: string) => {
        setLanguageState(normalizeLanguage(lang));
    };

    useEffect(() => {
        const targetLocale = DAYJS_LOCALES[language] ?? DAYJS_LOCALES[FALLBACK_LANGUAGE];
        dayjs.locale(targetLocale);
    }, [language]);

    const value = useMemo(() => ({ language, setLanguage }), [language]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
    const ctx = useContext(LanguageContext);
    if (!ctx) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return ctx;
}
