export const SUPPORTED_LANGUAGES = ["fr", "en", "es"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const FALLBACK_LANGUAGE: SupportedLanguage = "fr";

export const DAYJS_LOCALES: Record<SupportedLanguage, string> = {
    fr: "fr",
    en: "en",
    es: "es",
};

const LANGUAGE_TAG_REGEX = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

const toCandidateList = (value?: string | null): string[] => {
    if (!value) return [];
    const trimmed = value.trim();
    if (!trimmed) return [];
    const lower = trimmed.toLowerCase();
    if (!LANGUAGE_TAG_REGEX.test(lower)) return [];
    const primary = lower.split("-")[0];
    return primary === lower ? [lower] : [lower, primary];
};

export const matchSupportedLanguage = (
    candidate?: string | null
): SupportedLanguage | null => {
    for (const value of toCandidateList(candidate)) {
        if (SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)) {
            return value as SupportedLanguage;
        }
    }
    return null;
};

export const normalizeLanguage = (candidate?: string | null): SupportedLanguage => {
    return matchSupportedLanguage(candidate) ?? FALLBACK_LANGUAGE;
};

