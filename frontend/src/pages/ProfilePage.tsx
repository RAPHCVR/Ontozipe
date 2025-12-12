import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useProfile } from "../hooks/apiQueries";
import { useApi } from "../lib/api";
import { useTranslation } from "../language/useTranslation";
import type { TranslationKey } from "../language/messages";
import PasswordField from "../components/form/PasswordField";

const hasRequiredSpecialChar = (value: string) => /[&'\-_?./;/:!]/.test(value);
const hasDigit = (value: string) => /\d/.test(value);

const statusClass = (type: "success" | "error") =>
	`status-banner ${
		type === "success" ? "status-banner--success" : "status-banner--error"
	}`;

type StatusMessage = {
	type: "success" | "error";
	key?: TranslationKey;
	values?: Record<string, string | number>;
	fallback?: string;
	useFallback?: boolean;
};

export default function ProfilePage() {
	const { user, token } = useAuth();
	const profileQuery = useProfile();
	const api = useApi();
	const queryClient = useQueryClient();
	const { t } = useTranslation();

	const [name, setName] = useState("");
	const [avatar, setAvatar] = useState("");
	const [infoStatus, setInfoStatus] = useState<StatusMessage | null>(null);
	const [infoLoading, setInfoLoading] = useState(false);

	useEffect(() => {
		if (profileQuery.data) {
			setName(profileQuery.data.name ?? "");
			setAvatar(profileQuery.data.avatar ?? "");
		}
	}, [profileQuery.data]);

	useEffect(() => {
		if (!infoStatus) return;
		const timeout = window.setTimeout(() => setInfoStatus(null), 5000);
		return () => window.clearTimeout(timeout);
	}, [infoStatus]);

	const toStatusMessage = useCallback(
		(
			type: "success" | "error",
			key: TranslationKey,
			fallback?: string,
			values?: Record<string, string | number>
		): StatusMessage => {
			const defaultValue = t(key, values);
			const cleanedFallback = fallback?.trim();
			return {
				type,
				key,
				values,
				fallback: cleanedFallback,
				useFallback: Boolean(
					cleanedFallback && cleanedFallback !== defaultValue
				),
			};
		},
		[t]
	);

	const resolveStatusMessage = useCallback(
		(status: StatusMessage | null) => {
			if (!status) return null;
			if (status.useFallback && status.fallback) return status.fallback;
			if (status.key) return t(status.key, status.values);
			if (status.fallback) return status.fallback;
			return null;
		},
		[t]
	);

	const handleInfoSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setInfoStatus(null);

		const trimmedName = name.trim();
		if (!trimmedName) {
			setInfoStatus(toStatusMessage("error", "profile.error.infoEmptyName"));
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
			setInfoStatus(toStatusMessage("success", "profile.success.info"));
		} catch (error) {
			const fallback = error instanceof Error ? error.message : undefined;
			setInfoStatus(
				toStatusMessage("error", "profile.error.infoUpdate", fallback)
			);
		} finally {
			setInfoLoading(false);
		}
	};

	const [oldPassword, setOldPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [pwdStatus, setPwdStatus] = useState<StatusMessage | null>(null);
	const [pwdLoading, setPwdLoading] = useState(false);

	useEffect(() => {
		if (!pwdStatus) return;
		const timeout = window.setTimeout(() => setPwdStatus(null), 5000);
		return () => window.clearTimeout(timeout);
	}, [pwdStatus]);

	const apiBaseUrl = useMemo(
		() =>
			("https://ontozipe.hugopereira.fr/api").replace(
				/\/$/,
				""
			),
		[]
	);

	const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setPwdStatus(null);

		if (newPassword.length < 8) {
			setPwdStatus(
				toStatusMessage("error", "profile.error.password.minLength")
			);
			return;
		}

		if (!hasRequiredSpecialChar(newPassword)) {
			setPwdStatus(toStatusMessage("error", "profile.error.password.special"));
			return;
		}

		if (!hasDigit(newPassword)) {
			setPwdStatus(toStatusMessage("error", "profile.error.password.digit"));
			return;
		}

		if (newPassword !== confirmPassword) {
			setPwdStatus(toStatusMessage("error", "profile.error.password.mismatch"));
			return;
		}

		if (!token) {
			setPwdStatus(toStatusMessage("error", "profile.error.password.session"));
			return;
		}

		setPwdLoading(true);
		try {
			const response = await fetch(apiBaseUrl + "/auth/change-password", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer " + token,
				},
				body: JSON.stringify({ oldPassword, newPassword }),
			});

			if (response.status === 401) {
				setPwdStatus(toStatusMessage("error", "profile.error.password.old"));
				return;
			}

			if (!response.ok) {
				const body = await response
					.json()
					.catch(() => ({ message: t("profile.error.password.generic") }));
				throw new Error(body.message || t("profile.error.password.generic"));
			}

			setPwdStatus(toStatusMessage("success", "profile.success.password"));
			setOldPassword("");
			setNewPassword("");
			setConfirmPassword("");
		} catch (error) {
			const fallback = error instanceof Error ? error.message : undefined;
			setPwdStatus(
				toStatusMessage("error", "profile.error.password.generic", fallback)
			);
		} finally {
			setPwdLoading(false);
		}
	};

	if (profileQuery.isLoading) {
		return (
			<div className="page-shell">
				<section className="page-section">
					<div className="note-box">{t("profile.loading")}</div>
				</section>
			</div>
		);
	}

	if (profileQuery.isError) {
		return (
			<div className="page-shell">
				<section className="page-section">
					<div className="status-banner status-banner--error">
						{t("profile.error.load")}
					</div>
				</section>
			</div>
		);
	}

	const infoMessage = resolveStatusMessage(infoStatus);
	const pwdMessage = resolveStatusMessage(pwdStatus);

	return (
		<div className="page-shell">
			<header className="page-header">
				<div className="page-header__content">
					<h1 className="page-header__title">{t("profile.title")}</h1>
					<p className="page-header__subtitle">{t("profile.subtitle")}</p>
				</div>
				<div className="page-header__actions">
					<div className="page-header__badge">
						<span>{t("profile.badge.label")}</span>
						<span>{user?.email ?? t("profile.badge.anonymous")}</span>
					</div>
				</div>
			</header>

			<section className="page-section">
				<div className="page-section__header">
					<h2 className="page-section__title">
						{t("profile.sections.info.title")}
					</h2>
					<p className="page-section__description">
						{t("profile.sections.info.description")}
					</p>
				</div>

				<form className="form-grid" onSubmit={handleInfoSubmit}>
					<div className="form-grid form-grid--columns">
						<div className="form-field">
							<label className="form-label">
								{t("profile.fields.name.label")}
							</label>
							<input
								className="form-input"
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder={t("profile.fields.name.placeholder")}
								autoComplete="name"
							/>
						</div>
						<div className="form-field">
							<label className="form-label">
								{t("profile.fields.email.label")}
							</label>
							<input
								className="form-input"
								value={user?.email ?? ""}
								disabled
							/>
						</div>
					</div>

					<div className="form-field">
						<label className="form-label">
							{t("profile.fields.avatar.label")}
						</label>
						<input
							className="form-input"
							value={avatar}
							onChange={(event) => setAvatar(event.target.value)}
							placeholder={t("profile.fields.avatar.placeholder")}
							autoComplete="url"
						/>
					</div>

					{infoStatus && infoMessage && (
						<div className={statusClass(infoStatus.type)}>{infoMessage}</div>
					)}

					<div className="form-actions">
						<button
							type="submit"
							className="btn-primary"
							disabled={infoLoading}>
							{infoLoading
								? t("profile.actions.saving")
								: t("profile.actions.save")}
						</button>
					</div>
				</form>
			</section>

			<section className="page-section">
				<div className="page-section__header">
					<h2 className="page-section__title">
						{t("profile.sections.security.title")}
					</h2>
					<p className="page-section__description">
						{t("profile.sections.security.description")}
					</p>
				</div>

				<form className="form-grid" onSubmit={handlePasswordSubmit}>
					<div className="form-grid form-grid--columns">
						<PasswordField
							id="profile-old-password"
							label={t("profile.fields.oldPassword.label")}
							value={oldPassword}
							onChange={(event) => setOldPassword(event.target.value)}
							autoComplete="current-password"
							disabled={pwdLoading}
						/>
					</div>
					<hr />
					<div className="form-grid form-grid--columns">
						<PasswordField
							id="profile-new-password"
							label={t("profile.fields.newPassword.label")}
							value={newPassword}
							onChange={(event) => setNewPassword(event.target.value)}
							autoComplete="new-password"
							required
							disabled={pwdLoading}
						/>
						<PasswordField
							id="profile-confirm-password"
							label={t("profile.fields.confirmPassword.label")}
							value={confirmPassword}
							onChange={(event) => setConfirmPassword(event.target.value)}
							autoComplete="new-password"
							required
							disabled={pwdLoading}
						/>
					</div>

					<div className="note-box">
						<p
							className="page-section__description"
							style={{ marginBottom: "0.65rem" }}>
							<strong>{t("profile.password.hintTitle")}</strong>
						</p>
						<ul
							style={{
								paddingLeft: "1.25rem",
								display: "grid",
								gap: "0.35rem",
							}}>
							<li>{t("profile.password.rule.minLength")}</li>
							<li>{t("profile.password.rule.special")}</li>
							<li>{t("profile.password.rule.digit")}</li>
						</ul>
					</div>

					{pwdStatus && pwdMessage && (
						<div className={statusClass(pwdStatus.type)}>{pwdMessage}</div>
					)}

					<div className="form-actions">
						<button type="submit" className="btn-primary" disabled={pwdLoading}>
							{pwdLoading
								? t("profile.actions.updatingPassword")
								: t("profile.actions.changePassword")}
						</button>
					</div>
				</form>
			</section>
		</div>
	);
}
