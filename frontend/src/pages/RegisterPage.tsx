import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function RegisterPage() {
	const { token, login } = useAuth();
	const [form, setForm] = useState({ name: "", email: "", password: "" });
	const [err, setErr] = useState("");

	if (token) return <Navigate to="/" replace />;

	const submit = () => {
		fetch("http://localhost:4000/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(form),
		})
			.then((r) => (r.ok ? r.json() : Promise.reject(r)))
			.then((d) => login(d.token))
			.catch(() => setErr("Impossible de créer le compte"));
	};

	return (
		<div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
			<div className="card w-80 p-6 space-y-4">
				<h1 className="text-lg font-semibold text-center">Créer un compte</h1>
				{err && <p className="text-red-500 text-sm">{err}</p>}
				{["name", "email", "password"].map((k) => (
					<input
						key={k}
						className="input w-full"
						type={k === "password" ? "password" : "text"}
						placeholder={k === "name" ? "Nom" : k}
						value={(form as any)[k]}
						onChange={(e) => setForm({ ...form, [k]: e.target.value })}
					/>
				))}
				<button className="btn-primary w-full justify-center" onClick={submit}>
					S’inscrire
				</button>
			</div>
		</div>
	);
}
