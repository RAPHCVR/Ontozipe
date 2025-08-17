import { JSX } from "react";
import "vis-network/styles/vis-network.css";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/fr";
dayjs.extend(relativeTime);
dayjs.locale("fr");
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Layout from "./components/layout/layout";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import GroupsPage from "./pages/GroupsPage";
import OrganisationsPage from "./pages/OrganisationsPage";
import OntologyPage from "./pages/OntologyPage";
import AssistantPage from "./pages/AssistantPage";

// ---------------------------------------------------------------------------
// --- RequireAuth component ---
const RequireAuth: React.FC<{ children: JSX.Element }> = ({ children }) => {
    const { token } = useAuth();
    const loc = useLocation();
    if (!token) return <Navigate to="/login" state={{ from: loc }} replace />;
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
                        path="/"
                        element={
                            <RequireAuth>
                                <Layout>
                                    <HomePage />
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
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}