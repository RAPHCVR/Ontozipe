import { fetchEventSource } from "@microsoft/fetch-event-source";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { v4 as uuidv4 } from "uuid";
import remarkGfm from "remark-gfm";
import { useApi } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatLabel } from "../utils/formatLabel";
import { PaperAirplaneIcon, Cog6ToothIcon } from "@heroicons/react/24/solid";
import { useOntologies } from "../hooks/apiQueries";
import { SUPPORTED_LANGUAGES } from "../language/LanguageContext";
import type { SupportedLanguage } from "../language/LanguageContext";
import { messages as localeMessages } from "../language/messages";
import { useTranslation } from "../language/useTranslation";

type ChatMsg = { role: "user" | "assistant"; content: string, agentSteps?: AgentStep[] };
type Ontology = { iri: string; label?: string };
type AgentStep = { id: string; type: 'tool_call'; name: string; args: any; result?: string; };

/**
 * Tente de parser une chaîne de caractères comme du JSON et de la formater joliment.
 * Si ce n'est pas du JSON, retourne la chaîne originale.
 */
const formatObservation = (obs: unknown): string => {
    if (obs == null) return "";
    if (typeof obs === "string") {
        try { return JSON.stringify(JSON.parse(obs), null, 2); }
        catch { return obs; }
    }
    try { return JSON.stringify(obs, null, 2); }
    catch { return String(obs); }
};


