import { fetchEventSource } from "@microsoft/fetch-event-source";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { v4 as uuidv4 } from "uuid";
import remarkGfm from "remark-gfm";
import { useApi } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatLabel } from "../utils/formatLabel";
import { PaperAirplaneIcon, Cog6ToothIcon } from "@heroicons/react/24/solid";

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
    const [ontos, setOntos] = useState<Ontology[]>([]);
    const [activeIri, setActiveIri] = useState<string>("");
    const [loadingOntos, setLoadingOntos] = useState(true);
    const [messages, setMessages] = useState<ChatMsg[]>([
        {
            role: "assistant",
            content: "Bonjour, je suis l’assistant OntoZIPE. Posez-moi une question sur votre ontologie.",
        },
    ]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const base = useMemo(() => (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, ""), []);
    useEffect(() => { setLoadingOntos(true); api(`/ontology/projects`).then((r) => r.json()).then(setOntos).finally(() => setLoadingOntos(false)); }, [api]);
    useEffect(() => { if (!activeIri && ontos.length > 0) { setActiveIri(ontos[0].iri); } }, [ontos, activeIri]);

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
            body: JSON.stringify({ question: q, ontologyIri: activeIri || undefined, history, idempotencyKey }),

            async onopen(response) {
                if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
                    throw new Error(`Failed to open SSE connection: ${response.status} ${response.statusText}`);
                }
            },

            onmessage(event) {
                if (!event.data) return;

                try {
                    const parsedEvent = JSON.parse(event.data);
                    const { type, data } = parsedEvent;

                    switch (type) {
                        case 'tool_call':
                            setMessages(prev => {
                                const lastMsg = prev[prev.length - 1];
                                const updatedSteps = [...(lastMsg.agentSteps || []), { id: data.id, type: 'tool_call', name: data.name, args: data.args }];
                                const newLastMsg = { ...lastMsg, agentSteps: updatedSteps };
                                return [...prev.slice(0, -1), newLastMsg];
                            });
                            break;

                        case 'tool_result':
                            setMessages(prev => {
                                const lastMsg = prev[prev.length - 1];
                                const currentSteps = lastMsg.agentSteps || [];
                                const idx = currentSteps.findIndex(s => s.id === data.id);
                                let updatedSteps;
                                if (idx >= 0) {
                                    updatedSteps = currentSteps.slice();
                                    updatedSteps[idx] = { ...updatedSteps[idx], result: data.observation };
                                } else {
                                    // Si le tool_result arrive avant le tool_call (rare mais possible), on crée une entrée.
                                    updatedSteps = [...currentSteps, { id: data.id, type: 'tool_call', name: data.name, args: {}, result: data.observation }];
                                }
                                const newLastMsg = { ...lastMsg, agentSteps: updatedSteps };
                                return [...prev.slice(0, -1), newLastMsg];
                            });
                            break;

                        case 'chunk':
                            setMessages((prev) => {
                                const lastMsg = prev[prev.length - 1];
                                const newLastMsg = { ...lastMsg, content: lastMsg.content + data };
                                return [...prev.slice(0, -1), newLastMsg];
                            });
                            break;

                        case 'done':
                            setSending(false);
                            break;

                        case 'error':
                            console.error("Received error from server:", data);
                            setMessages((prev) => {
                                const lastMsg = prev[prev.length - 1];
                                const errorMsg = { ...lastMsg, content: `Erreur du serveur: ${data}` };
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
                    const lastMsg = prev[prev.length - 1];
                    const errorMsg = { ...lastMsg, content: "Une erreur de connexion est survenue." };
                    return [...prev.slice(0, -1), errorMsg];
                });
                setSending(false);
                throw err;
            },
        });
    };

    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (containerRef.current) { containerRef.current.scrollTop = containerRef.current.scrollHeight; } }, [messages]);

    return (
        <div className="container mx-auto max-w-5xl w-full flex flex-col gap-4">
            <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mt-4">
                <h1 className="text-2xl font-semibold">Assistant OntoZIPE</h1>
                <div className="flex items-center gap-2">
                    <label className="text-sm">Ontologie:</label>
                    <select
                        disabled={loadingOntos}
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
                                        Raisonnement de l'agent...
                                    </summary>
                                    <div className="mt-2 space-y-2">
                                        {m.agentSteps.map((step, stepIdx) => (
                                            <div key={stepIdx} className="text-xs p-2 rounded bg-white dark:bg-slate-700">
                                                <p className="font-bold text-indigo-500 flex items-center gap-1">
                                                    <Cog6ToothIcon className="h-4 w-4" /> Appel de l'outil: {step.name}
                                                </p>
                                                <pre className="whitespace-pre-wrap break-words bg-gray-50 dark:bg-slate-800 p-1 rounded mt-1 text-gray-700 dark:text-gray-300">
                                                    <code>{formatObservation(step.args)}</code>
                                                </pre>
                                                {step.result ? (
                                                    <div className="mt-1 border-t border-gray-200 dark:border-slate-600 pt-1">
                                                        <p className="font-semibold">Résultat :</p>
                                                        <pre className="whitespace-pre-wrap break-words text-gray-600 dark:text-gray-400">
                                                            <code>{formatObservation(step.result)}</code>
                                                        </pre>
                                                    </div>
                                                ) : (
                                                    <div className="mt-1 text-gray-500 animate-pulse">Observation en cours...</div>
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
                        placeholder="Posez votre question (Maj+Entrée pour nouvelle ligne)…"
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
                    aria-label="Envoyer"
                >
                    {sending ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" /> : <PaperAirplaneIcon className="h-5 w-5" />}
                </button>
            </form>
            <p className="text-xs text-gray-500">
                L'assistant peut utiliser des outils pour interroger l'ontologie sélectionnée.
            </p>
        </div>
    );
}