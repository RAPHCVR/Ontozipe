import { BaseMessage } from "@langchain/core/messages";

/**
 * Extrait le contenu textuel d'un message, y compris quand le contenu
 * est un tableau de "parts" (forme multi-part de LangChain).
 */
export function getText(msg: BaseMessage): string {
    const c: any = (msg as any).content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) {
        return c
            .filter((p) => p && typeof p === "object" && p.type === "text" && typeof p.text === "string")
            .map((p) => p.text)
            .join("");
    }
    return "";
}