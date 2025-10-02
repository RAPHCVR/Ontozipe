import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { HiOutlineMenu, HiX } from "react-icons/hi";
import { useAuth } from "../../auth/AuthContext";
import { useProfile } from "../../hooks/apiQueries";

export default function Navbar() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const profileQuery = useProfile();

    const roles = profileQuery.data?.roles ?? [];
    const email = profileQuery.data?.email?.toLowerCase();
    const isSuperAdmin =
        roles.some((role) => role.endsWith("SuperAdminRole")) || email === "superadmin@admin.com";
    const navItem = "block px-4 py-2 hover:bg-indigo-500/30 rounded transition-colors cursor-pointer select-none";

    const menuClasses = [
        "fixed md:static top-14 inset-x-0 md:flex md:gap-6 bg-indigo-600/95 dark:bg-slate-800/95",
        "backdrop-blur-lg md:backdrop-blur-0 md:bg-transparent transition-transform",
        open ? "translate-y-0" : "-translate-y-full md:translate-y-0",
    ].join(" ");

    const logoutClasses = [navItem, "md:border md:border-white/40"].join(" ");

    const closeMenu = () => setOpen(false);

    return (
        <nav className="sticky top-0 z-40 bg-indigo-600 dark:bg-slate-800 text-white shadow-md">
            <div className="max-w-7xl mx-auto h-14 px-4 flex items-center justify-between">
                <Link to="/" className="font-bold tracking-wide text-lg">
                    Onto<span className="text-yellow-300">ZIPE</span>
                </Link>

                <button
                    onClick={() => setOpen(!open)}
                    className="md:hidden text-2xl focus:outline-none"
                >
                    {open ? <HiX /> : <HiOutlineMenu />}
                </button>

                <ul className={menuClasses}>
                    <li onClick={closeMenu}>
                        <Link to="/" className={navItem}>
                            Accueil
                        </Link>
                    </li>
                    <li onClick={closeMenu}>
                        <Link to="/assistant" className={navItem}>
                            Assistant
                        </Link>
                    </li>
                    <li onClick={closeMenu}>
                        <Link to="/groups" className={navItem}>
                            Groupes
                        </Link>
                    </li>
                    <li onClick={closeMenu}>
                        <Link to="/organisations" className={navItem}>
                            Organisations
                        </Link>
                    </li>
                    <li onClick={closeMenu}>
                        <Link to="/profile" className={navItem}>
                            Profil
                        </Link>
                    </li>

                    {isSuperAdmin && (
                        <li onClick={closeMenu}>
                            <Link to="/admin/users" className={navItem}>
                                Utilisateurs
                            </Link>
                        </li>
                    )}

                    <li className="md:hidden border-t border-white/20 my-2" />

                    <li>
                        <button
                            type="button"
                            className={`${logoutClasses} w-full text-left`}
                            onClick={() => {
                                closeMenu();
                                logout();
                                navigate("/login");
                            }}
                        >
                            Deconnexion
                        </button>
                    </li>
                </ul>
            </div>
        </nav>
    );
}



