import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { v4 as uuidv4 } from "uuid";
import remarkGfm from "remark-gfm";
import { useApi } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatLabel } from "../utils/formatLabel";
import { PaperAirplaneIcon, Cog6ToothIcon } from "@heroicons/react/24/solid";
import { useOntologies } from "../hooks/apiQueries";
/**
 * Tente de parser une chaîne de caractères comme du JSON et de la formater joliment.
 * Si ce n'est pas du JSON, retourne la chaîne originale.
 */
const formatObservation = (obs) => {
    if (obs == null)
        return "";
    if (typeof obs === "string") {
        try {
            return JSON.stringify(JSON.parse(obs), null, 2);
        }
        catch {
            return obs;
        }
    }
    try {
        return JSON.stringify(obs, null, 2);
    }
    catch {
        return String(obs);
    }
};
export default function AssistantPage() {
    const api = useApi();
    const { token } = useAuth();
    const ontologiesQuery = useOntologies();
    const ontos = (ontologiesQuery.data ?? []);
    const [activeIri, setActiveIri] = useState("");
    const [systemPrompt, setSystemPrompt] = useState("");
    const [systemPromptLoading, setSystemPromptLoading] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: "Bonjour, je suis l’assistant OntoZIPE. Posez-moi une question sur votre ontologie.",
        },
    ]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const base = useMemo(() => (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, ""), []);
    // Identifiant de session de conversation côté client (par onglet/page)
    const sessionId = useMemo(() => uuidv4(), []);
    useEffect(() => { if (!activeIri && ontos.length > 0) {
        setActiveIri(ontos[0].iri);
    } }, [ontos, activeIri]);
    // Charge la prompt système initiale (lecture seule) pour l'utilisateur/ontologie active
    useEffect(() => {
        let cancelled = false;
        setSystemPromptLoading(true);
        const qs = new URLSearchParams();
        if (activeIri)
            qs.set('ontologyIri', activeIri);
        if (sessionId)
            qs.set('sessionId', sessionId);
        api(`/llm/system-prompt${qs.toString() ? `?${qs.toString()}` : ''}`)
            .then((r) => r.json())
            .then((json) => { if (!cancelled)
            setSystemPrompt(json.systemPrompt || ""); })
            .catch(() => { if (!cancelled)
            setSystemPrompt(""); })
            .finally(() => { if (!cancelled)
            setSystemPromptLoading(false); });
        return () => { cancelled = true; };
    }, [api, activeIri, sessionId]);
    const handleSend = async (e) => {
        if (e)
            e.preventDefault();
        const q = input.trim();
        if (!q || sending)
            return;
        const history = messages.slice(1);
        const questionMsg = { role: "user", content: q };
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
                if (!event.data)
                    return;
                try {
                    const parsedEvent = JSON.parse(event.data);
                    const { type, data } = parsedEvent;
                    switch (type) {
                        case 'system_prompt':
                            if (typeof data === 'string')
                                setSystemPrompt(data);
                            break;
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
                                }
                                else {
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
                }
                catch (e) {
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
    const containerRef = useRef(null);
    useEffect(() => { if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
    } }, [messages]);
    if (ontologiesQuery.isError) {
        return (_jsx("div", { className: "flex items-center justify-center h-screen text-red-500", children: "Erreur lors du chargement des ontologies disponibles." }));
    }
    return (_jsxs("div", { className: "container mx-auto max-w-5xl w-full flex flex-col gap-4", children: [_jsxs("header", { className: "flex flex-col md:flex-row md:items-end md:justify-between gap-2 mt-4", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Assistant OntoZIPE" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-sm", children: "Ontologie:" }), _jsx("select", { disabled: ontologiesQuery.isLoading, className: "input min-w-[20rem]", value: activeIri, onChange: (e) => setActiveIri(e.target.value), children: ontos.map((o) => (_jsx("option", { value: o.iri, children: o.label || formatLabel(o.iri.split(/[#/]/).pop() || o.iri) }, o.iri))) })] })] }), _jsxs("div", { className: "card p-3 mb-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h2", { className: "text-sm font-semibold", children: "Prompt syst\u00E8me" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-gray-500", children: "lecture seule" }), _jsx("button", { type: "button", className: "btn-secondary text-xs px-2 py-1", onClick: () => navigator.clipboard?.writeText(systemPrompt), disabled: !systemPrompt, "aria-label": "Copier la prompt syst\u00E8me", children: "Copier" })] })] }), _jsx("pre", { className: "whitespace-pre-wrap break-words text-xs bg-gray-50 dark:bg-slate-800 p-2 rounded max-h-48 overflow-auto", children: systemPromptLoading ? 'Chargement…' : (systemPrompt || 'Aucune prompt pour le moment.') })] }), _jsx("div", { ref: containerRef, className: "card flex-1 min-h-[60vh] max-h-[65vh] overflow-y-auto p-4 space-y-3", children: messages.map((m, idx) => (_jsxs("div", { className: `flex ${m.role === "user" ? "justify-end" : "flex-col items-start"}`, children: [m.role === 'assistant' && m.agentSteps && m.agentSteps.length > 0 && (_jsx("div", { className: "mb-2 w-full max-w-[80%]", children: _jsxs("details", { className: "rounded-lg bg-gray-100 dark:bg-slate-800 p-2", children: [_jsx("summary", { className: "cursor-pointer text-xs font-semibold text-gray-600 dark:text-gray-400", children: "Raisonnement de l'agent..." }), _jsx("div", { className: "mt-2 space-y-2", children: m.agentSteps.map((step, stepIdx) => (_jsxs("div", { className: "text-xs p-2 rounded bg-white dark:bg-slate-700", children: [_jsxs("p", { className: "font-bold text-indigo-500 flex items-center gap-1", children: [_jsx(Cog6ToothIcon, { className: "h-4 w-4" }), " Appel de l'outil: ", step.name] }), _jsx("pre", { className: "whitespace-pre-wrap break-words bg-gray-50 dark:bg-slate-800 p-1 rounded mt-1 text-gray-700 dark:text-gray-300", children: _jsx("code", { children: formatObservation(step.args) }) }), step.result ? (_jsxs("div", { className: "mt-1 border-t border-gray-200 dark:border-slate-600 pt-1", children: [_jsx("p", { className: "font-semibold", children: "R\u00E9sultat :" }), _jsx("pre", { className: "whitespace-pre-wrap break-words text-gray-600 dark:text-gray-400", children: _jsx("code", { children: formatObservation(step.result) }) })] })) : (_jsx("div", { className: "mt-1 text-gray-500 animate-pulse", children: "Observation en cours..." }))] }, stepIdx))) })] }) })), _jsx("div", { className: "prose dark:prose-invert rounded-lg px-3 py-2 max-w-[80%] " +
                                (m.role === "user"
                                    ? "bg-indigo-600 text-white prose-p:text-white prose-strong:text-white self-end"
                                    : "bg-gray-100 dark:bg-slate-800"), children: _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], children: m.content || "..." }) })] }, idx))) }), _jsxs("form", { onSubmit: handleSend, className: "flex items-end gap-2", children: [_jsx("textarea", { value: input, onChange: (e) => setInput(e.target.value), placeholder: "Posez votre question (Maj+Entr\u00E9e pour nouvelle ligne)\u2026", rows: 2, className: "flex-1 text-sm border rounded-md px-3 py-2 dark:bg-slate-800 dark:border-slate-600 resize-none", onKeyDown: (e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        } }), _jsx("button", { type: "submit", disabled: sending || !input.trim(), className: "btn-primary disabled:opacity-50 h-[42px] w-[42px] flex-shrink-0 !p-0 flex items-center justify-center rounded-md", "aria-label": "Envoyer", children: sending ? _jsx("div", { className: "animate-spin rounded-full h-4 w-4 border-t-2 border-white" }) : _jsx(PaperAirplaneIcon, { className: "h-5 w-5" }) })] }), _jsx("p", { className: "text-xs text-gray-500", children: "L'assistant peut utiliser des outils pour interroger l'ontologie s\u00E9lectionn\u00E9e." })] }));
}
