import { FormEvent, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
import { useTranslation } from "../language/useTranslation";
import PasswordField from "../components/form/PasswordField";

export default function RegisterPage() {
	const { token, login } = useAuth();
	const api = useApi();
	const { t } = useTranslation();
	const [form, setForm] = useState({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
	});
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	if (token) return <Navigate to="/" replace />;

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");

		const name = form.name.trim();
		const email = form.email.trim();

		if (!name || !email || !form.password || !form.confirmPassword) {
			setError(t("auth.register.error.required"));
			return;
		}

		if (form.password !== form.confirmPassword) {
			setError(t("auth.register.error.passwordMismatch"));
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await api("auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, email, password: form.password }),
			});
			const data = await response.json();
			login(data.token);
		} catch (caughtError) {
			if (caughtError instanceof Error) {
				setError(caughtError.message || t("auth.register.error.generic"));
			} else {
				setError(t("auth.register.error.generic"));
			}
			console.error(caughtError);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="auth-page">
			<div className="auth-card">
				<div className="auth-card__header">
					<h1 className="auth-card__title">{t("auth.register.title")}</h1>
					<p className="auth-card__subtitle">
						{t("auth.register.haveAccount")}
					</p>
				</div>

				{error && (
					<div className="status-banner status-banner--error" role="alert">
						{error}
					</div>
				)}

				<form className="form-grid" onSubmit={handleSubmit} noValidate>
					<div className="form-field">
						<label className="form-label" htmlFor="register-name">
							{t("auth.name")}
						</label>
						<input
							id="register-name"
							className="form-input"
							type="text"
							value={form.name}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, name: event.target.value }))
							}
							autoComplete="name"
							required
							disabled={isSubmitting}
						/>
					</div>
					<div className="form-field">
						<label className="form-label" htmlFor="register-email">
							{t("auth.email")}
						</label>
						<input
							id="register-email"
							className="form-input"
							type="email"
							value={form.email}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, email: event.target.value }))
							}
							autoComplete="email"
							required
							disabled={isSubmitting}
						/>
					</div>
					<PasswordField
						id="register-password"
						label={t("auth.password")}
						value={form.password}
						onChange={(event) =>
							setForm((prev) => ({ ...prev, password: event.target.value }))
						}
						autoComplete="new-password"
						required
						disabled={isSubmitting}
					/>
					<PasswordField
						id="register-confirm-password"
						label={t("auth.confirmPassword")}
						value={form.confirmPassword}
						onChange={(event) =>
							setForm((prev) => ({
								...prev,
								confirmPassword: event.target.value,
							}))
						}
						autoComplete="new-password"
						required
						disabled={isSubmitting}
					/>

					<button
						className="btn-primary"
						type="submit"
						disabled={isSubmitting}
						style={{ width: "100%" }}>
						{isSubmitting ? t("common.loading") : t("auth.register.submit")}
					</button>
				</form>

				<div className="auth-card__footer">
					{t("auth.register.haveAccount")}{" "}
					<Link to="/login">{t("auth.login.submit")}</Link>
				</div>
			</div>
		</div>
	);
}
