import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";

export default function RegisterPage() {
    const { token, login } = useAuth();
    const api = useApi();
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [err, setErr] = useState("");

    if (token) return <Navigate to="/" replace />;

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
        } catch (error) {
            // Affiche l'erreur spécifique du backend (ex: "mot de passe trop court")
            if (error instanceof Error) {
                setErr(error.message);
            } else {
                setErr("Impossible de créer le compte. L'email est peut-être déjà utilisé.");
            }
            console.error(error);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
            <div className="card w-80 p-6 space-y-4">
                <h1 className="text-lg font-semibold text-center">Créer un compte</h1>
                {err && <p className="text-red-500 text-sm text-center">{err}</p>}

                <input
                    className="input w-full"
                    type="text"
                    placeholder="Nom"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                    className="input w-full"
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <input
                    className="input w-full"
                    type="password"
                    placeholder="Mot de passe"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                />

                <button className="btn-primary w-full justify-center" onClick={submit}>
                    S’inscrire
                </button>
                <div className="text-center text-xs">
                    Déjà un compte ?{" "}
                    <Link to="/login" className="text-indigo-600 hover:underline">
                        Se connecter
                    </Link>
                </div>
            </div>
        </div>
    );
}