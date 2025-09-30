import { createContext, useContext, useMemo, useState, useEffect, ReactNode } from "react";

const STORAGE_KEY = "preferredLanguage";
const FALLBACK_LANGUAGE = "fr";
export const SUPPORTED_LANGUAGES = ["fr", "en"] as const;

type LanguageContextValue = {
    language: string;
    setLanguage: (lang: string) => void;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const normalizeLang = (lang?: string | null): string => {
    const value = lang?.trim();
    if (!value) return FALLBACK_LANGUAGE;
    return value.toLowerCase();
};

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState(() => {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (stored) return normalizeLang(stored);
        if (typeof navigator !== "undefined" && navigator.language) {
            return normalizeLang(navigator.language.split("-")[0]);
        }
        return FALLBACK_LANGUAGE;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, language);
        }
    }, [language]);

    const setLanguage = (lang: string) => {
        setLanguageState(normalizeLang(lang));
    };

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
