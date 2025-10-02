import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
import { useTranslation } from "../language/useTranslation";

export default function RegisterPage() {
    const { token, login } = useAuth();
    const api = useApi();
    const { t } = useTranslation();
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [err, setErr] = useState("");

    if (token) return <Navigate to="/" replace />;

    const submit = async () => {
        setErr("");

        if (!form.name.trim() || !form.email.trim() || !form.password) {
            setErr(t("auth.register.error.required"));
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
        } catch (error) {
            // Affiche l'erreur spécifique du backend (ex: "mot de passe trop court")
            if (error instanceof Error) {
                setErr(error.message);
            } else {
                setErr(t("auth.register.error.generic"));
            }
            console.error(error);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
            <div className="card w-80 p-6 space-y-4">
                <h1 className="text-lg font-semibold text-center">{t("auth.register.title")}</h1>
                {err && <p className="text-red-500 text-sm text-center">{err}</p>}

                <input
                    className="input w-full"
                    type="text"
                    placeholder={t("auth.name")}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                    className="input w-full"
                    type="email"
                    placeholder={t("auth.email")}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <input
                    className="input w-full"
                    type="password"
                    placeholder={t("auth.password")}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                />

                <button className="btn-primary w-full justify-center" onClick={submit}>
                    {t("auth.register.submit")}
                </button>
                <div className="text-center text-xs">
                    {t("auth.register.haveAccount")} {" "}
                    <Link to="/login" className="text-indigo-600 hover:underline">
                        {t("auth.login.submit")}
                    </Link>
                </div>
            </div>
        </div>
    );
}
