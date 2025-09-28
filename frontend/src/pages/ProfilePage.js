import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useProfile } from "../hooks/apiQueries";
import { useApi } from "../lib/api";
const hasRequiredSpecialChar = (value) => /[&'\-_\?\./;/:!]/.test(value);
const hasDigit = (value) => /\d/.test(value);
const statusClass = (type) => type === "success"
    ? "bg-green-50 text-green-700 border border-green-200"
    : "bg-red-50 text-red-700 border border-red-200";
export default function ProfilePage() {
    const { user, token } = useAuth();
    const profileQuery = useProfile();
    const api = useApi();
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [avatar, setAvatar] = useState("");
    const [infoStatus, setInfoStatus] = useState(null);
    const [infoLoading, setInfoLoading] = useState(false);
    useEffect(() => {
        if (profileQuery.data) {
            setName(profileQuery.data.name ?? "");
            setAvatar(profileQuery.data.avatar ?? "");
        }
    }, [profileQuery.data]);
    useEffect(() => {
        if (!infoStatus)
            return;
        const timeout = window.setTimeout(() => setInfoStatus(null), 5000);
        return () => window.clearTimeout(timeout);
    }, [infoStatus]);
    const handleInfoSubmit = async (event) => {
        event.preventDefault();
        setInfoStatus(null);
        const trimmedName = name.trim();
        if (!trimmedName) {
            setInfoStatus({ type: "error", message: "Le nom ne peut pas être vide." });
            return;
        }
        const trimmedAvatar = avatar.trim();
        setInfoLoading(true);
        try {
            await api("/auth/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: trimmedName,
                    avatar: trimmedAvatar ? trimmedAvatar : undefined,
                }),
            });
            await queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
            setInfoStatus({ type: "success", message: "Informations mises à jour." });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Mise à jour impossible.";
            setInfoStatus({ type: "error", message });
        }
        finally {
            setInfoLoading(false);
        }
    };
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [pwdStatus, setPwdStatus] = useState(null);
    const [pwdLoading, setPwdLoading] = useState(false);
    useEffect(() => {
        if (!pwdStatus)
            return;
        const timeout = window.setTimeout(() => setPwdStatus(null), 5000);
        return () => window.clearTimeout(timeout);
    }, [pwdStatus]);
    const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, ""), []);
    const handlePasswordSubmit = async (event) => {
        event.preventDefault();
        setPwdStatus(null);
        if (newPassword.length < 8) {
            setPwdStatus({
                type: "error",
                message: "Le nouveau mot de passe doit comporter au moins 8 caractères.",
            });
            return;
        }
        if (!hasRequiredSpecialChar(newPassword)) {
            setPwdStatus({
                type: "error",
                message: "Ajoutez au moins un caractère spécial parmi (&, ', -, _, ?, ., ;, /, :, !).",
            });
            return;
        }
        if (!hasDigit(newPassword)) {
            setPwdStatus({
                type: "error",
                message: "Ajoutez au moins un chiffre dans votre mot de passe.",
            });
            return;
        }
        if (!token) {
            setPwdStatus({ type: "error", message: "Session expirée. Veuillez vous reconnecter." });
            return;
        }
        setPwdLoading(true);
        try {
            const response = await fetch(`${apiBaseUrl}/auth/change-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ oldPassword, newPassword }),
            });
            if (response.status === 401) {
                setPwdStatus({ type: "error", message: "Ancien mot de passe incorrect." });
                return;
            }
            if (!response.ok) {
                const body = await response.json().catch(() => ({ message: "Changement impossible." }));
                throw new Error(body.message || "Changement impossible.");
            }
            setPwdStatus({ type: "success", message: "Mot de passe mis à jour." });
            setOldPassword("");
            setNewPassword("");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Changement impossible.";
            setPwdStatus({ type: "error", message });
        }
        finally {
            setPwdLoading(false);
        }
    };
    if (profileQuery.isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsx("div", { className: "rounded-xl bg-white/70 dark:bg-slate-800/60 px-6 py-4 shadow", children: "Chargement du profil\u2026" }) }));
    }
    if (profileQuery.isError) {
        return (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsx("div", { className: "rounded-xl bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-200 px-6 py-4 shadow", children: "Impossible de charger le profil." }) }));
    }
    const inputClass = "input w-full rounded-xl border border-indigo-200 bg-white/90 dark:bg-slate-900/70 " +
        "px-3 py-2 text-sm shadow-sm transition focus:-translate-y-px focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 " +
        "dark:border-slate-600 dark:focus:border-indigo-300";
    const sectionClass = "relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/80 " +
        "p-6 shadow-lg backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/70";
    const headerGradient = "absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500";
    const disabledInputClass = "cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 text-slate-500 " +
        "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400";
    return (_jsxs("div", { className: "container mx-auto max-w-5xl space-y-8 px-4 py-12", children: [_jsx("header", { className: "rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-[1px] shadow-xl", children: _jsxs("div", { className: "flex flex-col gap-4 rounded-3xl bg-white/95 p-6 text-slate-800 dark:bg-slate-900/90 dark:text-slate-100 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Votre profil" }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-300", children: "G\u00E9rez vos informations personnelles et s\u00E9curisez votre compte en quelques clics." })] }), _jsxs("div", { className: "flex items-center gap-3 rounded-2xl bg-indigo-50 px-4 py-2 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200", children: [_jsx("span", { className: "text-xs uppercase tracking-wide", children: "Utilisateur" }), _jsx("span", { className: "text-sm font-medium", children: user?.email ?? "Utilisateur anonyme" })] })] }) }), _jsxs("section", { className: sectionClass, children: [_jsx("div", { className: headerGradient }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("h2", { className: "text-xl font-semibold text-slate-800 dark:text-slate-100", children: "Informations g\u00E9n\u00E9rales" }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-300", children: "Mettez \u00E0 jour votre nom et le lien d'avatar partag\u00E9 avec l'\u00E9quipe." })] }), _jsxs("form", { className: "space-y-5", onSubmit: handleInfoSubmit, children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-slate-700 dark:text-slate-200", children: "Nom" }), _jsx("input", { className: inputClass, value: name, onChange: (event) => setName(event.target.value), placeholder: "Votre nom", autoComplete: "name" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-slate-700 dark:text-slate-200", children: "Email" }), _jsx("input", { className: `${inputClass} ${disabledInputClass}`, value: user?.email ?? "", disabled: true })] })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-slate-700 dark:text-slate-200", children: "Avatar (URL)" }), _jsx("input", { className: inputClass, value: avatar, onChange: (event) => setAvatar(event.target.value), placeholder: "https://exemple.com/avatar.png", autoComplete: "url" })] }), infoStatus && (_jsx("div", { className: `rounded-xl px-4 py-3 text-sm ${statusClass(infoStatus.type)}`, children: infoStatus.message })), _jsx("div", { className: "flex justify-end", children: _jsx("button", { type: "submit", className: "flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300", disabled: infoLoading, children: infoLoading ? "Enregistrement..." : "Enregistrer" }) })] })] })] }), _jsxs("section", { className: sectionClass, children: [_jsx("div", { className: headerGradient }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("h2", { className: "text-xl font-semibold text-slate-800 dark:text-slate-100", children: "S\u00E9curit\u00E9 du compte" }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-300", children: "Choisissez un mot de passe fort pour prot\u00E9ger vos donn\u00E9es." })] }), _jsxs("form", { className: "space-y-5", onSubmit: handlePasswordSubmit, children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-slate-700 dark:text-slate-200", children: "Ancien mot de passe" }), _jsx("input", { type: "password", className: inputClass, value: oldPassword, onChange: (event) => setOldPassword(event.target.value), autoComplete: "current-password" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-slate-700 dark:text-slate-200", children: "Nouveau mot de passe" }), _jsx("input", { type: "password", className: inputClass, value: newPassword, onChange: (event) => setNewPassword(event.target.value), autoComplete: "new-password" })] })] }), _jsxs("div", { className: "rounded-2xl border border-indigo-100/80 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-inner dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300", children: [_jsx("p", { className: "font-medium text-slate-700 dark:text-slate-200", children: "Votre mot de passe doit contenir au moins\u00A0:" }), _jsxs("ul", { className: "mt-2 space-y-1 text-sm list-disc pl-5", children: [_jsx("li", { children: "8 caract\u00E8res minimum" }), _jsx("li", { children: "1 caract\u00E8re sp\u00E9cial (&, ', -, _, ?, ., ;, /, :, !)" }), _jsx("li", { children: "1 chiffre minimum" })] })] }), pwdStatus && (_jsx("div", { className: `rounded-xl px-4 py-3 text-sm ${statusClass(pwdStatus.type)}`, children: pwdStatus.message })), _jsx("div", { className: "flex justify-end", children: _jsx("button", { type: "submit", className: "flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-600/30 transition hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-300", disabled: pwdLoading, children: pwdLoading ? "Mise à jour..." : "Changer le mot de passe" }) })] })] })] })] }));
}
