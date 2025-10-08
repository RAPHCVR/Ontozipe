import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useProfile } from "../hooks/apiQueries";
import { useApi } from "../lib/api";

const hasRequiredSpecialChar = (value: string) =>
	/[&'\-_\?\./;/:!]/.test(value);
const hasDigit = (value: string) => /\d/.test(value);

const statusClass = (type: "success" | "error") =>
	type === "success"
		? "bg-green-50 text-green-700 border border-green-200"
		: "bg-red-50 text-red-700 border border-red-200";

export default function ProfilePage() {
	const { user, token } = useAuth();
	const profileQuery = useProfile();
	const api = useApi();
	const queryClient = useQueryClient();

	const [name, setName] = useState("");
	const [avatar, setAvatar] = useState("");
	const [infoStatus, setInfoStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);
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

	const handleInfoSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setInfoStatus(null);

		const trimmedName = name.trim();
		if (!trimmedName) {
			setInfoStatus({
				type: "error",
				message: "Le nom ne peut pas être vide.",
			});
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
			setInfoStatus({ type: "success", message: "Informations mises à jour." });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Mise à jour impossible.";
			setInfoStatus({ type: "error", message });
		} finally {
			setInfoLoading(false);
		}
	};

	const [oldPassword, setOldPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [pwdStatus, setPwdStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);
	const [pwdLoading, setPwdLoading] = useState(false);

	useEffect(() => {
		if (!pwdStatus) return;
		const timeout = window.setTimeout(() => setPwdStatus(null), 5000);
		return () => window.clearTimeout(timeout);
	}, [pwdStatus]);

	const apiBaseUrl = useMemo(
		() =>
			(import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(
				/\/$/,
				""
			),
		[]
	);

	const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setPwdStatus(null);

		if (newPassword.length < 8) {
			setPwdStatus({
				type: "error",
				message:
					"Le nouveau mot de passe doit comporter au moins 8 caractères.",
			});
			return;
		}

		if (!hasRequiredSpecialChar(newPassword)) {
			setPwdStatus({
				type: "error",
				message:
					"Ajoutez au moins un caractère spécial parmi (&, ', -, _, ?, ., ;, /, :, !).",
			});
			return;
		}

		if (!hasDigit(newPassword)) {
			setPwdStatus({
				type: "error",
				message: "Ajoutez au moins un chiffre dans votre mot de passe.",
			});
			return;
		}

		if (!token) {
			setPwdStatus({
				type: "error",
				message: "Session expirée. Veuillez vous reconnecter.",
			});
			return;
		}

		setPwdLoading(true);
		try {
			const response = await fetch(`${apiBaseUrl}/auth/change-password`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ oldPassword, newPassword }),
			});

			if (response.status === 401) {
				setPwdStatus({
					type: "error",
					message: "Ancien mot de passe incorrect.",
				});
				return;
			}

			if (!response.ok) {
				const body = await response
					.json()
					.catch(() => ({ message: "Changement impossible." }));
				throw new Error(body.message || "Changement impossible.");
			}

			setPwdStatus({ type: "success", message: "Mot de passe mis à jour." });
			setOldPassword("");
			setNewPassword("");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Changement impossible.";
			setPwdStatus({ type: "error", message });
		} finally {
			setPwdLoading(false);
		}
	};

	if (profileQuery.isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="rounded-xl bg-white/70 dark:bg-slate-800/60 px-6 py-4 shadow">
					Chargement du profil…
				</div>
			</div>
		);
	}

	if (profileQuery.isError) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="rounded-xl bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-200 px-6 py-4 shadow">
					Impossible de charger le profil.
				</div>
			</div>
		);
	}

	const inputClass =
		"input w-full rounded-xl border border-indigo-200 bg-white/90 dark:bg-slate-900/70 " +
		"px-3 py-2 text-sm shadow-sm transition focus:-translate-y-px focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 " +
		"dark:border-slate-600 dark:focus:border-indigo-300";

	const sectionClass =
		"relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/80 " +
		"p-6 shadow-lg backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/70";

	const headerGradient =
		"absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500";

	const disabledInputClass =
		"cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 text-slate-500 " +
		"dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400";

	return (
		<div className="container mx-auto max-w-5xl space-y-8 px-4 py-12">
			<header className="rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-[1px] shadow-xl">
				<div className="flex flex-col gap-4 rounded-3xl bg-white/95 p-6 text-slate-800 dark:bg-slate-900/90 dark:text-slate-100 md:flex-row md:items-center md:justify-between">
					<div>
						<h1 className="text-2xl font-semibold">Votre profil</h1>
						<p className="text-sm text-slate-500 dark:text-slate-300">
							Gérez vos informations personnelles et sécurisez votre compte en
							quelques clics.
						</p>
					</div>
					<div className="flex items-center gap-3 rounded-2xl bg-indigo-50 px-4 py-2 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200">
						<span className="text-xs uppercase tracking-wide">Utilisateur</span>
						<span className="text-sm font-medium">
							{user?.email ?? "Utilisateur anonyme"}
						</span>
					</div>
				</div>
			</header>

			<section className={sectionClass}>
				<div className={headerGradient} />
				<div className="space-y-6">
					<div className="space-y-2">
						<h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
							Informations générales
						</h2>
						<p className="text-sm text-slate-500 dark:text-slate-300">
							Mettez à jour votre nom et le lien d'avatar partagé avec l'équipe.
						</p>
					</div>

					<form className="space-y-5" onSubmit={handleInfoSubmit}>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-1">
								<label className="text-sm font-medium text-slate-700 dark:text-slate-200">
									Nom
								</label>
								<input
									className={inputClass}
									value={name}
									onChange={(event) => setName(event.target.value)}
									placeholder="Votre nom"
									autoComplete="name"
								/>
							</div>

							<div className="space-y-1">
								<label className="text-sm font-medium text-slate-700 dark:text-slate-200">
									Email
								</label>
								<input
									className={`${inputClass} ${disabledInputClass}`}
									value={user?.email ?? ""}
									disabled
								/>
							</div>
						</div>

						<div className="space-y-1">
							<label className="text-sm font-medium text-slate-700 dark:text-slate-200">
								Avatar (URL)
							</label>
							<input
								className={inputClass}
								value={avatar}
								onChange={(event) => setAvatar(event.target.value)}
								placeholder="https://exemple.com/avatar.png"
								autoComplete="url"
							/>
						</div>

						{infoStatus && (
							<div
								className={`rounded-xl px-4 py-3 text-sm ${statusClass(
									infoStatus.type
								)}`}>
								{infoStatus.message}
							</div>
						)}

						<div className="flex justify-end">
							<button
								type="submit"
								className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
								disabled={infoLoading}>
								{infoLoading ? "Enregistrement..." : "Enregistrer"}
							</button>
						</div>
					</form>
				</div>
			</section>

			<section className={sectionClass}>
				<div className={headerGradient} />
				<div className="space-y-6">
					<div className="space-y-2">
						<h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
							Sécurité du compte
						</h2>
						<p className="text-sm text-slate-500 dark:text-slate-300">
							Choisissez un mot de passe fort pour protéger vos données.
						</p>
					</div>

					<form className="space-y-5" onSubmit={handlePasswordSubmit}>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-1">
								<label className="text-sm font-medium text-slate-700 dark:text-slate-200">
									Ancien mot de passe
								</label>
								<input
									type="password"
									className={inputClass}
									value={oldPassword}
									onChange={(event) => setOldPassword(event.target.value)}
									autoComplete="current-password"
								/>
							</div>

							<div className="space-y-1">
								<label className="text-sm font-medium text-slate-700 dark:text-slate-200">
									Nouveau mot de passe
								</label>
								<input
									type="password"
									className={inputClass}
									value={newPassword}
									onChange={(event) => setNewPassword(event.target.value)}
									autoComplete="new-password"
								/>
							</div>
						</div>

						<div className="rounded-2xl border border-indigo-100/80 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-inner dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
							<p className="font-medium text-slate-700 dark:text-slate-200">
								Votre mot de passe doit contenir au moins&nbsp;:
							</p>
							<ul className="mt-2 space-y-1 text-sm list-disc pl-5">
								<li>8 caractères minimum</li>
								<li>1 caractère spécial (&, ', -, _, ?, ., ;, /, :, !)</li>
								<li>1 chiffre minimum</li>
							</ul>
						</div>

						{pwdStatus && (
							<div
								className={`rounded-xl px-4 py-3 text-sm ${statusClass(
									pwdStatus.type
								)}`}>
								{pwdStatus.message}
							</div>
						)}

						<div className="flex justify-end">
							<button
								type="submit"
								className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-600/30 transition hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-300"
								disabled={pwdLoading}>
								{pwdLoading ? "Mise à jour..." : "Changer le mot de passe"}
							</button>
						</div>
					</form>
				</div>
			</section>
		</div>
	);
}
