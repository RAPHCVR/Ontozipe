import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
	const { token, login } = useAuth();
	const loc = useLocation();
	const [email, setEmail] = useState("");
	const [password, setPwd] = useState("");
	const [error, setError] = useState("");

	if (token) return <Navigate to={loc.state?.from?.pathname ?? "/"} replace />;

	const submit = () => {
		fetch("http://localhost:4000/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		})
			.then((r) => (r.ok ? r.json() : Promise.reject(r)))
			.then((data) => login(data.token))
			.catch(() => setError("Identifiants invalides"));
	};

	return (
		<div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-900">
			<div className="card w-80 p-6 space-y-4">
				<h1 className="text-lg font-semibold text-center">Connexion</h1>
				{error && <p className="text-red-500 text-sm">{error}</p>}
				<input
					className="input w-full"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
				<input
					className="input w-full"
					type="password"
					placeholder="Mot de passe"
					value={password}
					onChange={(e) => setPwd(e.target.value)}
				/>
				<button className="btn-primary w-full justify-center" onClick={submit}>
					Se connecter
				</button>
				<div className="text-center text-xs">
					Pas encore de compte ?{" "}
					<a href="/register" className="text-indigo-600 hover:underline">
						Créer un compte
					</a>
				</div>
			</div>
		</div>
	);
}
