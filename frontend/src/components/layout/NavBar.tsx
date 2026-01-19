import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
	HiOutlineMenu,
	HiOutlineMoon,
	HiOutlineSparkles,
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
import {
	useNotificationsPreview,
	useUnreadCount,
	type NotificationItem,
} from "../../hooks/useNotifications";

type ThemeMode = "light" | "dark";

const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
	fr: "\u{1F1EB}\u{1F1F7}",
	en: "\u{1F1EC}\u{1F1E7}",
	es: "\u{1F1EA}\u{1F1F8}",
};

export default function Navbar() {
	const { logout } = useAuth();
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const { language, setLanguage } = useLanguage();
	const profileQuery = useProfile();
	const notificationsPreview = useNotificationsPreview(5);
	const unreadQuery = useUnreadCount("personal");
	const [showNotifications, setShowNotifications] = useState(false);
	const notifRef = useRef<HTMLLIElement | null>(null);

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
			"(prefers-color-scheme: dark)",
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
		return SUPPORTED_LANGUAGES.reduce(
			(acc, code) => {
				const key = `language.option.${code}` as const;
				return { ...acc, [code]: t(key) };
			},
			{} as Record<SupportedLanguage, string>,
		);
	}, [t]);
	const languageOptions = useMemo(
		() =>
			SUPPORTED_LANGUAGES.map((code) => ({
				code,
				label: languageLabels[code],
				flag: LANGUAGE_FLAGS[code] ?? "\u{1F3F3}\u{FE0F}",
			})),
		[languageLabels],
	);

	const unreadCount = unreadQuery.data?.unreadCount ?? 0;
	const badgeValue =
		unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : "";

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (!showNotifications) return;
			const target = event.target as Node;
			if (notifRef.current && !notifRef.current.contains(target)) {
				setShowNotifications(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [showNotifications]);

	return (
		<nav className="navbar">
			<div className="app-container navbar__inner">
				<Link to="/" className="navbar__brand" onClick={closeMenu}>
					<span className="navbar__logo" aria-hidden="true">
						<i className="fas fa-cubes" />
					</span>
					<span className="navbar__title">OntoZIPE</span>
				</Link>

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
							<span className="navbar__link-text">{t("navbar.assistant")}</span>
							<HiOutlineSparkles
								className="navbar__link-icon"
								aria-hidden="true"
							/>
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
						<Link to="/guide" className="navbar__link" onClick={closeMenu}>
							{t("navbar.guide")}
						</Link>
					</li>
					<li className="navbar__item">
						<Link to="/profile" className="navbar__link" onClick={closeMenu}>
							{t("navbar.profile")}
						</Link>
					</li>
					<li className="navbar__divider" aria-hidden="true" />
					<li className="navbar__spacer" aria-hidden="true" />
					<li
						className="navbar__item navbar__item--icon relative"
						ref={notifRef}
						onMouseEnter={() => setShowNotifications(true)}>
						<Link
							to="/notifications"
							title={t("navbar.notifications")}
							aria-label={t("navbar.notifications")}
							className="navbar__link navbar__link--icon relative"
							onClick={() => {
								closeMenu();
								setShowNotifications(false);
							}}>
							<i className="fas fa-bell" aria-hidden="true" />
							{badgeValue && (
								<span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold shadow-sm">
									{badgeValue}
								</span>
							)}
						</Link>
						{showNotifications && (
							<NotificationPreviewPopover
								loading={notificationsPreview.isLoading}
								items={notificationsPreview.data?.items ?? []}
								onNavigate={(url) => {
									setShowNotifications(false);
									setOpen(false);
									navigate(url);
								}}
								onKeepOpen={() => setShowNotifications(true)}
							/>
						)}
					</li>
					<li className="navbar__item navbar__item--icon">
						<div
							className="navbar__flags"
							role="group"
							aria-label={t("common.language")}>
							{languageOptions.map((option) => (
								<button
									key={option.code}
									type="button"
									title={option.label}
									aria-label={option.label}
									aria-pressed={language === option.code}
									className={`navbar__flag ${
										language === option.code ? "is-active" : ""
									}`}
									onClick={() => {
										setLanguage(option.code);
										closeMenu();
									}}>
									<span aria-hidden="true">{option.flag}</span>
								</button>
							))}
						</div>
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

function NotificationPreviewPopover({
	loading,
	items,
	onNavigate,
	onKeepOpen,
}: {
	loading: boolean;
	items: NotificationItem[];
	onNavigate: (url: string) => void;
	onKeepOpen: () => void;
}) {
	const { t } = useTranslation();
	const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
		typeof document !== "undefined"
			? document.documentElement.classList.contains("dark") ||
				document.documentElement.dataset.theme === "dark"
			: false,
	);

	useEffect(() => {
		if (typeof document === "undefined") return;
		const detect = () =>
			document.documentElement.classList.contains("dark") ||
			document.documentElement.dataset.theme === "dark";
		const observer = new MutationObserver(() => setIsDarkMode(detect()));
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "data-theme"],
		});
		return () => observer.disconnect();
	}, []);

	const containerStyle = isDarkMode
		? {
				backgroundColor: "#111827",
				color: "#e5e7eb",
				borderColor: "#1f2937",
			}
		: {
				backgroundColor: "#ffffff",
				color: "#0f172a",
				borderColor: "#e5e7eb",
			};
	const dividerStyle = {
		borderBottom: `1px solid ${isDarkMode ? "#1f2937" : "#e5e7eb"}`,
	};
	const hoverColor = isDarkMode ? "#1f2937" : "#eef2ff";

	return (
		<div
			style={containerStyle}
			className="absolute right-0 mt-2 w-80 rounded-lg shadow-lg ring-1 ring-black/5 z-20 border"
			onMouseEnter={onKeepOpen}>
			<div
				className="px-4 py-3 flex items-center justify-between"
				style={dividerStyle}>
				<span className="font-semibold text-sm">
					{t("notifications.preview.title")}
				</span>
				<Link
					to="/notifications"
					className={
						isDarkMode
							? "text-indigo-300 hover:text-indigo-200 text-sm"
							: "text-indigo-600 hover:text-indigo-800 text-sm"
					}
					onClick={(e) => {
						e.stopPropagation();
						onNavigate("/notifications");
					}}>
					{t("notifications.preview.viewAll")}
				</Link>
			</div>
			<div className="max-h-96 overflow-y-auto">
				{loading && (
					<div
						className="px-4 py-3 text-sm"
						style={{ color: isDarkMode ? "#9ca3af" : "#6b7280" }}>
						{t("notifications.loading")}
					</div>
				)}
				{!loading && items.length === 0 && (
					<div
						className="px-4 py-3 text-sm"
						style={{ color: isDarkMode ? "#9ca3af" : "#6b7280" }}>
						{t("notifications.empty")}
					</div>
				)}
				{items.slice(0, 5).map((item) => (
					<button
						key={item.iri}
						type="button"
						className="w-full text-left px-4 py-3 flex gap-3"
						style={{ backgroundColor: "transparent" }}
						onClick={(e) => {
							e.stopPropagation();
							onNavigate(item.link || "/notifications");
						}}
						onMouseEnter={(e) => {
							(e.currentTarget as HTMLButtonElement).style.backgroundColor =
								hoverColor;
						}}
						onMouseLeave={(e) => {
							(e.currentTarget as HTMLButtonElement).style.backgroundColor =
								"transparent";
						}}>
						<span
							className={`w-2 h-2 rounded-full mt-1 ${
								item.isRead ? "bg-gray-300" : "bg-indigo-500"
							}`}
							aria-hidden="true"
						/>
						<div className="flex-1 space-y-1">
							<p
								className="text-sm line-clamp-2"
								style={{ color: isDarkMode ? "#e5e7eb" : "#1f2937" }}>
								{item.content}
							</p>
							<span
								className="text-xs"
								style={{ color: isDarkMode ? "#9ca3af" : "#6b7280" }}>
								{dayjs(item.createdAt).fromNow()}
							</span>
						</div>
					</button>
				))}
			</div>
		</div>
	);
}
