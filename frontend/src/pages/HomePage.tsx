import { CSSProperties, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
import SimpleModal from "../components/SimpleModal";
import { useOntologies, useProfile } from "../hooks/apiQueries";
import { useTranslation } from "../language/useTranslation";

type Ontology = { iri: string; label?: string };

const shortenIri = (iri: string) => {
	try {
		const url = new URL(iri);
		return `${url.hostname}${url.pathname.replace(/\/$/, "")}`;
	} catch (error) {
		return iri;
	}
};

const extractSlug = (iri: string) =>
	iri.split(/[#/]/).filter(Boolean).pop() || iri;

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
	const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
	const [prioritizeFavorites, setPrioritizeFavorites] = useState(true);
	const [sortAlphabetical, setSortAlphabetical] = useState(false);

	const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] || null;
		setRdfFile(file);
	};

	const toggleFavorite = (iri: string) => {
		setFavorites((prev) => {
			const next = new Set(prev);
			if (next.has(iri)) {
				next.delete(iri);
			} else {
				next.add(iri);
			}
			if (typeof window !== "undefined") {
				window.localStorage.setItem(
					"favoriteOntologies",
					JSON.stringify(Array.from(next))
				);
			}
			return next;
		});
	};

	useEffect(() => {
		if (typeof window === "undefined") return;
		const stored = window.localStorage.getItem("favoriteOntologies");
		if (!stored) return;
		try {
			const parsed = JSON.parse(stored) as string[];
			setFavorites(new Set(parsed));
		} catch (error) {
			console.warn("Impossible de lire les favoris", error);
		}
	}, []);

	const roles = profileQuery.data?.roles ?? [];
	const isSuperAdmin = roles.some((r) => r.endsWith("SuperAdminRole"));
	const rolesLoaded = !profileQuery.isLoading && !profileQuery.isFetching;

	const ontos = (ontologiesQuery.data ?? []) as Ontology[];

	const orderedOntologies = useMemo(() => {
		const list = [...ontos];

		list.sort((a, b) => {
			if (prioritizeFavorites) {
				const favDelta =
					Number(favorites.has(b.iri)) - Number(favorites.has(a.iri));
				if (favDelta !== 0) return favDelta;
			}

			if (sortAlphabetical) {
				const nameA = (a.label || extractSlug(a.iri)).toLowerCase();
				const nameB = (b.label || extractSlug(b.iri)).toLowerCase();
				const nameDelta = nameA.localeCompare(nameB);
				if (nameDelta !== 0) return nameDelta;
			}

			return 0;
		});

		return list;
	}, [ontos, favorites, prioritizeFavorites, sortAlphabetical]);

	if (ontologiesQuery.isLoading) {
		return (
			<div className="page-state">
				<div className="page-state__spinner" aria-hidden="true" />
				<p className="page-state__text">Chargement de vos ontologies…</p>
			</div>
		);
	}

	if (ontologiesQuery.isError) {
		return (
			<div className="page-state">
				<i
					className="fas fa-exclamation-triangle page-state__icon"
					aria-hidden
				/>
				<p className="page-state__text">
					Impossible de charger les ontologies. Merci de réessayer plus tard.
				</p>
			</div>
		);
	}

	return (
		<div className="home">
			<section className="home__hero">
				<div className="app-container home__hero-inner">
					<div className="home__welcome">
						<span className="home__eyebrow">
							<i className="fas fa-magic" aria-hidden="true" />
							Bonjour {username}
						</span>
						<h1 className="home__title">
							Naviguez dans vos ontologies en toute fluidité
						</h1>
						<p className="home__subtitle">
							Accédez en un clic à l’ensemble de vos connaissances, partagez-les
							avec vos équipes et explorez-les grâce à des visualisations
							immersives.
						</p>
						<div className="home__cta">
							{rolesLoaded && isSuperAdmin && (
								<button
									type="button"
									className="button button--primary"
									onClick={() => setShowNew(true)}>
									<i className="fas fa-plus" aria-hidden="true" />
									Nouvelle ontologie
								</button>
							)}
							<Link to="/assistant" className="button button--ghost">
								<i className="fas fa-magic" aria-hidden="true" />
								Lancer l’assistant
							</Link>
						</div>
					</div>
					<div className="home__visual" aria-hidden="true">
						<div className="home__orbit">
							<span className="home__planet">
								<i className="fas fa-project-diagram" />
							</span>
							<span className="home__satellite home__satellite--one">
								<i className="fas fa-users" />
							</span>
							<span className="home__satellite home__satellite--two">
								<i className="fas fa-database" />
							</span>
						</div>
					</div>
				</div>
			</section>

			<section className="home__content">
				<div className="app-container home__content-inner">
					<header className="home__section-header">
						<div>
							<h2 className="home__section-title">Vos ontologies</h2>
							<p className="home__section-subtitle">
								Sélectionnez une ontologie pour l’ouvrir ou démarrez un espace
								de travail collaboratif instantané.
							</p>
						</div>
						<div className="home__section-actions">
							<button
								className={`chip ${prioritizeFavorites ? "is-active" : ""}`}
								type="button"
								aria-pressed={prioritizeFavorites}
								onClick={() => setPrioritizeFavorites((prev) => !prev)}>
								<i className="fas fa-star" aria-hidden="true" />
								Favoris en premier
							</button>
							<button
								className={`chip ${sortAlphabetical ? "is-active" : ""}`}
								type="button"
								aria-pressed={sortAlphabetical}
								onClick={() => setSortAlphabetical((prev) => !prev)}>
								<i className="fas fa-sort-alpha-down" aria-hidden="true" />
								Tri alphabétique
							</button>
						</div>
					</header>

					<div className="ontology-grid">
						{orderedOntologies.map((o, index) => {
							const label = o.label || extractSlug(o.iri);
							const host = shortenIri(o.iri);
							const isFavorite = favorites.has(o.iri);
							return (
								<article
									key={o.iri}
									className="ontology-card"
									style={
										{ animationDelay: `${index * 0.08}s` } as CSSProperties
									}>
									<div className="ontology-card__top">
										<div className="ontology-card__icon">
											<i className="fas fa-project-diagram" aria-hidden />
										</div>
										<button
											type="button"
											className={`ontology-card__favorite ${
												isFavorite ? "is-active" : ""
											}`}
											aria-label={
												isFavorite
													? "Retirer des favoris"
													: "Ajouter aux favoris"
											}
											aria-pressed={isFavorite}
											onClick={() => toggleFavorite(o.iri)}>
											<i
												className={`${isFavorite ? "fas" : "far"} fa-star`}
												aria-hidden
											/>
										</button>
									</div>
									<h3 className="ontology-card__title">{label}</h3>
									<p className="ontology-card__subtitle" title={o.iri}>
										{host}
									</p>
									<div className="ontology-card__actions">
										<Link
											to={`/ontology?iri=${encodeURIComponent(o.iri)}`}
											className="button button--primary">
											<i className="fas fa-external-link-alt" aria-hidden />
											Ouvrir
										</Link>
									</div>
								</article>
							);
						})}
					</div>

					{ontos.length === 0 && (
						<div className="home__empty">
							<i className="fas fa-folder-open home__empty-icon" aria-hidden />
							<h3>Aucune ontologie pour le moment</h3>
							<p>
								Commencez par importer une ontologie ou demandez à votre équipe
								de vous en partager une.
							</p>
							{rolesLoaded && isSuperAdmin && (
								<button
									type="button"
									className="button button--primary"
									onClick={() => setShowNew(true)}>
									Importer une ontologie
								</button>
							)}
						</div>
					)}
				</div>
			</section>

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
								await queryClient.invalidateQueries({
									queryKey: ["ontologies"],
								});
							})
							.finally(() => {
								setShowNew(false);
								setNewLabel("");
								setNewIri("");
								setRdfFile(null);
							});
					}}
					disableSubmit={!newLabel.trim() || !newIri.trim() || !rdfFile}>
					<div className="form-grid">
						<div className="form-field-group">
							<div className="form-field form-field--floating">
								<input
									id="newOntologyLabel"
									className="form-input"
									value={newLabel}
									onChange={(e) => setNewLabel(e.target.value)}
									autoComplete="off"
									placeholder=" "
								/>
								<label
									className="form-label form-label--floating"
									htmlFor="newOntologyLabel">
									Label de l’ontologie
								</label>
							</div>
						</div>

						<div className="form-field-group">
							<div className="form-field form-field--floating">
								<input
									id="newOntologyIri"
									className="form-input"
									value={newIri}
									onChange={(e) => setNewIri(e.target.value)}
									autoComplete="off"
									placeholder=" "
								/>
								<label
									className="form-label form-label--floating"
									htmlFor="newOntologyIri">
									IRI (identifiant unique)
								</label>
							</div>
							<span className="form-helper">
								L’IRI doit être unique dans votre triple store.
							</span>
						</div>

						<div className="form-field-group">
							<label
								className="form-label form-label--static"
								htmlFor="newOntologyFile">
								Fichier RDF / TTL
							</label>
							<input
								id="newOntologyFile"
								type="file"
								accept=".ttl,.rdf,.owl,.nt,.nq,.trig,.jsonld"
								onChange={handleFile}
								className="form-input form-input--file"
								required
							/>
							{!rdfFile && (
								<span className="form-helper">
									Veuillez importer un fichier RDF/TTL valide (obligatoire).
								</span>
							)}
							{rdfFile && (
								<span className="form-helper form-helper--success">
									Fichier sélectionné : {rdfFile.name} (
									{(rdfFile.size / 1024).toFixed(1)} kio)
								</span>
							)}
						</div>
					</div>
				</SimpleModal>
			)}
		</div>
	);
}
