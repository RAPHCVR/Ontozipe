import { Link, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { HiOutlineMenu, HiX } from "react-icons/hi";
import { useAuth } from "../../auth/AuthContext";
import { SUPPORTED_LANGUAGES, useLanguage } from "../../language/LanguageContext";
import type { SupportedLanguage } from "../../language/LanguageContext";
import { useTranslation } from "../../language/useTranslation";

export default function Navbar() {
    const { logout } = useAuth();
    const { language, setLanguage } = useLanguage();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const navItem =
        "block px-4 py-2 hover:bg-indigo-500/30 rounded transition-colors";

    const languageLabels = useMemo(
        () =>
            SUPPORTED_LANGUAGES.reduce(
                (acc, code) => ({
                    ...acc,
                    [code]:
                        code === "fr"
                            ? t("language.option.fr")
                            : code === "en"
                                ? t("language.option.en")
                                : t("language.option.es"),
                }),
                {} as Record<SupportedLanguage, string>
            ),
        [t]
    );

    return (
        <nav className="sticky top-0 z-40 bg-indigo-600 dark:bg-slate-800 text-white shadow-md">
            <div className="max-w-7xl mx-auto h-14 px-4 flex items-center justify-between">
                <Link to="/" className="font-bold tracking-wide text-lg">
                    Onto<span className="text-yellow-300">ZIPE</span>
                </Link>

                <div className="hidden md:flex items-center gap-2 text-sm">
                    <label htmlFor="language-select" className="text-white/80">
                        {t("common.language")}
                    </label>
                    <select
                        id="language-select"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="bg-indigo-500/30 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                        {SUPPORTED_LANGUAGES.map((code) => (
                            <option key={code} value={code}>
                                {languageLabels[code]}
                            </option>
                        ))}
                    </select>
                </div>


                {/* burger mobile */}
                <button
                    onClick={() => setOpen(!open)}
                    className="md:hidden text-2xl focus:outline-none"
                >
                    {open ? <HiX /> : <HiOutlineMenu />}
                </button>

                {/* menu */}
                <ul
                    className={`fixed md:static top-14 inset-x-0 md:flex md:gap-6 bg-indigo-600/95 dark:bg-slate-800/95 backdrop-blur-lg md:backdrop-blur-0 md:bg-transparent transition-transform ${
                        open ? "translate-y-0" : "-translate-y-full md:translate-y-0"
                    }`}
                >
                    <li onClick={() => setOpen(false)}>
                        <Link to="/" className={navItem}>
                            {t("navbar.home")}
                        </Link>
                    </li>

                    <li onClick={() => setOpen(false)}>
                        <Link to="/assistant" className={navItem}>
                            {t("navbar.assistant")}
                        </Link>
                    </li>

                    <li onClick={() => setOpen(false)}>
                        <Link to="/groups" className={navItem}>
                            {t("navbar.groups")}
                        </Link>
                    </li>

                    <li onClick={() => setOpen(false)}>
                        <Link to="/organisations" className={navItem}>
                            {t("navbar.organisations")}
                        </Link>
                    </li>

                    <li onClick={() => setOpen(false)}>
                        <Link to="/profile" className={navItem}>
                            {t("navbar.profile")}
                        </Link>
                    </li>

                    <li className="md:hidden border-t border-white/20 my-2" />

                    <li className="md:hidden px-4 py-2">
                        <label htmlFor="language-select-mobile" className="block text-xs text-white/70 mb-1">
                            {t("common.language")}
                        </label>
                        <select
                            id="language-select-mobile"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full bg-indigo-500/40 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/50"
                        >
                            {SUPPORTED_LANGUAGES.map((code) => (
                                <option key={code} value={code}>
                                    {languageLabels[code]}
                                </option>
                            ))}
                        </select>
                    </li>

                    <li
                        onClick={() => {
                            logout();
                            navigate("/login");
                        }}
                    >
            <span className={`${navItem} md:border md:border-white/40`}>
              {t("common.logout")}
            </span>
                    </li>
                </ul>
            </div>
        </nav>
    );
}
