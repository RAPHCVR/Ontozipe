import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
import SimpleModal from "../components/SimpleModal";
import { useOntologies, useProfile } from "../hooks/apiQueries";
import { useTranslation } from "../language/useTranslation";

type Ontology = { iri: string; label?: string };

export default function HomePage() {
    const queryClient = useQueryClient();
    const { token } = useAuth();
    const payload = token ? JSON.parse(atob(token.split(".")[1])) : {};
    const { t } = useTranslation();
    const username = payload.name || payload.email || t("common.user");

    const profileQuery = useProfile();
    const ontologiesQuery = useOntologies();

    const api = useApi();
    const [showNew, setShowNew] = useState(false);
    const [newLabel, setNewLabel] = useState("");
    const [newIri, setNewIri] = useState("");
    const [rdfFile, setRdfFile] = useState<File | null>(null);
    const navigate = useNavigate();

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setRdfFile(file);
    };

    const roles = profileQuery.data?.roles ?? [];
    const isSuperAdmin = roles.some((r) => r.endsWith("SuperAdminRole"));
    const rolesLoaded = !profileQuery.isLoading && !profileQuery.isFetching;

    const ontos = (ontologiesQuery.data ?? []) as Ontology[];

    if (ontologiesQuery.isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                {t("common.loading")}
            </div>
        );
    }

    if (ontologiesQuery.isError) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-sm text-red-500">
                    {t("home.loadError")}
                </div>
            </div>
        );
    }

    return (
        <>
            {/* bannière / header plein écran */}
            <section className="w-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 dark:from-slate-800 dark:to-slate-700 text-white mb-8">
                <div className="max-w-7xl mx-auto py-12 px-6">
                    <h1 className="text-3xl md:text-4xl font-bold">
                        {t("home.greeting", { name: username })}
                    </h1>
                    <p className="mt-2 opacity-90">
                        {t("home.subtitle")}
                    </p>

                    {rolesLoaded && isSuperAdmin && (
                        <button
                            className="btn-primary mt-6"
                            onClick={() => setShowNew(true)}>
                            {t("home.actions.newOntology")}
                        </button>
                    )}
                </div>
            </section>

            {/* ... le reste du JSX reste identique ... */}
            <div className="max-w-7xl mx-auto px-6 mb-16">
                <div className="overflow-x-auto rounded-lg shadow ring-1 ring-black/5">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                        <thead className="bg-gray-50 dark:bg-slate-800/60">
                        <tr className="text-xs font-semibold uppercase tracking-wider text-left">
                            <th className="px-4 py-3">{t("home.table.ontology")}</th>
                            <th className="px-4 py-3 w-32 text-center">{t("home.table.actions")}</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y dark:divide-slate-700">
                        {ontos.map((o) => (
                            <tr
                                key={o.iri}
                                className="hover:bg-gray-50 dark:hover:bg-slate-700/60">
                                <td className="px-4 py-3 whitespace-nowrap">
                                    {o.label || o.iri.split(/[#/]/).pop() || o.iri}
                                </td>
                                <td className="px-4 py-2 text-center space-x-2">
                                    <Link
                                        to={`/ontology?iri=${encodeURIComponent(o.iri)}`}
                                        className="btn-primary !py-0.5 !px-2 text-xs"
                                        title={t("home.table.openToolTip")}>
                                        {t("home.table.open")}
                                    </Link>
                                    <button
                                        onClick={() => alert(t("home.configure.todo"))}
                                        title={t("home.table.configure")}
                                        className="btn-secondary !py-0.5 !px-2 text-xs">
                                        ⚙
                                    </button>
                                    <button
                                        onClick={() =>
                                            navigate(
                                                `/groups?ontology=${encodeURIComponent(o.iri)}`
                                            )
                                        }
                                        title={t("home.table.groups")}
                                        className="btn-secondary !py-0.5 !px-2 text-xs">
                                        👥
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {ontos.length === 0 && (
                            <tr>
                                <td
                                    colSpan={2}
                                    className="px-4 py-8 text-center text-sm text-gray-500">
                                    {t("home.table.empty")}
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showNew && isSuperAdmin && (
                <SimpleModal
                    title={t("home.modal.title")}
                    onClose={() => {
                        setShowNew(false);
                        setNewLabel("");
                        setNewIri("");
                        setRdfFile(null);
                    }}
                    onSubmit={() => {
                        const fd = new FormData();
                        fd.append("iri", newIri.trim());
                        fd.append("label", newLabel.trim());
                        if (rdfFile) fd.append("file", rdfFile);

                        api("/ontologies", {
                            method: "POST",
                            body: fd,
                        })
                            .then(async () => {
                                await queryClient.invalidateQueries({ queryKey: ["ontologies"] });
                            })
                            .finally(() => {
                                setShowNew(false);
                                setNewLabel("");
                                setNewIri("");
                                setRdfFile(null);
                            });
                    }}
                    disableSubmit={!newLabel.trim() || !newIri.trim()}>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                {t("common.label")}
                            </label>
                            <input
                                className="input"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                placeholder={t("home.modal.labelPlaceholder")}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                {t("home.modal.iri")}
                            </label>
                            <input
                                className="input"
                                value={newIri}
                                onChange={(e) => setNewIri(e.target.value)}
                                placeholder={t("home.modal.iriPlaceholder")}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {t("home.modal.iriHint")}
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                {t("home.modal.fileLabel")}
                            </label>
                            <input
                                type="file"
                                accept=".ttl,.rdf,.owl,.nt,.nq,.trig,.jsonld"
                                onChange={handleFile}
                                className="block w-full text-sm text-gray-700 dark:text-gray-200"
                            />
                            {rdfFile && (
                                <p className="text-xs text-green-600 mt-1">
                                    {t("home.modal.fileSelected", {
                                        file: rdfFile.name,
                                        size: (rdfFile.size / 1024).toFixed(1),
                                    })}
                                </p>
                            )}
                        </div>
                    </div>
                </SimpleModal>
            )}
        </>
    );
}
