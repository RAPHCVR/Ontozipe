import { JSX } from "react";
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

type GuardProps = { children: JSX.Element };

const LoadingScreen = () => (
    <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        Chargement...
    </div>
);

const RequireAuth = ({ children }: GuardProps) => {
    const { token } = useAuth();
    const loc = useLocation();
    if (!token) return <Navigate to="/login" state={{ from: loc }} replace />;
    return children;
};

const RequireSuperAdmin = ({ children }: GuardProps) => {
    const { token } = useAuth();
    const loc = useLocation();
    const profileQuery = useProfile({ enabled: Boolean(token) });

    if (!token) return <Navigate to="/login" state={{ from: loc }} replace />;
    if (profileQuery.isLoading || profileQuery.isFetching) {
        return <LoadingScreen />;
    }

    const email = profileQuery.data?.email?.toLowerCase();
    const roles = profileQuery.data?.roles ?? [];
    const isSuperAdminAccount =
        roles.some((role) => role.endsWith("SuperAdminRole")) || email === "superadmin@admin.com";

    if (!isSuperAdminAccount) return <Navigate to="/" replace />;
    return children;
};

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    <Route
                        path="/assistant"
                        element={
                            <RequireAuth>
                                <Layout>
                                    <AssistantPage />
                                </Layout>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/groups"
                        element={
                            <RequireAuth>
                                <Layout>
                                    <GroupsPage />
                                </Layout>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/organisations"
                        element={
                            <RequireAuth>
                                <Layout>
                                    <OrganisationsPage />
                                </Layout>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/ontology"
                        element={
                            <RequireAuth>
                                <Layout>
                                    <OntologyPage />
                                </Layout>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/profile"
                        element={
                            <RequireAuth>
                                <Layout>
                                    <ProfilePage />
                                </Layout>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/admin/users"
                        element={
                            <RequireAuth>
                                <RequireSuperAdmin>
                                    <Layout>
                                        <AdminUsersPage />
                                    </Layout>
                                </RequireSuperAdmin>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/"
                        element={
                            <RequireAuth>
                                <Layout>
                                    <HomePage />
                                </Layout>
                            </RequireAuth>
                        }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
