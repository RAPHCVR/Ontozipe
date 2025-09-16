import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
import SimpleModal from "../components/SimpleModal";

type Ontology = { iri: string; label?: string };

export default function HomePage() {
	const { token } = useAuth();
	const payload = token ? JSON.parse(atob(token.split(".")[1])) : {};
	const username = payload.name || payload.email || "Utilisateur";
	const currentUserIri: string | undefined = payload.sub;
	const [isSuperAdmin, setIsSuperAdmin] = useState(false);
	const [rolesLoaded, setRolesLoaded] = useState(false);
	const api = useApi();
	const [showNew, setShowNew] = useState(false);
	const [newLabel, setNewLabel] = useState("");
	const [newIri, setNewIri] = useState("");
	const [rdfFile, setRdfFile] = useState<File | null>(null);
	const [ontos, setOntos] = useState<Ontology[]>([]);
	const [loading, setLoading] = useState(true);
	const navigate = useNavigate();

	const load = () => {
		setLoading(true);
		return api("/ontology/projects")
			.then((r) => r.json())
			.then(setOntos)
			.catch((err) => {
				console.error(err);
				alert("Impossible de récupérer les ontologies");
			})
			.finally(() => setLoading(false));
	};

	const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] || null;
		setRdfFile(file);
	};

	useEffect(() => {
		load();
	}, []);

	useEffect(() => {
		if (!currentUserIri) {
			setRolesLoaded(true);
			return;
		}
		(async () => {
			try {
				const res = await api(
					`/ontology/persons/${encodeURIComponent(currentUserIri)}`
				);

				if (!res.ok || res.status === 204) {
					// Pas de contenu ou erreur
					throw new Error(`Cannot fetch person (${res.status})`);
				}

				const text = await res.text();
				if (!text) {
					throw new Error("Empty response from /persons/:iri");
				}

				let me: any;
				try {
					me = JSON.parse(text);
				} catch {
					console.warn("Person endpoint did not return valid JSON");
					throw new Error("Invalid JSON");
				}

				console.debug("Fetched person:", me);

				const roles: string[] =
					me?.roles ??
					me?.properties
						?.filter((p: any) => p.predicate?.endsWith("#hasRole"))
						.map((p: any) => p.value) ??
					[];

				setIsSuperAdmin(roles.some((r) => r.endsWith("SuperAdminRole")));
			} catch (err) {
				console.error("Role fetch failed", err);
			} finally {
				setRolesLoaded(true);
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUserIri]);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-screen">
				Chargement…
			</div>
		);
	}

	return (
		<>
			{/* bannière / header plein écran */}
			<section className="w-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 dark:from-slate-800 dark:to-slate-700 text-white mb-8">
				<div className="max-w-7xl mx-auto py-12 px-6">
					<h1 className="text-3xl md:text-4xl font-bold">
						Bonjour, <span className="text-yellow-300">{username}</span> !
					</h1>
					<p className="mt-2 opacity-90">
						Sélectionnez une ontologie ou créez-en une nouvelle.
					</p>

					{rolesLoaded && isSuperAdmin && (
						<button
							className="btn-primary mt-6"
							onClick={() => setShowNew(true)}>
							+ Nouvelle ontologie
						</button>
					)}
				</div>
			</section>

			{/* tableau */}
			<div className="max-w-7xl mx-auto px-6 mb-16">
				<div className="overflow-x-auto rounded-lg shadow ring-1 ring-black/5">
					<table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
						<thead className="bg-gray-50 dark:bg-slate-800/60">
							<tr className="text-xs font-semibold uppercase tracking-wider text-left">
								<th className="px-4 py-3">Ontologie</th>
								<th className="px-4 py-3 w-32 text-center">Actions</th>
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
											title="Ouvrir">
											Ouvrir
										</Link>
										<button
											onClick={() => alert("config à implémenter")}
											title="Configurer"
											className="btn-secondary !py-0.5 !px-2 text-xs">
											⚙
										</button>
										<button
											onClick={() =>
												navigate(
													`/groups?ontology=${encodeURIComponent(o.iri)}`
												)
											}
											title="Groupes"
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
										Aucune ontologie visible pour le moment.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* modal création */}
			{showNew && isSuperAdmin && (
				<SimpleModal
					title="Nouvelle ontologie"
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

						api("/ontology/projects", {
							method: "POST",
							body: fd,
						})
							.then(load)
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
							<label className="block text-sm font-medium mb-1">Label</label>
							<input
								className="input"
								value={newLabel}
								onChange={(e) => setNewLabel(e.target.value)}
								placeholder="Nom lisible"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium mb-1">IRI</label>
							<input
								className="input"
								value={newIri}
								onChange={(e) => setNewIri(e.target.value)}
								placeholder="http://example.org/monOnto"
							/>
							<p className="text-xs text-gray-500 mt-1">
								L’IRI doit être unique dans votre triple store.
							</p>
						</div>

						<div>
							<label className="block text-sm font-medium mb-1">
								Fichier RDF / TTL (optionnel)
							</label>
							<input
								type="file"
								accept=".ttl,.rdf,.owl,.nt,.nq,.trig,.jsonld"
								onChange={handleFile}
								className="block w-full text-sm text-gray-700 dark:text-gray-200"
							/>
							{rdfFile && (
								<p className="text-xs text-green-600 mt-1">
									Fichier sélectionné : {rdfFile.name} (
									{(rdfFile.size / 1024).toFixed(1)} kio)
								</p>
							)}
						</div>
					</div>
				</SimpleModal>
			)}
		</>
	);
}
