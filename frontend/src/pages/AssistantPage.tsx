import { fetchEventSource } from "@microsoft/fetch-event-source";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApi } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatLabel } from "../utils/formatLabel";

type ChatMsg = { role: "user" | "assistant"; content: string };
type Ontology = { iri: string; label?: string };

export default function AssistantPage() {
    // ... hooks useState, useMemo, etc. ...
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

    useEffect(() => { setLoadingOntos(true); api(`${base}/ontology/projects`).then((r) => r.json()).then(setOntos).finally(() => setLoadingOntos(false)); }, [api, base]);
    useEffect(() => { if (!activeIri && ontos.length > 0) { setActiveIri(ontos[0].iri); } }, [ontos, activeIri]);

    const send = async () => {
        const q = input.trim();
        if (!q || sending) return;

        const history = messages.slice(1);
        const questionMsg: ChatMsg = { role: "user", content: q };

        setMessages((prev) => [...prev, questionMsg, { role: "assistant", content: "" }]);
        setInput("");
        setSending(true);

        await fetchEventSource(`${base}/llm/ask`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ question: q, ontologyIri: activeIri || undefined, history }),

            onmessage(event) {
                const chunkContent = JSON.parse(event.data);

                setMessages((prev) => {
                    const lastMsg = prev[prev.length - 1];
                    const newLastMsg = { ...lastMsg, content: lastMsg.content + chunkContent };
                    return [...prev.slice(0, -1), newLastMsg];
                });
            },

            onclose() {
                setSending(false);
            },

            onerror(err) {
                setMessages((prev) => {
                    const lastMsg = prev[prev.length - 1];
                    const errorMsg = { ...lastMsg, content: "Une erreur de communication est survenue." };
                    return [...prev.slice(0, -1), errorMsg];
                });
                setSending(false);
                throw err; // Arrête les tentatives de reconnexion
            },
        });
    };

    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (containerRef.current) { containerRef.current.scrollTop = containerRef.current.scrollHeight; } }, [messages]);

    // ... Le JSX reste identique ...
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
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={
                                "prose dark:prose-invert rounded-lg px-3 py-2 max-w-[80%] " +
                                (m.role === "user"
                                    ? "bg-indigo-600 text-white prose-p:text-white prose-strong:text-white"
                                    : "bg-gray-100 dark:bg-slate-800")
                            }
                        >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-start gap-2">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Posez votre question (Shift+Entrée pour nouvelle ligne)…"
                    rows={2}
                    className="flex-1 text-sm border rounded px-3 py-2 dark:bg-slate-800 dark:border-slate-600 resize-none"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                        }
                    }}
                />
                <button
                    onClick={send}
                    disabled={sending || !input.trim()}
                    className="btn-primary disabled:opacity-50 h-[38px]"
                    title="Envoyer"
                >
                    {sending ? "..." : "Envoyer"}
                </button>
            </div>
            <p className="text-xs text-gray-500">
                Astuce: l’assistant sait utiliser des outils pour chercher des individus
                dans l’ontologie sélectionnée et lire leurs propriétés avant de répondre.
            </p>
        </div>
    );
}