export default function AssistantPage() {
    const api = useApi();
    const { token } = useAuth();
    const ontologiesQuery = useOntologies();
    const ontos = (ontologiesQuery.data ?? []) as Ontology[];
    const [activeIri, setActiveIri] = useState<string>("");
    const [systemPrompt, setSystemPrompt] = useState<string>("");
    const [systemPromptLoading, setSystemPromptLoading] = useState<boolean>(false);
    const { t, language } = useTranslation();
    const [messages, setMessages] = useState<ChatMsg[]>([
        {
            role: "assistant",
            content: t("assistant.initialMessage"),
        },
    ]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const base = useMemo(() => (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, ""), []);
    // Identifiant de session de conversation côté client (par onglet/page)
    const sessionId = useMemo(() => uuidv4(), []);
    useEffect(() => { if (!activeIri && ontos.length > 0) { setActiveIri(ontos[0].iri); } }, [ontos, activeIri]);

    // Charge la prompt système initiale (lecture seule) pour l'utilisateur/ontologie active
    useEffect(() => {
        let cancelled = false;
        setSystemPromptLoading(true);
        const qs = new URLSearchParams();
        if (activeIri) qs.set('ontologyIri', activeIri);
        if (sessionId) qs.set('sessionId', sessionId);
        api(`/llm/system-prompt${qs.toString() ? `?${qs.toString()}` : ''}`)
            .then((r) => r.json())
            .then((json) => { if (!cancelled) setSystemPrompt(json.systemPrompt || ""); })
            .catch(() => { if (!cancelled) setSystemPrompt(""); })
            .finally(() => { if (!cancelled) setSystemPromptLoading(false); });
        return () => { cancelled = true; };
    }, [api, activeIri, sessionId]);

    useEffect(() => {
        setMessages((prev) => {
            if (prev.length === 0) return prev;
            const [first, ...rest] = prev;
            if (first.role !== "assistant") return prev;
            const knownInitials = SUPPORTED_LANGUAGES.map(
                (lang: SupportedLanguage) => localeMessages[lang]["assistant.initialMessage"]
            );
            if (!knownInitials.includes(first.content)) return prev;
            const updated = [{ ...first, content: t("assistant.initialMessage") }, ...rest];
            return updated;
        });
    }, [language, t]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const q = input.trim();
        if (!q || sending) return;

        const history = messages.slice(1);
        const questionMsg: ChatMsg = { role: "user", content: q };

        setMessages((prev) => [...prev, questionMsg, { role: "assistant", content: "", agentSteps: [] }]);
        setInput("");
        setSending(true);
        const idempotencyKey = uuidv4();

        await fetchEventSource(`${base}/llm/ask`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ question: q, ontologyIri: activeIri || undefined, history, idempotencyKey, sessionId }),

            async onopen(response) {
                if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
                    throw new Error(`Failed to open SSE connection: ${response.status} ${response.statusText}`);
                }
            },

            onmessage(event) {
                if (!event.data) return;

                try {
                    const parsedEvent = JSON.parse(event.data);
                    const { type, data } = parsedEvent as { type: string; data: any };

                    switch (type) {
                        case 'system_prompt':
                            if (typeof data === 'string') setSystemPrompt(data);
                            break;
                        case 'tool_call':
                            setMessages((prev) => {
                                if (prev.length === 0) return prev;
                                const lastMsg = prev[prev.length - 1];
                                if (lastMsg.role !== "assistant") return prev;

                                const step: AgentStep = {
                                    id: String(data?.id ?? uuidv4()),
                                    type: "tool_call",
                                    name: typeof data?.name === "string" ? data.name : "tool",
                                    args: data?.args ?? {},
                                };

                                const updatedSteps: AgentStep[] = [...(lastMsg.agentSteps ?? []), step];
                                const newLastMsg: ChatMsg = { ...lastMsg, agentSteps: updatedSteps };
                                return [...prev.slice(0, -1), newLastMsg];
                            });
                            break;

                        case 'tool_result':
                            setMessages((prev) => {
                                if (prev.length === 0) return prev;
                                const lastMsg = prev[prev.length - 1];
                                if (lastMsg.role !== "assistant") return prev;

                                const currentSteps = [...(lastMsg.agentSteps ?? [])];
                                const stepId = String(data?.id ?? uuidv4());
                                const observation = formatObservation(data?.observation);
                                const idx = currentSteps.findIndex((s) => s.id === stepId);

                                if (idx >= 0) {
                                    currentSteps[idx] = { ...currentSteps[idx], result: observation };
                                } else {
                                    currentSteps.push({
                                        id: stepId,
                                        type: "tool_call",
                                        name: typeof data?.name === "string" ? data.name : "tool",
                                        args: data?.args ?? {},
                                        result: observation,
                                    });
                                }

                                const newLastMsg: ChatMsg = { ...lastMsg, agentSteps: currentSteps };
                                return [...prev.slice(0, -1), newLastMsg];
                            });
                            break;

                        case 'chunk':
                            setMessages((prev) => {
                                if (prev.length === 0) return prev;
                                const lastMsg = prev[prev.length - 1];
                                if (lastMsg.role !== "assistant") return prev;
                                const chunk = typeof data === "string" ? data : String(data ?? "");
                                const newLastMsg: ChatMsg = {
                                    ...lastMsg,
                                    content: (lastMsg.content ?? "") + chunk,
                                };
                                return [...prev.slice(0, -1), newLastMsg];
                            });
                            break;

                        case 'done':
                            setSending(false);
                            break;

                        case 'error':
                            console.error("Received error from server:", data);
                            setMessages((prev) => {
                                if (prev.length === 0) return prev;
                                const lastMsg = prev[prev.length - 1];
                                if (lastMsg.role !== "assistant") return prev;
                                const message = typeof data === "string" ? data : String(data ?? "");
                                const errorMsg: ChatMsg = {
                                    ...lastMsg,
                                    content: `Erreur du serveur: ${message}`,
                                };
                                return [...prev.slice(0, -1), errorMsg];
                            });
                            break;
                    }
                } catch (e) {
                    console.error("Failed to parse SSE data chunk:", event.data, e);
                }
            },

            onclose() { setSending(false); },

            onerror(err) {
                console.error("SSE connection error:", err);
                setMessages((prev) => {
                    if (prev.length === 0) return prev;
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg.role !== "assistant") return prev;
                    const errorMsg: ChatMsg = {
                        ...lastMsg,
                        content: t("assistant.errors.connection"),
                    };
                    return [...prev.slice(0, -1), errorMsg];
                });
                setSending(false);
                throw err;
            },
        });
    };

    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (containerRef.current) { containerRef.current.scrollTop = containerRef.current.scrollHeight; } }, [messages]);

    if (ontologiesQuery.isError) {
        return (
            <div className="flex items-center justify-center h-screen text-red-500">
                {t("assistant.errors.loadOntologies")}
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-5xl w-full flex flex-col gap-4">
            <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mt-4">
                <h1 className="text-2xl font-semibold">{t("assistant.title")}</h1>
                <div className="flex items-center gap-2">
                    <label className="text-sm">{t("assistant.ontologyLabel")}</label>
                    <select
                        disabled={ontologiesQuery.isLoading}
                        className="input min-w-[20rem]"
                        value={activeIri}
                        onChange={(e) => setActiveIri(e.target.value)}
                    >
                        {ontos.map((o) => (
                            <option key={o.iri} value={o.iri}>
                                {o.label || formatLabel(o.iri.split(/[#/]/).pop() || o.iri)}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {/* Affichage lecture seule de la prompt système */}
            <div className="card p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold">{t("assistant.systemPrompt.title")}</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{t("assistant.systemPrompt.readOnly")}</span>
                        <button
                            type="button"
                            className="btn-secondary text-xs px-2 py-1"
                            onClick={() => navigator.clipboard?.writeText(systemPrompt)}
                            disabled={!systemPrompt}
                            aria-label={t("assistant.systemPrompt.copyAria")}
                        >
                            {t("common.copy")}
                        </button>
                    </div>
                </div>
                <pre className="whitespace-pre-wrap break-words text-xs bg-gray-50 dark:bg-slate-800 p-2 rounded max-h-48 overflow-auto">
                    {systemPromptLoading ? t("common.loading") : (systemPrompt || t("assistant.systemPrompt.empty"))}
                </pre>
            </div>

            <div
                ref={containerRef}
                className="card flex-1 min-h-[60vh] max-h-[65vh] overflow-y-auto p-4 space-y-3"
            >
                {messages.map((m, idx) => (
                    <div
                        key={idx}
                        className={`flex ${m.role === "user" ? "justify-end" : "flex-col items-start"}`}
                    >
                        {m.role === 'assistant' && m.agentSteps && m.agentSteps.length > 0 && (
                            <div className="mb-2 w-full max-w-[80%]">
                                <details className="rounded-lg bg-gray-100 dark:bg-slate-800 p-2">
                                    <summary className="cursor-pointer text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {t("assistant.agentReasoning.summary")}
                                    </summary>
                                    <div className="mt-2 space-y-2">
                                        {m.agentSteps.map((step, stepIdx) => (
                                            <div key={stepIdx} className="text-xs p-2 rounded bg-white dark:bg-slate-700">
                                               <p className="font-bold text-indigo-500 flex items-center gap-1">
                                                    <Cog6ToothIcon className="h-4 w-4" />
                                                    {t("assistant.agentReasoning.toolCall", { name: step.name })}
                                                </p>
                                                <pre className="whitespace-pre-wrap break-words bg-gray-50 dark:bg-slate-800 p-1 rounded mt-1 text-gray-700 dark:text-gray-300">
                                                    <code>{formatObservation(step.args)}</code>
                                                </pre>
                                                {step.result ? (
                                                    <div className="mt-1 border-t border-gray-200 dark:border-slate-600 pt-1">
                                                        <p className="font-semibold">{t("assistant.agentReasoning.result")}</p>
                                                        <pre className="whitespace-pre-wrap break-words text-gray-600 dark:text-gray-400">
                                                            <code>{formatObservation(step.result)}</code>
                                                        </pre>
                                                    </div>
                                                ) : (
                                                    <div className="mt-1 text-gray-500 animate-pulse">{t("assistant.agentReasoning.inProgress")}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </div>
                        )}

                        <div
                            className={
                                "prose dark:prose-invert rounded-lg px-3 py-2 max-w-[80%] " +
                                (m.role === "user"
                                    ? "bg-indigo-600 text-white prose-p:text-white prose-strong:text-white self-end"
                                    : "bg-gray-100 dark:bg-slate-800")
                            }
                        >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || "..."}</ReactMarkdown>
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={handleSend} className="flex items-end gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t("assistant.input.placeholder")}
                        rows={2}
                        className="flex-1 text-sm border rounded-md px-3 py-2 dark:bg-slate-800 dark:border-slate-600 resize-none"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    className="btn-primary disabled:opacity-50 h-[42px] w-[42px] flex-shrink-0 !p-0 flex items-center justify-center rounded-md"
                    aria-label={t("assistant.input.ariaSend")}
                >
                    {sending ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" /> : <PaperAirplaneIcon className="h-5 w-5" />}
                </button>
            </form>
            <p className="text-xs text-gray-500">
                {t("assistant.footer.hint")}
            </p>
        </div>
    );
}
