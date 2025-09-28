import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
export default function LoginPage() {
    const { token, login } = useAuth();
    const api = useApi();
    const loc = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPwd] = useState("");
    const [error, setError] = useState("");
    if (token)
        return _jsx(Navigate, { to: loc.state?.from?.pathname ?? "/", replace: true });
    const submit = async () => {
        setError("");
        try {
            const res = await api("auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            login(data.token);
        }
        catch (err) {
            setError("Identifiants invalides ou erreur de communication.");
            console.error(err);
        }
    };
    return (_jsx("div", { className: "flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900", children: _jsxs("div", { className: "card w-80 p-6 space-y-4", children: [_jsx("h1", { className: "text-lg font-semibold text-center", children: "Connexion" }), error && _jsx("p", { className: "text-red-500 text-sm", children: error }), _jsx("input", { className: "input w-full", placeholder: "Email", value: email, onChange: (e) => setEmail(e.target.value) }), _jsx("input", { className: "input w-full", type: "password", placeholder: "Mot de passe", value: password, onChange: (e) => setPwd(e.target.value) }), _jsx("button", { className: "btn-primary w-full justify-center", onClick: submit, children: "Se connecter" }), _jsxs("div", { className: "text-center text-xs", children: ["Pas encore de compte ?", " ", _jsx("a", { href: "/register", className: "text-indigo-600 hover:underline", children: "Cr\u00E9er un compte" })] })] }) }));
}
