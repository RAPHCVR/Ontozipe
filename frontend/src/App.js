import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import "vis-network/styles/vis-network.css";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/fr";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { useProfile } from "./hooks/apiQueries";
import Layout from "./components/layout/layout";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import GroupsPage from "./pages/GroupsPage";
import OrganisationsPage from "./pages/OrganisationsPage";
import OntologyPage from "./pages/OntologyPage";
import AssistantPage from "./pages/AssistantPage";
import ProfilePage from "./pages/ProfilePage";
import AdminUsersPage from "./pages/AdminUsersPage";
dayjs.extend(relativeTime);
dayjs.locale("fr");
const LoadingScreen = () => (_jsx("div", { className: "flex h-screen items-center justify-center text-sm text-slate-500", children: "Chargement..." }));
const RequireAuth = ({ children }) => {
    const { token } = useAuth();
    const loc = useLocation();
    if (!token)
        return _jsx(Navigate, { to: "/login", state: { from: loc }, replace: true });
    return children;
};
const RequireSuperAdmin = ({ children }) => {
    const { token } = useAuth();
    const loc = useLocation();
    const profileQuery = useProfile({ enabled: Boolean(token) });
    if (!token)
        return _jsx(Navigate, { to: "/login", state: { from: loc }, replace: true });
    if (profileQuery.isLoading || profileQuery.isFetching) {
        return _jsx(LoadingScreen, {});
    }
    const email = profileQuery.data?.email?.toLowerCase();
    const roles = profileQuery.data?.roles ?? [];
    const isSuperAdminAccount = roles.some((role) => role.endsWith("SuperAdminRole")) || email === "superadmin@admin.com";
    if (!isSuperAdminAccount)
        return _jsx(Navigate, { to: "/", replace: true });
    return children;
};
export default function App() {
    return (_jsx(AuthProvider, { children: _jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/register", element: _jsx(RegisterPage, {}) }), _jsx(Route, { path: "/assistant", element: _jsx(RequireAuth, { children: _jsx(Layout, { children: _jsx(AssistantPage, {}) }) }) }), _jsx(Route, { path: "/groups", element: _jsx(RequireAuth, { children: _jsx(Layout, { children: _jsx(GroupsPage, {}) }) }) }), _jsx(Route, { path: "/organisations", element: _jsx(RequireAuth, { children: _jsx(Layout, { children: _jsx(OrganisationsPage, {}) }) }) }), _jsx(Route, { path: "/ontology", element: _jsx(RequireAuth, { children: _jsx(Layout, { children: _jsx(OntologyPage, {}) }) }) }), _jsx(Route, { path: "/profile", element: _jsx(RequireAuth, { children: _jsx(Layout, { children: _jsx(ProfilePage, {}) }) }) }), _jsx(Route, { path: "/admin/users", element: _jsx(RequireAuth, { children: _jsx(RequireSuperAdmin, { children: _jsx(Layout, { children: _jsx(AdminUsersPage, {}) }) }) }) }), _jsx(Route, { path: "/", element: _jsx(RequireAuth, { children: _jsx(Layout, { children: _jsx(HomePage, {}) }) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }) }));
}
