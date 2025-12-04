import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
	HiOutlineMenu,
	HiOutlineMoon,
	HiOutlineSun,
	HiX,
} from "react-icons/hi";
import { useAuth } from "../../auth/AuthContext";
import { useTranslation } from "../../language/useTranslation";
import {
	SUPPORTED_LANGUAGES,
	useLanguage,
} from "../../language/LanguageContext";
import type { SupportedLanguage } from "../../language/LanguageContext";
import { useProfile } from "../../hooks/apiQueries";

type ThemeMode = "light" | "dark";

export default function Navbar() {
	const { logout } = useAuth();
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const { language, setLanguage } = useLanguage();
	const profileQuery = useProfile();

	const roles = profileQuery.data?.roles ?? [];
	const isSuperAdmin = roles.some((role) => role.endsWith("SuperAdminRole"));
	const [theme, setTheme] = useState<ThemeMode>(() => {
		if (typeof window === "undefined") return "light";

		const root = window.document.documentElement;
		const stored = window.localStorage.getItem("theme");
		if (stored === "dark" || stored === "light") {
			root.classList.toggle("dark", stored === "dark");
			root.dataset.theme = stored;
			return stored;
		}

		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)"
		).matches;
		const resolved = prefersDark ? "dark" : "light";
		root.classList.toggle("dark", prefersDark);
		root.dataset.theme = resolved;
		return resolved;
	});
	const [hasExplicitPreference, setHasExplicitPreference] = useState(() => {
		if (typeof window === "undefined") return false;
		const stored = window.localStorage.getItem("theme");
		return stored === "dark" || stored === "light";
	});
	const isDark = theme === "dark";

	useEffect(() => {
		if (typeof window === "undefined") return;
		const root = window.document.documentElement;
		root.classList.toggle("dark", isDark);
		root.dataset.theme = isDark ? "dark" : "light";
	}, [isDark]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!hasExplicitPreference) return;
		window.localStorage.setItem("theme", theme);
	}, [theme, hasExplicitPreference]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (hasExplicitPreference) return;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = (event: MediaQueryListEvent) => {
			setTheme(event.matches ? "dark" : "light");
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [hasExplicitPreference]);

	const handleToggleTheme = () => {
		setTheme((prev) => (prev === "dark" ? "light" : "dark"));
		setHasExplicitPreference(true);
		setOpen(false);
	};

	const closeMenu = () => setOpen(false);

	const languageLabels = useMemo(() => {
		return SUPPORTED_LANGUAGES.reduce((acc, code) => {
			const key = `language.option.${code}` as const;
			return { ...acc, [code]: t(key) };
		}, {} as Record<SupportedLanguage, string>);
	}, [t]);

	return (
		<nav className="navbar">
			<div className="app-container navbar__inner">
				<Link to="/" className="navbar__brand" onClick={closeMenu}>
					<span className="navbar__logo" aria-hidden="true">
						<i className="fas fa-cubes" />
					</span>
					<span className="navbar__title">OntoZIPE</span>
				</Link>

				<div className="hidden md:flex items-center gap-2 text-sm">
					<label htmlFor="language-select" className="text-white/80">
						{t("common.language")}
					</label>
					<select
						id="language-select"
						value={language}
						onChange={(event) => setLanguage(event.target.value)}
						className="bg-indigo-500/30 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/50">
						{SUPPORTED_LANGUAGES.map((code) => (
							<option key={code} value={code}>
								{languageLabels[code]}
							</option>
						))}
					</select>
				</div>

				<div className="navbar__actions">
					<button
						type="button"
						className="navbar__toggle"
						aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
						aria-expanded={open}
						onClick={() => setOpen((prev) => !prev)}>
						{open ? <HiX /> : <HiOutlineMenu />}
					</button>
				</div>

				<ul className={`navbar__menu ${open ? "is-open" : ""}`}>
					<li className="navbar__item">
						<Link to="/" className="navbar__link" onClick={closeMenu}>
							{t("navbar.home")}
						</Link>
					</li>
					<li className="navbar__item">
						<Link to="/dashboard" className="navbar__link" onClick={closeMenu}>
							{t("navbar.dashboard")}
						</Link>
					</li>
					<li className="navbar__item">
						<Link to="/assistant" className="navbar__link" onClick={closeMenu}>
							{t("navbar.assistant")}
						</Link>
					</li>
					<li className="navbar__item">
						<Link to="/groups" className="navbar__link" onClick={closeMenu}>
							{t("navbar.groups")}
						</Link>
					</li>
					<li className="navbar__item">
						<Link
							to="/organisations"
							className="navbar__link"
							onClick={closeMenu}>
							{t("navbar.organisations")}
						</Link>
					</li>
					{isSuperAdmin && (
						<li className="navbar__item">
							<Link
								to="/admin/users"
								className="navbar__link"
								onClick={closeMenu}>
								Users
							</Link>
						</li>
					)}

					<li className="navbar__item">
						<Link to="/profile" className="navbar__link" onClick={closeMenu}>
							{t("navbar.profile")}
						</Link>
					</li>
					<li className="md:hidden px-4 py-2">
						<label
							htmlFor="language-select-mobile"
							className="block text-xs text-white/70 mb-1">
							{t("common.language")}
						</label>
						<select
							id="language-select-mobile"
							value={language}
							onChange={(event) => {
								setLanguage(event.target.value);
								closeMenu();
							}}
							className="w-full bg-indigo-500/40 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/50">
							{SUPPORTED_LANGUAGES.map((code) => (
								<option key={code} value={code}>
									{languageLabels[code]}
								</option>
							))}
						</select>
					</li>
					<li className="navbar__item">
						<button
							type="button"
							onClick={handleToggleTheme}
							className="navbar__link navbar__theme"
							aria-label={
								isDark ? "Activer le mode clair" : "Activer le mode sombre"
							}>
							<span className="navbar__theme-label">
								{isDark ? "Mode clair" : "Mode sombre"}
							</span>
							{isDark ? (
								<HiOutlineSun className="navbar__theme-icon" />
							) : (
								<HiOutlineMoon className="navbar__theme-icon" />
							)}
						</button>
					</li>
					<li className="navbar__divider" aria-hidden="true" />
					<li className="navbar__item">
						<button
							type="button"
							className="navbar__link navbar__logout"
							onClick={() => {
								logout();
								navigate("/login");
								setOpen(false);
							}}>
							<span>{t("common.logout")}</span>
							<i className="fas fa-sign-out-alt" aria-hidden="true" />
						</button>
					</li>
				</ul>
			</div>
		</nav>
	);
}
