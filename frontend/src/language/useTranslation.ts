import { useMemo } from "react";

import { FALLBACK_LANGUAGE } from "./config";
import type { SupportedLanguage } from "./config";
import { useLanguage } from "./LanguageContext";
import { TranslationKey, messages } from "./messages";

type InterpolationValues = Record<string, string | number>;

const interpolate = (template: string, values?: InterpolationValues): string => {
    if (!values) return template;
    return template.replace(/{{\s*([\w.-]+)\s*}}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
            const value = values[key];
            return value == null ? "" : String(value);
        }
        return match;
    });
};

const resolveDictionary = (lang: SupportedLanguage) => {
    return messages[lang] ?? messages[FALLBACK_LANGUAGE];
};

export const useTranslation = () => {
    const { language } = useLanguage();

    const translate = useMemo(
        () =>
            (key: TranslationKey, values?: InterpolationValues) => {
                const dict = resolveDictionary(language);
                const fallbackDict = resolveDictionary(FALLBACK_LANGUAGE);
                const template = dict[key] ?? fallbackDict[key] ?? key;
                return interpolate(template, values);
            },
        [language]
    );

    return { t: translate, language } as const;
};

export type Translate = ReturnType<typeof useTranslation>["t"];
