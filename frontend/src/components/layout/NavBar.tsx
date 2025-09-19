import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { HiOutlineMenu, HiX } from "react-icons/hi";
import { useAuth } from "../../auth/AuthContext";

export default function Navbar() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const navItem =
        "block px-4 py-2 hover:bg-indigo-500/30 rounded transition-colors";

    return (
        <nav className="sticky top-0 z-40 bg-indigo-600 dark:bg-slate-800 text-white shadow-md">
            <div className="max-w-7xl mx-auto h-14 px-4 flex items-center justify-between">
                <Link to="/" className="font-bold tracking-wide text-lg">
                    Onto<span className="text-yellow-300">ZIPE</span>
                </Link>

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
                            Accueil
                        </Link>
                    </li>

                    <li onClick={() => setOpen(false)}>
                        <Link to="/assistant" className={navItem}>
                            Assistant
                        </Link>
                    </li>

                    <li onClick={() => setOpen(false)}>
                        <Link to="/groups" className={navItem}>
                            Groupes
                        </Link>
                    </li>

                    <li onClick={() => setOpen(false)}>
                        <Link to="/organisations" className={navItem}>
                            Organisations
                        </Link>
                    </li>

                    <li onClick={() => setOpen(false)}>
                        <Link to="/profile" className={navItem}>
                            Profil
                        </Link>
                    </li>

                    <li className="md:hidden border-t border-white/20 my-2" />

                    <li
                        onClick={() => {
                            logout();
                            navigate("/login");
                        }}
                    >
            <span className={`${navItem} md:border md:border-white/40`}>
              Déconnexion
            </span>
                    </li>
                </ul>
            </div>
        </nav>
    );
}
