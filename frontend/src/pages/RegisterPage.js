import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
export default function RegisterPage() {
    const { token, login } = useAuth();
    const api = useApi();
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [err, setErr] = useState("");
    if (token)
        return _jsx(Navigate, { to: "/", replace: true });
    const submit = async () => {
        setErr("");
        if (!form.name.trim() || !form.email.trim() || !form.password) {
            setErr("Tous les champs sont requis.");
            return;
        }
        try {
            const res = await api("auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            // Le backend retourne directement le token après inscription, on peut donc se connecter
            login(data.token);
        }
        catch (error) {
            // Affiche l'erreur spécifique du backend (ex: "mot de passe trop court")
            if (error instanceof Error) {
                setErr(error.message);
            }
            else {
                setErr("Impossible de créer le compte. L'email est peut-être déjà utilisé.");
            }
            console.error(error);
        }
    };
    return (_jsx("div", { className: "flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900", children: _jsxs("div", { className: "card w-80 p-6 space-y-4", children: [_jsx("h1", { className: "text-lg font-semibold text-center", children: "Cr\u00E9er un compte" }), err && _jsx("p", { className: "text-red-500 text-sm text-center", children: err }), _jsx("input", { className: "input w-full", type: "text", placeholder: "Nom", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) }), _jsx("input", { className: "input w-full", type: "email", placeholder: "Email", value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }) }), _jsx("input", { className: "input w-full", type: "password", placeholder: "Mot de passe", value: form.password, onChange: (e) => setForm({ ...form, password: e.target.value }) }), _jsx("button", { className: "btn-primary w-full justify-center", onClick: submit, children: "S\u2019inscrire" }), _jsxs("div", { className: "text-center text-xs", children: ["D\u00E9j\u00E0 un compte ?", " ", _jsx(Link, { to: "/login", className: "text-indigo-600 hover:underline", children: "Se connecter" })] })] }) }));
}
