import { fetchEventSource } from "@microsoft/fetch-event-source";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useToast } from "../hooks/toast";

type ChatMsg = {
	role: "user" | "assistant";
	content: string;
	plan?: string | null;
	status?: string | null;
	isStreaming?: boolean;
	agentSteps?: AgentStep[];
};
type Ontology = { iri: string; label?: string };
type AgentStep = { id: string; type: "tool_call"; name: string; args: any; result?: string };
type ChatSession = { id: string; title: string; ontologyIri?: string; createdAt?: string; updatedAt?: string };

/**
 * Tente de parser une chaîne de caractères comme du JSON et de la formater joliment.
 * Si ce n'est pas du JSON, retourne la chaîne originale.
 */
const formatObservation = (obs: unknown): string => {
    if (obs == null) return "";
    if (typeof obs === "string") {
        try {
            return JSON.stringify(JSON.parse(obs), null, 2);
        } catch {
            return obs;
        }
    }
    try {
        return JSON.stringify(obs, null, 2);
    } catch {
        return String(obs);
    }
};

export default function AssistantPage() {
    const api = useApi();
    const { token } = useAuth();
    const ontologiesQuery = useOntologies();
    const ontos = (ontologiesQuery.data ?? []) as Ontology[];
    const { t, language } = useTranslation();
    const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

    const [activeIri, setActiveIri] = useState<string>("");
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState<boolean>(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMsg[]>([
        {
            role: "assistant",
            content: t("assistant.initialMessage"),
        },
    ]);
    const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
    const [systemPrompt, setSystemPrompt] = useState<string>("");
    const [systemPromptLoading, setSystemPromptLoading] = useState<boolean>(false);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);

    const base = useMemo(() => (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, ""), []);

    useEffect(() => {
        if (!activeIri && ontos.length > 0) {
            setActiveIri(ontos[0].iri);
        }
    }, [ontos, activeIri]);

    const loadSessions = useCallback(
        async (ontology?: string, options?: { silent?: boolean; signal?: AbortSignal }) => {
            const { silent, signal } = options ?? {};
            if (!silent) setSessionsLoading(true);
            try {
                const qs = new URLSearchParams();
                if (ontology) qs.set("ontologyIri", ontology);
                const response = await api(
                    `/llm/chat-sessions${qs.toString() ? `?${qs.toString()}` : ""}`,
                    { signal }
                );
                if (signal?.aborted) return [];
                const json = await response.json();
                const list: ChatSession[] = Array.isArray(json.sessions) ? json.sessions : [];
                if (!signal?.aborted) setSessions(list);
                return list;
            } catch (error) {
                if (options?.signal?.aborted) {
                    return [];
                }
                throw error;
            } finally {
                if (!silent) {
                    setSessionsLoading(false);
                }
            }
        },
        [api]
    );

    const loadMessages = useCallback(
        async (sessionId: string, options?: { silent?: boolean; signal?: AbortSignal }) => {
            if (!sessionId) return [];
            const { silent, signal } = options ?? {};
            const initialAssistant = localeMessages[language]["assistant.initialMessage"];
            if (!silent) {
                setMessagesLoading(true);
                setMessages([{ role: "assistant", content: initialAssistant }]);
            }
            try {
                const response = await api(`/llm/chat-sessions/${sessionId}/messages`, { signal });
                if (signal?.aborted) return [];
                const json = await response.json();
				const mapped: ChatMsg[] = (Array.isArray(json.messages) ? json.messages : []).map((msg: any) => ({
					role: msg.role === "assistant" ? "assistant" : "user",
					content: typeof msg.content === "string" ? msg.content : "",
					plan: typeof msg.plan === "string" ? msg.plan : null,
					status: null,
					isStreaming: false,
					agentSteps: Array.isArray(msg.agentSteps)
						? msg.agentSteps
								.filter((step: any) => step && typeof step === "object")
								.map((step: any) => ({
									id: typeof step.id === "string" ? step.id : uuidv4(),
									type: "tool_call" as const,
									name: typeof step.name === "string" ? step.name : "tool",
									args: step.args ?? {},
									result:
										typeof step.result === "string"
											? step.result
											: step.result != null
												? JSON.stringify(step.result)
												: undefined,
								}))
						: undefined,
				}));
                if (!signal?.aborted) {
                    setMessages([{ role: "assistant", content: initialAssistant }, ...mapped]);
                }
                return mapped;
            } catch (error) {
                if (signal?.aborted) {
                    return [];
                }
                throw error;
            } finally {
                if (!silent) {
                    setMessagesLoading(false);
                }
            }
        },
        [api, language]
    );

    const createSession = useCallback(
        async (ontology?: string, title?: string) => {
            const payload: Record<string, unknown> = {};
            if (ontology) payload.ontologyIri = ontology;
            if (title) payload.title = title;
            const response = await api("/llm/chat-sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await response.json();
            const session: ChatSession | undefined = json.session;
            if (session) {
                setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
                setActiveSessionId(session.id);
            }
            return session ?? null;
        },
        [api]
    );

    useEffect(() => {
        if (!activeIri) return;
        const controller = new AbortController();
        (async () => {
            try {
                const list = await loadSessions(activeIri, { signal: controller.signal });
                if (controller.signal.aborted) return;
                if (list.length === 0) {
                    await createSession(activeIri);
                    return;
                }
                if (!activeSessionId || !list.some((s) => s.id === activeSessionId)) {
                    setActiveSessionId(list[0].id);
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error("Failed to load chat sessions:", error);
                    toastError(t("assistant.sessions.errors.load"));
                }
            }
        })();
        return () => controller.abort();
    }, [activeIri, loadSessions, createSession, activeSessionId, toastError, t]);

    useEffect(() => {
        if (!activeSessionId) {
            setMessages([
                {
                    role: "assistant",
                    content: t("assistant.initialMessage"),
                },
            ]);
            return;
        }
        const controller = new AbortController();
        loadMessages(activeSessionId, { signal: controller.signal }).catch((error) => {
            if (!controller.signal.aborted) {
                console.error("Failed to load chat messages:", error);
                toastError(t("assistant.sessions.errors.loadMessages"));
                setMessages([
                    {
                        role: "assistant",
                        content: t("assistant.initialMessage"),
                    },
                ]);
            }
        });
        return () => controller.abort();
    }, [activeSessionId, loadMessages, toastError, t]);

    useEffect(() => {
        if (!activeSessionId) {
            setSystemPrompt("");
            return;
        }
        let cancelled = false;
        setSystemPromptLoading(true);
        const qs = new URLSearchParams();
        if (activeIri) qs.set("ontologyIri", activeIri);
        qs.set("sessionId", activeSessionId);
        api(`/llm/system-prompt${qs.toString() ? `?${qs.toString()}` : ""}`)
            .then((r) => r.json())
            .then((json) => {
                if (!cancelled) setSystemPrompt(json.systemPrompt || "");
            })
            .catch(() => {
                if (!cancelled) setSystemPrompt("");
            })
            .finally(() => {
                if (!cancelled) setSystemPromptLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [api, activeIri, activeSessionId]);

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

    const handleSelectSession = useCallback((sessionId: string) => {
        setActiveSessionId(sessionId);
    }, []);

    const handleNewSession = useCallback(async () => {
        try {
            const created = await createSession(activeIri || undefined);
            if (created) {
                toastSuccess(t("assistant.sessions.created"));
            }
        } catch (error) {
            console.error("Failed to create chat session:", error);
            toastError(t("assistant.sessions.errors.create"));
        }
    }, [createSession, activeIri, toastSuccess, toastError, t]);

    const handleRenameSession = useCallback(async () => {
        if (!activeSessionId) return;
        const current = sessions.find((s) => s.id === activeSessionId);
        const newTitle = window.prompt(
            t("assistant.sessions.renamePrompt"),
            current?.title ?? ""
        );
        if (newTitle == null) return;
        const trimmed = newTitle.trim();
        if (!trimmed) {
            toastError(t("assistant.sessions.errors.renameEmpty"));
            return;
        }
        try {
            await api(`/llm/chat-sessions/${activeSessionId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: trimmed }),
            });
            setSessions((prev) =>
                prev.map((session) =>
                    session.id === activeSessionId
                        ? { ...session, title: trimmed, updatedAt: new Date().toISOString() }
                        : session
                )
            );
            toastSuccess(t("assistant.sessions.renamed"));
        } catch (error) {
            console.error("Failed to rename chat session:", error);
            toastError(t("assistant.sessions.errors.rename"));
        }
    }, [activeSessionId, api, sessions, toastSuccess, toastError, t]);

    const handleDeleteSession = useCallback(async () => {
        if (!activeSessionId) return;
        if (sessions.length <= 1) {
            toastInfo(t("assistant.sessions.errors.deleteLast"));
            return;
        }
        const current = sessions.find((s) => s.id === activeSessionId);
        const confirmed = window.confirm(
            t("assistant.sessions.deleteConfirm", { title: current?.title ?? "" })
        );
        if (!confirmed) return;
        try {
            await api(`/llm/chat-sessions/${activeSessionId}`, { method: "DELETE" });
            const remaining = sessions.filter((session) => session.id !== activeSessionId);
            setSessions(remaining);
            if (remaining.length > 0) {
                setActiveSessionId(remaining[0].id);
            } else {
                setActiveSessionId(null);
                await createSession(activeIri || undefined);
            }
            toastSuccess(t("assistant.sessions.deleted"));
        } catch (error) {
            console.error("Failed to delete chat session:", error);
            toastError(t("assistant.sessions.errors.delete"));
        }
    }, [activeSessionId, sessions, api, toastSuccess, toastError, toastInfo, t, createSession, activeIri]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!activeSessionId) {
            toastError(t("assistant.sessions.errors.noActive"));
            return;
        }
        if (messagesLoading) return;
        const q = input.trim();
        if (!q || sending) return;

        const history = messages.slice(1);
        const questionMsg: ChatMsg = { role: "user", content: q };

        setMessages((prev) => [
            ...prev,
            questionMsg,
            {
                role: "assistant",
                content: "",
                plan: null,
                status: null,
                isStreaming: true,
                agentSteps: [],
            },
        ]);
        setInput("");
        setSending(true);
        const idempotencyKey = uuidv4();
        const sessionToRefresh = activeSessionId;

        try {
            await fetchEventSource(`${base}/llm/ask`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    question: q,
                    ontologyIri: activeIri || undefined,
                    history,
                    idempotencyKey,
                    sessionId: sessionToRefresh,
                }),

                async onopen(response) {
                    if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
                        throw new Error(`Failed to open SSE connection: ${response.status} ${response.statusText}`);
                    }
                },

                onmessage(event) {
                    if (!event.data) return;

                    try {
                        const parsedEvent = JSON.parse(event.data);
                        const { type, data } = parsedEvent as { type: string; data: any };

						switch (type) {
							case "system_prompt":
								if (typeof data === "string") setSystemPrompt(data);
								break;
							case "tool_call":
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
									const newLastMsg: ChatMsg = {
										...lastMsg,
										agentSteps: updatedSteps,
										isStreaming: true,
									};
									return [...prev.slice(0, -1), newLastMsg];
								});
								break;

							case "tool_result":
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

									const newLastMsg: ChatMsg = {
										...lastMsg,
										agentSteps: currentSteps,
										isStreaming: true,
									};
									return [...prev.slice(0, -1), newLastMsg];
								});
								break;

							case "info":
								setMessages((prev) => {
									if (prev.length === 0) return prev;
									const lastMsg = prev[prev.length - 1];
									if (lastMsg.role !== "assistant") return prev;
									const infoText =
										typeof data === "string"
											? data
											: data != null
												? String(data)
												: "";
									if (!infoText) return prev;
									const newLastMsg: ChatMsg = {
										...lastMsg,
										status: infoText,
										isStreaming: true,
									};
									return [...prev.slice(0, -1), newLastMsg];
								});
								break;

							case "chunk":
								setMessages((prev) => {
									if (prev.length === 0) return prev;
									const lastMsg = prev[prev.length - 1];
									if (lastMsg.role !== "assistant") return prev;
									let chunk = typeof data === "string" ? data : String(data ?? "");
									if (!chunk) return prev;

									let updatedPlan = lastMsg.plan ?? null;
									if (!updatedPlan) {
										const strategyPattern = /^(Stratégie[\s\S]*?)(?:\r?\n\r?\n|$)/i;
										const match = chunk.match(strategyPattern);
										if (match) {
											updatedPlan = match[1].trim();
											chunk = chunk.slice(match[0].length);
										} else if (chunk.trim().toLowerCase().startsWith("stratégie")) {
											updatedPlan = chunk.trim();
											chunk = "";
										}
									}

									const newLastMsg: ChatMsg = {
										...lastMsg,
										plan: updatedPlan,
										content: (lastMsg.content ?? "") + chunk,
										isStreaming: true,
									};
									return [...prev.slice(0, -1), newLastMsg];
								});
								break;

							case "done":
								setSending(false);
								setMessages((prev) => {
									if (prev.length === 0) return prev;
									const lastMsg = prev[prev.length - 1];
									if (lastMsg.role !== "assistant") return prev;
									const newLastMsg: ChatMsg = {
										...lastMsg,
										isStreaming: false,
										status: null,
									};
									return [...prev.slice(0, -1), newLastMsg];
								});
								break;

							case "error":
								console.error("Received error from server:", data);
								setMessages((prev) => {
									if (prev.length === 0) return prev;
									const lastMsg = prev[prev.length - 1];
									if (lastMsg.role !== "assistant") return prev;
									const message = typeof data === "string" ? data : String(data ?? "");
									const errorMsg: ChatMsg = {
										...lastMsg,
										content: `Erreur du serveur: ${message}`,
										isStreaming: false,
										status: null,
									};
									return [...prev.slice(0, -1), errorMsg];
								});
								setSending(false);
								break;
						}
                    } catch (parseErr) {
                        console.error("Failed to parse SSE data chunk:", event.data, parseErr);
                    }
                },

                onclose() {
                    setSending(false);
                },

				onerror(err) {
					console.error("SSE connection error:", err);
					setMessages((prev) => {
						if (prev.length === 0) return prev;
						const lastMsg = prev[prev.length - 1];
						if (lastMsg.role !== "assistant") return prev;
						const fallback = t("assistant.errors.connection");
						const errorMsg: ChatMsg = {
							...lastMsg,
							content: lastMsg.content ? `${lastMsg.content}\n\n${fallback}` : fallback,
							isStreaming: false,
							status: null,
						};
						return [...prev.slice(0, -1), errorMsg];
					});
					setSending(false);
					throw err;
                },
            });
        } catch (error) {
            console.error("Failed to send message:", error);
            toastError(t("assistant.errors.connection"));
        } finally {
            setSending(false);
            if (sessionToRefresh && sessionToRefresh === activeSessionId) {
                loadMessages(sessionToRefresh, { silent: true }).catch((err) =>
                    console.error("Failed to refresh messages:", err)
                );
            }
            if (activeIri) {
                loadSessions(activeIri, { silent: true }).catch((err) =>
                    console.error("Failed to refresh sessions:", err)
                );
            }
        }
    };

    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages]);

    if (ontologiesQuery.isError) {
        return (
            <div className="flex items-center justify-center h-screen text-red-500">
                {t("assistant.errors.loadOntologies")}
            </div>
        );
    }

    const disableInputs = sending || messagesLoading || !activeSessionId;

    return (
        <div className="container mx-auto max-w-5xl w-full flex flex-col gap-4">
            <header className="flex flex-col gap-3 mt-4 md:flex-row md:items-end md:justify-between">
                <h1 className="text-2xl font-semibold">{t("assistant.title")}</h1>
                <div className="flex flex-col gap-2 md:items-end">
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
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="text-sm">{t("assistant.sessions.current")}</label>
                        <select
                            className="input min-w-[14rem]"
                            value={activeSessionId ?? ""}
                            onChange={(e) => handleSelectSession(e.target.value)}
                            disabled={sessionsLoading || sessions.length === 0}
                        >
                            {sessions.length === 0 ? (
                                <option value="">{t("assistant.sessions.emptyState")}</option>
                            ) : (
                                sessions.map((session) => (
                                    <option key={session.id} value={session.id}>
                                        {session.title}
                                    </option>
                                ))
                            )}
                        </select>
                        <button
                            type="button"
                            className="btn-secondary text-xs"
                            onClick={handleNewSession}
                            disabled={sessionsLoading}
                        >
                            {t("assistant.sessions.new")}
                        </button>
                        <button
                            type="button"
                            className="btn-secondary text-xs"
                            onClick={handleRenameSession}
                            disabled={sessionsLoading || !activeSessionId}
                        >
                            {t("assistant.sessions.rename")}
                        </button>
                        <button
                            type="button"
                            className="btn-secondary text-xs text-red-500"
                            onClick={handleDeleteSession}
                            disabled={sessionsLoading || !activeSessionId || sessions.length <= 1}
                        >
                            {t("assistant.sessions.delete")}
                        </button>
                        {sessionsLoading && (
                            <span className="text-xs text-gray-500">{t("common.loading")}</span>
                        )}
                    </div>
                </div>
            </header>

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
                    {systemPromptLoading
                        ? t("common.loading")
                        : systemPrompt || t("assistant.systemPrompt.empty")}
                </pre>
            </div>

            <div
                ref={containerRef}
                className="card flex-1 min-h-[60vh] max-h-[65vh] overflow-y-auto p-4 space-y-3"
            >
                {messagesLoading && messages.length <= 1 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500">
                        {t("common.loading")}
                    </div>
                ) : (
                    messages.map((m, idx) => (
                        <div
                            key={idx}
                            className={`flex ${m.role === "user" ? "justify-end" : "flex-col items-start"}`}
                        >
							{m.role === "assistant" && m.status && m.isStreaming && (
								<div className="mb-1 w-full max-w-[80%] text-xs text-indigo-500 dark:text-indigo-300">
									<span className="mr-2 uppercase tracking-wide text-[10px] font-semibold">
										{t("assistant.agentReasoning.liveStatus")}
									</span>
									<span>{m.status}</span>
								</div>
							)}

							{m.role === "assistant" && m.plan && (
								<div className="mb-2 w-full max-w-[80%] rounded-lg border border-indigo-200/60 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900 dark:border-indigo-500/40 dark:bg-slate-800/60 dark:text-indigo-100">
									<p className="uppercase tracking-wide text-[10px] font-semibold text-indigo-500 dark:text-indigo-300 mb-1">
										{t("assistant.agentReasoning.planTitle")}
									</p>
									<ReactMarkdown
										remarkPlugins={[remarkGfm]}
										className="prose prose-sm dark:prose-invert"
									>
										{m.plan}
									</ReactMarkdown>
								</div>
							)}

							{m.role === "assistant" && m.agentSteps && m.agentSteps.length > 0 && (
								<div className="mb-2 w-full max-w-[80%]">
									<details className="rounded-lg bg-gray-100 dark:bg-slate-800 p-2">
										<summary className="cursor-pointer text-xs font-semibold text-gray-600 dark:text-gray-400">
											{t("assistant.agentReasoning.summary")}
										</summary>
                                        <div className="mt-2 space-y-2">
                                            {m.agentSteps.map((step, stepIdx) => (
                                                <div
                                                    key={`${step.id}-${stepIdx}`}
                                                    className="text-xs p-2 rounded bg-white dark:bg-slate-700"
                                                >
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
                                                        <div className="mt-1 text-gray-500 animate-pulse">
                                                            {t("assistant.agentReasoning.inProgress")}
                                                        </div>
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
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {m.content || "..."}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleSend} className="flex items-end gap-2">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t("assistant.input.placeholder")}
                    rows={2}
                    className="flex-1 text-sm border rounded-md px-3 py-2 dark:bg-slate-800 dark:border-slate-600 resize-none"
                    disabled={disableInputs}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                />
                <button
                    type="submit"
                    disabled={disableInputs || !input.trim()}
                    className="btn-primary disabled:opacity-50 h-[42px] w-[42px] flex-shrink-0 !p-0 flex items-center justify-center rounded-md"
                    aria-label={t("assistant.input.ariaSend")}
                >
                    {sending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                    ) : (
                        <PaperAirplaneIcon className="h-5 w-5" />
                    )}
                </button>
            </form>
            <p className="text-xs text-gray-500">{t("assistant.footer.hint")}</p>
        </div>
    );
}
