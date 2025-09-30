import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
import { useTranslation } from "../language/useTranslation";

export default function LoginPage() {
    const { token, login } = useAuth();
    const api = useApi();
    const loc = useLocation();
    const { t } = useTranslation();
    const [email, setEmail] = useState("");
    const [password, setPwd] = useState("");
    const [error, setError] = useState("");

    if (token) return <Navigate to={loc.state?.from?.pathname ?? "/"} replace />;

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
        } catch (err) {
            setError(t("auth.login.error"));
            console.error(err);
        }
    };


    return (
        <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
            <div className="card w-80 p-6 space-y-4">
                <h1 className="text-lg font-semibold text-center">{t("auth.login.title")}</h1>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <input
                    className="input w-full"
                    placeholder={t("auth.email")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    className="input w-full"
                    type="password"
                    placeholder={t("auth.password")}
                    value={password}
                    onChange={(e) => setPwd(e.target.value)}
                />
                <button className="btn-primary w-full justify-center" onClick={submit}>
                    {t("auth.login.submit")}
                </button>
                <div className="text-center text-xs">
                    {t("auth.login.noAccount")} {" "}
                    <a href="/register" className="text-indigo-600 hover:underline">
                        {t("auth.login.createAccount")}
                    </a>
                </div>
            </div>
        </div>
    );
}
