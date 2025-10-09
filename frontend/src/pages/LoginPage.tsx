import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
import { useTranslation } from "../language/useTranslation";
import PasswordField from "../components/form/PasswordField";

export default function LoginPage() {
	const { token, login } = useAuth();
	const api = useApi();
	const loc = useLocation();
	const { t } = useTranslation();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	if (token) return <Navigate to={loc.state?.from?.pathname ?? "/"} replace />;

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		setIsSubmitting(true);
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
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="auth-page">
			<div className="auth-card">
				<div className="auth-card__header">
					<h1 className="auth-card__title">{t("auth.login.title")}</h1>
					<p className="auth-card__subtitle">{t("auth.login.noAccount")}</p>
				</div>

				{error && (
					<div className="status-banner status-banner--error" role="alert">
						{error}
					</div>
				)}

				<form className="form-grid" onSubmit={handleSubmit} noValidate>
					<div className="form-field">
						<label className="form-label" htmlFor="login-email">
							{t("auth.email")}
						</label>
						<input
							id="login-email"
							className="form-input"
							type="email"
							autoComplete="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
							disabled={isSubmitting}
						/>
					</div>
					<PasswordField
						id="login-password"
						label={t("auth.password")}
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						autoComplete="current-password"
						required
						disabled={isSubmitting}
					/>
					<button
						className="btn-primary"
						type="submit"
						disabled={isSubmitting}
						style={{ width: "100%" }}>
						{isSubmitting ? t("common.loading") : t("auth.login.submit")}
					</button>
				</form>

				<div className="auth-card__footer">
					{t("auth.login.noAccount")}{" "}
					<Link to="/register">{t("auth.login.createAccount")}</Link>
				</div>
			</div>
		</div>
	);
}
