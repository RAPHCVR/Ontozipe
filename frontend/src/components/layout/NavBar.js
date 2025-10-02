import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    const isSuperAdmin = roles.some((role) => role.endsWith("SuperAdminRole")) || email === "superadmin@admin.com";
    const navItem = "block px-4 py-2 hover:bg-indigo-500/30 rounded transition-colors cursor-pointer select-none";
    const menuClasses = [
        "fixed md:static top-14 inset-x-0 md:flex md:gap-6 bg-indigo-600/95 dark:bg-slate-800/95",
        "backdrop-blur-lg md:backdrop-blur-0 md:bg-transparent transition-transform",
        open ? "translate-y-0" : "-translate-y-full md:translate-y-0",
    ].join(" ");
    const logoutClasses = [navItem, "md:border md:border-white/40"].join(" ");
    const closeMenu = () => setOpen(false);
    return (_jsx("nav", { className: "sticky top-0 z-40 bg-indigo-600 dark:bg-slate-800 text-white shadow-md", children: _jsxs("div", { className: "max-w-7xl mx-auto h-14 px-4 flex items-center justify-between", children: [_jsxs(Link, { to: "/", className: "font-bold tracking-wide text-lg", children: ["Onto", _jsx("span", { className: "text-yellow-300", children: "ZIPE" })] }), _jsx("button", { onClick: () => setOpen(!open), className: "md:hidden text-2xl focus:outline-none", children: open ? _jsx(HiX, {}) : _jsx(HiOutlineMenu, {}) }), _jsxs("ul", { className: menuClasses, children: [_jsx("li", { onClick: closeMenu, children: _jsx(Link, { to: "/", className: navItem, children: "Accueil" }) }), _jsx("li", { onClick: closeMenu, children: _jsx(Link, { to: "/assistant", className: navItem, children: "Assistant" }) }), _jsx("li", { onClick: closeMenu, children: _jsx(Link, { to: "/groups", className: navItem, children: "Groupes" }) }), _jsx("li", { onClick: closeMenu, children: _jsx(Link, { to: "/organisations", className: navItem, children: "Organisations" }) }), _jsx("li", { onClick: closeMenu, children: _jsx(Link, { to: "/profile", className: navItem, children: "Profil" }) }), isSuperAdmin && (_jsx("li", { onClick: closeMenu, children: _jsx(Link, { to: "/admin/users", className: navItem, children: "Utilisateurs" }) })), _jsx("li", { className: "md:hidden border-t border-white/20 my-2" }), _jsx("li", { children: _jsx("button", { type: "button", className: `${logoutClasses} w-full text-left`, onClick: () => { closeMenu(); logout(); navigate("/login"); }, children: "Deconnexion" }) })] })] }) }));
}


