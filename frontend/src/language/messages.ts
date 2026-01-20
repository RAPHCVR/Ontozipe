import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from "./config";
import type { SupportedLanguage } from "./config";

type MessageDefinitions = Record<string, Record<SupportedLanguage, string>>;

type LocaleDictionaries<T extends MessageDefinitions> = {
	[L in SupportedLanguage]: { [K in keyof T]: string };
};

const buildDictionaries = <T extends MessageDefinitions>(
	defs: T,
): LocaleDictionaries<T> => {
	const base = Object.fromEntries(
		SUPPORTED_LANGUAGES.map((lang) => [lang, {} as { [K in keyof T]: string }]),
	) as LocaleDictionaries<T>;

	(Object.entries(defs) as Array<[keyof T, T[keyof T]]>).forEach(
		([key, translations]) => {
			SUPPORTED_LANGUAGES.forEach((lang) => {
				base[lang][key] = translations[lang];
			});
		},
	);

	return base;
};

const definitions = {
	"common.language": { fr: "Langue", en: "Language", es: "Idioma" },
	"common.cancel": { fr: "Annuler", en: "Cancel", es: "Cancelar" },
	"common.confirm": { fr: "Valider", en: "Confirm", es: "Confirmar" },
	"common.logout": { fr: "Déconnexion", en: "Log out", es: "Cerrar sesión" },
	"common.pagination.previous": {
		fr: "Précédent",
		en: "Previous",
		es: "Anterior",
	},
	"common.pagination.next": {
		fr: "Suivant",
		en: "Next",
		es: "Siguiente",
	},
	"common.password.show": {
		fr: "Afficher le mot de passe",
		en: "Show password",
		es: "Mostrar la contraseña",
	},
	"common.password.hide": {
		fr: "Masquer le mot de passe",
		en: "Hide password",
		es: "Ocultar la contraseña",
	},
	"language.option.fr": { fr: "Français", en: "French", es: "Francés" },
	"language.option.en": { fr: "Anglais", en: "English", es: "Inglés" },
	"language.option.es": { fr: "Espagnol", en: "Spanish", es: "Español" },
	"modal.closeAria": {
		fr: "Fermer la fenêtre",
		en: "Close dialog",
		es: "Cerrar la ventana",
	},
	"navbar.home": { fr: "Accueil", en: "Home", es: "Inicio" },
	"navbar.assistant": { fr: "OntoBot", en: "OntoBot", es: "OntoBot" },
	"navbar.groups": { fr: "Groupes", en: "Groups", es: "Grupos" },
	"navbar.organisations": {
		fr: "Organisations",
		en: "Organizations",
		es: "Organizaciones",
	},
	"navbar.notifications": {
		fr: "Notifications",
		en: "Notifications",
		es: "Notificaciones",
	},
	"navbar.profile": { fr: "Profil", en: "Profile", es: "Perfil" },
	"footer.copyright": {
		fr: "Maher ZIZOUNI & Hugo PEREIRA — Tous droits réservés",
		en: "Maher ZIZOUNI & Hugo PEREIRA — All rights reserved",
		es: "Maher ZIZOUNI & Hugo PEREIRA — Todos los derechos reservados",
	},
	"auth.login.title": { fr: "Connexion", en: "Sign in", es: "Iniciar sesión" },
	"auth.login.error": {
		fr: "Identifiants invalides ou erreur de communication.",
		en: "Invalid credentials or communication error.",
		es: "Credenciales inválidas o error de comunicación.",
	},
	"auth.email": { fr: "Email", en: "Email", es: "Correo electrónico" },
	"auth.password": { fr: "Mot de passe", en: "Password", es: "Contraseña" },
	"auth.confirmPassword": {
		fr: "Confirmez le mot de passe",
		en: "Confirm password",
		es: "Confirma la contraseña",
	},
	"auth.login.submit": {
		fr: "Se connecter",
		en: "Sign in",
		es: "Iniciar sesión",
	},
	"auth.login.noAccount": {
		fr: "Pas encore de compte ?",
		en: "Don't have an account yet?",
		es: "¿Aún no tienes cuenta?",
	},
	"auth.login.createAccount": {
		fr: "Créer un compte",
		en: "Create an account",
		es: "Crear una cuenta",
	},
	"auth.register.title": {
		fr: "Créer un compte",
		en: "Create an account",
		es: "Crear una cuenta",
	},
	"auth.register.submit": {
		fr: "S'inscrire",
		en: "Sign up",
		es: "Registrarse",
	},
	"auth.register.haveAccount": {
		fr: "Déjà un compte ?",
		en: "Already have an account?",
		es: "¿Ya tienes una cuenta?",
	},
	"auth.register.error.required": {
		fr: "Tous les champs sont requis.",
		en: "All fields are required.",
		es: "Todos los campos son obligatorios.",
	},
	"auth.register.error.generic": {
		fr: "Impossible de créer le compte. L'email est peut-être déjà utilisé.",
		en: "Unable to create the account. The email may already be in use.",
		es: "No se pudo crear la cuenta. Es posible que el correo ya esté en uso.",
	},
	"auth.register.error.passwordMismatch": {
		fr: "Les mots de passe ne correspondent pas.",
		en: "Passwords do not match.",
		es: "Las contraseñas no coinciden.",
	},
	"auth.name": { fr: "Nom", en: "Name", es: "Nombre" },
	"common.user": { fr: "Utilisateur", en: "User", es: "Usuario" },
	"common.loading": { fr: "Chargement", en: "Loading", es: "Cargando" },
	"home.loading": {
		fr: "Chargement de vos ontologies",
		en: "Loading your ontologies",
		es: "Cargando tus ontologías",
	},
	"home.loadError": {
		fr: "Impossible de charger les ontologies.",
		en: "Unable to load ontologies.",
		es: "No se pueden cargar las ontologías.",
	},
	"home.loadErrorHint": {
		fr: "Merci de réessayer plus tard.",
		en: "Please try again later.",
		es: "Inténtalo de nuevo más tarde.",
	},
	"home.greeting": {
		fr: "Bonjour, {{name}} !",
		en: "Hello, {{name}}!",
		es: "Hola, {{name}}!",
	},
	"home.hero.title": {
		fr: "Naviguez dans vos ontologies en toute fluidité",
		en: "Navigate through your ontologies seamlessly",
		es: "Navega por tus ontologías sin esfuerzo",
	},
	"home.hero.subtitle": {
		fr: "Accédez en un clic à vos connaissances, partagez-les avec vos équipes et explorez-les grâce à des visualisations immersives.",
		en: "Access your knowledge in one click, share it with your teams and explore it with immersive visualisations.",
		es: "Accede a tu conocimiento con un clic, compártelo con tus equipos y explóralo con visualizaciones inmersivas.",
	},
	"home.subtitle": {
		fr: "Sélectionnez une ontologie ou créez-en une nouvelle.",
		en: "Select an ontology or create a new one.",
		es: "Selecciona una ontología o crea una nueva.",
	},
	"home.actions.newOntology": {
		fr: "Nouvelle ontologie",
		en: "New ontology",
		es: "Nueva ontología",
	},
	"home.actions.launchAssistant": {
		fr: "Lancer l'assistant",
		en: "Launch assistant",
		es: "Lanzar asistente",
	},
	"home.section.title": {
		fr: "Vos ontologies",
		en: "Your ontologies",
		es: "Tus ontologías",
	},
	"home.section.subtitle": {
		fr: "Sélectionnez une ontologie pour l'ouvrir ou démarrez un espace de travail collaboratif instantané.",
		en: "Select an ontology to open it or start an instant collaborative workspace.",
		es: "Selecciona una ontología para abrirla o inicia un espacio colaborativo al instante.",
	},
	"home.filters.favorites": {
		fr: "Favoris en premier",
		en: "Favorites first",
		es: "Favoritos primero",
	},
	"home.filters.alphabetical": {
		fr: "Tri alphabétique",
		en: "Alphabetical sort",
		es: "Orden alfabético",
	},
	"home.actions.deleteOntology": {
		fr: "Supprimer",
		en: "Delete",
		es: "Eliminar",
	},
	"pdf.viewer.title": {
		fr: "Aperçu PDF",
		en: "PDF preview",
		es: "Vista previa PDF",
	},
	"pdf.modal.defaultTitle": {
		fr: "Document PDF",
		en: "PDF document",
		es: "Documento PDF",
	},
	"pdf.modal.close": {
		fr: "Fermer la fenêtre",
		en: "Close dialog",
		es: "Cerrar la ventana",
	},
	"pdf.modal.closeHint": {
		fr: "Fermer (Échap)",
		en: "Close (Esc)",
		es: "Cerrar (Esc)",
	},
	"home.delete.title": {
		fr: "Supprimer l'ontologie",
		en: "Delete ontology",
		es: "Eliminar ontología",
	},
	"home.delete.confirm": {
		fr: "Êtes-vous sûr de vouloir supprimer « {{label}} » ? Cette action est irréversible et supprime tout ce qui est associé.",
		en: "Are you sure you want to delete “{{label}}”? This action is irreversible and removes everything associated.",
		es: "¿Seguro que quieres eliminar «{{label}}»? Esta acción es irreversible y elimina todo lo asociado.",
	},
	"home.delete.submit": {
		fr: "Oui, supprimer",
		en: "Yes, delete",
		es: "Sí, eliminar",
	},
	"navbar.dashboard": { fr: "Tableau de bord", en: "Dashboard", es: "Panel" },
	"dashboard.tabs.platform": {
		fr: "Supervision plateforme",
		en: "Platform overview",
		es: "Supervisión plataforma",
	},
	"dashboard.tabs.governance": {
		fr: "Gouvernance projet",
		en: "Project governance",
		es: "Gobernanza del proyecto",
	},
	"dashboard.tabs.me": {
		fr: "Mon activité",
		en: "My activity",
		es: "Mi actividad",
	},
	"dashboard.tabs.comments": {
		fr: "Commentaires & threads",
		en: "Comments & threads",
		es: "Comentarios y hilos",
	},
	"dashboard.filters.period": { fr: "Période", en: "Period", es: "Período" },
	"dashboard.filters.scope": { fr: "Périmètre", en: "Scope", es: "Ámbito" },
	"dashboard.scope.all": { fr: "Global", en: "Global", es: "Global" },
	"dashboard.scope.ontology": {
		fr: "Ontologie",
		en: "Ontology",
		es: "Ontología",
	},
	"dashboard.scope.organization": {
		fr: "Organisation",
		en: "Organization",
		es: "Organización",
	},
	"dashboard.scope.group": { fr: "Groupe", en: "Group", es: "Grupo" },
	"dashboard.period.7d": { fr: "7 jours", en: "7 days", es: "7 días" },
	"dashboard.period.30d": { fr: "30 jours", en: "30 days", es: "30 días" },
	"dashboard.period.90d": { fr: "90 jours", en: "90 days", es: "90 días" },
	"dashboard.period.all": {
		fr: "Depuis toujours",
		en: "All time",
		es: "Siempre",
	},
	"dashboard.period.custom": {
		fr: "Personnalisé",
		en: "Custom",
		es: "Personalizado",
	},
	"dashboard.state.loading": {
		fr: "Chargement des métriques…",
		en: "Loading metrics…",
		es: "Cargando métricas…",
	},
	"dashboard.state.error": {
		fr: "Impossible de charger le dashboard",
		en: "Unable to load dashboard",
		es: "No se pudo cargar el panel",
	},
	"dashboard.empty": { fr: "Aucune donnée", en: "No data", es: "Sin datos" },
	"dashboard.kpi.ontologies": {
		fr: "Ontologies",
		en: "Ontologies",
		es: "Ontologías",
	},
	"dashboard.kpi.organizations": {
		fr: "Organisations",
		en: "Organizations",
		es: "Organizaciones",
	},
	"dashboard.kpi.groups": { fr: "Groupes", en: "Groups", es: "Grupos" },
	"dashboard.kpi.activeAccounts": {
		fr: "Comptes actifs",
		en: "Active accounts",
		es: "Cuentas activas",
	},
	"dashboard.kpi.activeMembers": {
		fr: "Membres actifs",
		en: "Active members",
		es: "Miembros activos",
	},
	"dashboard.kpi.recentComments": {
		fr: "Commentaires récents",
		en: "Recent comments",
		es: "Comentarios recientes",
	},
	"dashboard.kpi.createdEdited": {
		fr: "Créations / éditions",
		en: "Creations / edits",
		es: "Creaciones / ediciones",
	},
	"dashboard.kpi.commentsPosted": {
		fr: "Commentaires postés",
		en: "Comments posted",
		es: "Comentarios publicados",
	},
	"dashboard.section.activity": {
		fr: "Activité agrégée",
		en: "Aggregated activity",
		es: "Actividad agregada",
	},
	"dashboard.section.health": {
		fr: "Santé des projets",
		en: "Project health",
		es: "Salud de proyectos",
	},
	"dashboard.section.topContributors": {
		fr: "Top contributeurs",
		en: "Top contributors",
		es: "Principales contribuyentes",
	},
	"dashboard.section.topUsers": {
		fr: "Utilisateurs les plus actifs",
		en: "Most active users",
		es: "Usuarios más activos",
	},
	"dashboard.section.topThreads": {
		fr: "Commentaires avec le plus de réponses",
		en: "Most replied comments",
		es: "Comentarios con más respuestas",
	},
	"dashboard.section.topIndividuals": {
		fr: "Individus les plus interactifs",
		en: "Most interactive individuals",
		es: "Individuos más interactivos",
	},
	"dashboard.section.recentThreads": {
		fr: "Commentaires récents",
		en: "Recent comments",
		es: "Comentarios recientes",
	},
	"dashboard.section.threadsWithoutReply": {
		fr: "Commentaires sans réponse",
		en: "Comments without reply",
		es: "Comentarios sin respuesta",
	},
	"dashboard.section.lastIndividuals": {
		fr: "Derniers individus touchés",
		en: "Last touched individuals",
		es: "Últimos individuos tocados",
	},
	"dashboard.section.lastComments": {
		fr: "Derniers commentaires",
		en: "Last comments",
		es: "Últimos comentarios",
	},
	"dashboard.section.topClasses": {
		fr: "Classes les plus actives",
		en: "Most active classes",
		es: "Clases más activas",
	},
	"dashboard.section.summary": {
		fr: "Synthèse IA",
		en: "AI summary",
		es: "Síntesis IA",
	},
	"dashboard.metric.individualsCreated": {
		fr: "Individus créés",
		en: "Individuals created",
		es: "Individuos creados",
	},
	"dashboard.metric.commentsCreated": {
		fr: "Commentaires créés",
		en: "Comments created",
		es: "Comentarios creados",
	},
	"dashboard.metric.updates": {
		fr: "Mises à jour",
		en: "Updates",
		es: "Actualizaciones",
	},
	"dashboard.metric.growthIndividuals": {
		fr: "Croissance individus",
		en: "Individual growth",
		es: "Crecimiento de individuos",
	},
	"dashboard.metric.growthComments": {
		fr: "Croissance commentaires",
		en: "Comment growth",
		es: "Crecimiento de comentarios",
	},
	"home.table.ontology": { fr: "Ontologie", en: "Ontology", es: "Ontología" },
	"home.table.actions": { fr: "Actions", en: "Actions", es: "Acciones" },
	"home.table.open": { fr: "Ouvrir", en: "Open", es: "Abrir" },
	"home.table.openToolTip": { fr: "Ouvrir", en: "Open", es: "Abrir" },
	"home.table.configure": {
		fr: "Configurer",
		en: "Configure",
		es: "Configurar",
	},
	"home.table.groups": { fr: "Groupes", en: "Groups", es: "Grupos" },
	"home.table.empty": {
		fr: "Aucune ontologie visible pour le moment.",
		en: "No ontology is visible for now.",
		es: "Ninguna ontología visible por el momento.",
	},
	"home.configure.todo": {
		fr: "Fonctionnalité en cours d'implémentation.",
		en: "Feature to be implemented.",
		es: "Funcionalidad pendiente de implementación.",
	},
	"home.modal.title": {
		fr: "Nouvelle ontologie",
		en: "New ontology",
		es: "Nueva ontología",
	},
	"common.label": { fr: "Label", en: "Label", es: "Etiqueta" },
	"home.modal.labelPlaceholder": {
		fr: "Nom lisible",
		en: "Readable name",
		es: "Nombre legible",
	},
	"home.modal.label": {
		fr: "Label de l'ontologie",
		en: "Ontology label",
		es: "Etiqueta de la ontología",
	},
	"home.modal.iri": { fr: "IRI", en: "IRI", es: "IRI" },
	"home.modal.iriPlaceholder": {
		fr: "http://example.org/monOnto",
		en: "http://example.org/myOntology",
		es: "http://example.org/miOntologia",
	},
	"home.modal.iriHint": {
		fr: "L'IRI doit être unique dans votre triple store.",
		en: "The IRI must be unique in your triple store.",
		es: "El IRI debe ser único en tu triple store.",
	},
	"home.modal.fileLabel": {
		fr: "Fichier RDF / TTL",
		en: "RDF / TTL file",
		es: "Archivo RDF / TTL",
	},
	"pdf.upload.label": {
		fr: "Ajouter des PDF",
		en: "Add PDFs",
		es: "Agregar PDF",
	},
	"home.modal.fileRequired": {
		fr: "Veuillez importer un fichier RDF/TTL valide (obligatoire).",
		en: "Please upload a valid RDF/TTL file (required).",
		es: "Carga un archivo RDF/TTL válido (obligatorio).",
	},
	"home.modal.fileSelected": {
		fr: "Fichier sélectionné : {{file}} ({{size}} Kio)",
		en: "Selected file: {{file}} ({{size}} KB)",
		es: "Archivo seleccionado: {{file}} ({{size}} KB)",
	},
	"home.modal.submit": {
		fr: "Importer l'ontologie",
		en: "Import ontology",
		es: "Importar la ontología",
	},
	"home.favorite.add": {
		fr: "Ajouter {{label}} aux favoris",
		en: "Add {{label}} to favourites",
		es: "Añadir {{label}} a favoritos",
	},
	"home.favorite.remove": {
		fr: "Retirer {{label}} des favoris",
		en: "Remove {{label}} from favourites",
		es: "Quitar {{label}} de favoritos",
	},
	"home.empty.title": {
		fr: "Aucune ontologie pour le moment",
		en: "No ontology yet",
		es: "Todavía no hay ontologías",
	},
	"home.empty.subtitle": {
		fr: "Commencez par importer une ontologie ou demandez à votre équipe de vous en partager une.",
		en: "Start by importing an ontology or ask your team to share one with you.",
		es: "Comienza importando una ontología o pide a tu equipo que comparta una contigo.",
	},
	"home.empty.import": {
		fr: "Importer une ontologie",
		en: "Import an ontology",
		es: "Importar una ontología",
	},
	"memberSelector.availableTitle": {
		fr: "Disponibles",
		en: "Available",
		es: "Disponibles",
	},
	"memberSelector.selectedTitle": {
		fr: "Sélectionnés",
		en: "Selected",
		es: "Seleccionados",
	},
	"memberSelector.searchPlaceholder": {
		fr: "Rechercher un utilisateur",
		en: "Search a user",
		es: "Buscar un usuario",
	},
	"memberSelector.emptyAvailable": {
		fr: "Aucun résultat",
		en: "No result",
		es: "Sin resultados",
	},
	"memberSelector.emptySelected": {
		fr: "Aucun membre sélectionné",
		en: "No member selected",
		es: "Ningún miembro seleccionado",
	},
	"memberSelector.availableCount": {
		fr: "{{count}} résultat(s)",
		en: "{{count}} result(s)",
		es: "{{count}} resultado(s)",
	},
	"memberSelector.selectedCount": {
		fr: "{{count}} sélectionné(s)",
		en: "{{count}} selected",
		es: "{{count}} seleccionado(s)",
	},
	"memberSelector.aria.add": {
		fr: "Ajouter {{label}}",
		en: "Add {{label}}",
		es: "Agregar {{label}}",
	},
	"memberSelector.aria.remove": {
		fr: "Retirer {{label}}",
		en: "Remove {{label}}",
		es: "Quitar {{label}}",
	},
	"groups.header.title": { fr: "Groupes", en: "Groups", es: "Grupos" },
	"groups.header.subtitle": {
		fr: "Organisez vos collaborateurs et contrôlez l'accès aux ontologies partagées.",
		en: "Organise your collaborators and control access to shared ontologies.",
		es: "Organiza a tus colaboradores y controla el acceso a las ontologías compartidas.",
	},
	"groups.header.count": {
		fr: "{{count}} groupe(s)",
		en: "{{count}} group(s)",
		es: "{{count}} grupo(s)",
	},
	"groups.state.loading": {
		fr: "Chargement des groupes",
		en: "Loading groups",
		es: "Cargando grupos",
	},
	"groups.empty.title": {
		fr: "Aucun groupe n'a encore été créé.",
		en: "No groups have been created yet.",
		es: "Todavía no se ha creado ningún grupo.",
	},
	"groups.empty.subtitle": {
		fr: "Invitez vos collègues pour collaborer sur vos ontologies.",
		en: "Invite your teammates to collaborate on your ontologies.",
		es: "Invita a tus compañeros a colaborar en tus ontologías.",
	},
	"groups.button.create": {
		fr: "Créer un groupe",
		en: "Create group",
		es: "Crear grupo",
	},
	"groups.organization.unknown": {
		fr: "Organisation inconnue",
		en: "Unknown organization",
		es: "Organización desconocida",
	},
	"groups.card.createdBy": {
		fr: "Créé par {{name}}",
		en: "Created by {{name}}",
		es: "Creado por {{name}}",
	},
	"groups.card.memberCount": {
		fr: "{{count}} membre(s)",
		en: "{{count}} member(s)",
		es: "{{count}} miembro(s)",
	},
	"groups.toast.createSuccess": {
		fr: "Groupe créé avec succès.",
		en: "Group created successfully.",
		es: "Grupo creado con éxito.",
	},
	"groups.toast.createError": {
		fr: "Impossible de créer le groupe.",
		en: "Unable to create the group.",
		es: "No se pudo crear el grupo.",
	},
	"groups.toast.deleteSuccess": {
		fr: "Groupe supprimé.",
		en: "Group deleted.",
		es: "Grupo eliminado.",
	},
	"groups.toast.deleteError": {
		fr: "Suppression du groupe impossible.",
		en: "Unable to delete the group.",
		es: "No se pudo eliminar el grupo.",
	},
	"groups.search.placeholder": {
		fr: "Rechercher un groupe",
		en: "Search a group",
		es: "Buscar un grupo",
	},
	"groups.summary": {
		fr: "{{count}} groupe(s)",
		en: "{{count}} group(s)",
		es: "{{count}} grupo(s)",
	},
	"groups.pagination.label": {
		fr: "Page {{page}} sur {{totalPages}}",
		en: "Page {{page}} of {{totalPages}}",
		es: "Página {{page}} de {{totalPages}}",
	},
	"groups.list.emptySearch": {
		fr: "Aucun groupe ne correspond à votre recherche.",
		en: "No groups match your search.",
		es: "Ningún grupo coincide con tu búsqueda.",
	},
	"groups.confirm.delete": {
		fr: "Supprimer ce groupe ? Cette action est irréversible.",
		en: "Delete this group? This action cannot be undone.",
		es: "¿Eliminar este grupo? Esta acción no se puede deshacer.",
	},
	"groups.toast.updateSuccess": {
		fr: "Groupe mis à jour.",
		en: "Group updated.",
		es: "Grupo actualizado.",
	},
	"groups.toast.updateError": {
		fr: "Impossible de mettre à jour le groupe.",
		en: "Unable to update the group.",
		es: "No se pudo actualizar el grupo.",
	},
	"groups.members.helper": {
		fr: "Glissez-déposez ou cliquez pour sélectionner les collaborateurs à inclure dans le groupe.",
		en: "Drag and drop or click to select collaborators to include in the group.",
		es: "Arrastra y suelta o haz clic para seleccionar colaboradores para el grupo.",
	},
	"groups.members.selectOrganization": {
		fr: "Sélectionnez dabord une organisation pour choisir ses membres.",
		en: "Select an organization first to choose its members.",
		es: "Selecciona primero una organización para elegir a sus miembros.",
	},
	"groups.form.nameLabel": {
		fr: "Nom du groupe",
		en: "Group name",
		es: "Nombre del grupo",
	},
	"groups.form.submitting": {
		fr: "Création",
		en: "Creating",
		es: "Creando",
	},
	"groups.details.saving": {
		fr: "Enregistrement",
		en: "Saving",
		es: "Guardando",
	},
	"organizations.header.title": {
		fr: "Organisations",
		en: "Organizations",
		es: "Organizaciones",
	},
	"organizations.header.subtitle": {
		fr: "Structurez vos équipes, attribuez des administrateurs et gérez les accès aux ontologies.",
		en: "Structure your teams, assign administrators, and manage ontology access.",
		es: "Estructura tus equipos, asigna administradores y gestiona el acceso a las ontologías.",
	},
	"organizations.header.count": {
		fr: "{{count}} organisation(s)",
		en: "{{count}} organization(s)",
		es: "{{count}} organización(es)",
	},
	"organizations.state.loading": {
		fr: "Chargement des organisations",
		en: "Loading organizations",
		es: "Cargando organizaciones",
	},
	"organizations.empty.title": {
		fr: "Aucune organisation nest enregistrée pour le moment.",
		en: "No organizations are registered yet.",
		es: "Aún no hay organizaciones registradas.",
	},
	"organizations.empty.subtitle": {
		fr: "Créez-en une pour regrouper vos utilisateurs et partager vos ontologies.",
		en: "Create one to group your users and share your ontologies.",
		es: "Crea una para agrupar a tus usuarios y compartir tus ontologías.",
	},
	"organizations.button.create": {
		fr: "Nouvelle organisation",
		en: "New organization",
		es: "Nueva organización",
	},
	"organizations.card.admin": {
		fr: "Admin : {{name}}",
		en: "Admin: {{name}}",
		es: "Admin: {{name}}",
	},
	"organizations.card.createdAt": {
		fr: "Créée le {{date}}",
		en: "Created on {{date}}",
		es: "Creada el {{date}}",
	},
	"organizations.toast.createSuccess": {
		fr: "Organisation créée avec succès.",
		en: "Organization created successfully.",
		es: "Organización creada con éxito.",
	},
	"organizations.toast.createError": {
		fr: "Impossible de créer l'organisation.",
		en: "Unable to create the organization.",
		es: "No se pudo crear la organización.",
	},
	"organizations.toast.deleteSuccess": {
		fr: "Organisation supprimée.",
		en: "Organization deleted.",
		es: "Organización eliminada.",
	},
	"organizations.toast.deleteError": {
		fr: "Suppression de l'organisation impossible.",
		en: "Unable to delete the organization.",
		es: "No se pudo eliminar la organización.",
	},
	"organizations.search.placeholder": {
		fr: "Rechercher une organisation",
		en: "Search an organization",
		es: "Buscar una organización",
	},
	"organizations.summary": {
		fr: "{{count}} organisation(s)",
		en: "{{count}} organization(s)",
		es: "{{count}} organización(es)",
	},
	"organizations.pagination.label": {
		fr: "Page {{page}} sur {{totalPages}}",
		en: "Page {{page}} of {{totalPages}}",
		es: "Página {{page}} de {{totalPages}}",
	},
	"organizations.list.emptySearch": {
		fr: "Aucune organisation ne correspond à votre recherche.",
		en: "No organizations match your search.",
		es: "Ninguna organización coincide con tu búsqueda.",
	},
	"organizations.confirm.delete": {
		fr: "Supprimer cette organisation ? Les membres associés en seront impactés.",
		en: "Delete this organization? Linked members will be affected.",
		es: "¿Eliminar esta organización? Los miembros vinculados se verán afectados.",
	},
	"organizations.toast.updateSuccess": {
		fr: "Organisation mise à jour.",
		en: "Organization updated.",
		es: "Organización actualizada.",
	},
	"organizations.toast.updateError": {
		fr: "Impossible de mettre à jour l'organisation.",
		en: "Unable to update the organization.",
		es: "No se pudo actualizar la organización.",
	},
	"organizations.form.ownerLabel": {
		fr: "Administrateur principal",
		en: "Primary administrator",
		es: "Administrador principal",
	},
	"organizations.form.nameLabel": {
		fr: "Nom de l'organisation",
		en: "Organization name",
		es: "Nombre de la organización",
	},
	"organizations.form.selectOwner": {
		fr: "Sélectionner un utilisateur",
		en: "Select a user",
		es: "Selecciona un usuario",
	},
	"organizations.form.submitting": {
		fr: "Création",
		en: "Creating",
		es: "Creando",
	},
	"organizations.members.helper": {
		fr: "Glissez-déposez pour gérer les membres de l'organisation.",
		en: "Drag and drop to manage organization members.",
		es: "Arrastra y suelta para gestionar los miembros de la organización.",
	},
	"organizations.members.readonly": {
		fr: "Vous n'avez pas les droits pour modifier les membres de cette organisation.",
		en: "You don't have permission to modify this organization's members.",
		es: "No tienes permiso para modificar los miembros de esta organización.",
	},
	"organizations.members.emptyAvailable": {
		fr: "Aucun utilisateur disponible",
		en: "No available user",
		es: "No hay usuarios disponibles",
	},
	"groups.title": {
		fr: "Groupes ({{count}})",
		en: "Groups ({{count}})",
		es: "Grupos ({{count}})",
	},
	"groups.actions.new": { fr: "+ Nouveau", en: "+ New", es: "+ Nuevo" },
	"groups.actions.view": { fr: "Voir", en: "View", es: "Ver" },
	"groups.actions.delete": { fr: "Supprimer", en: "Delete", es: "Eliminar" },
	"groups.membersLabel": {
		fr: "Membres : {{count}}",
		en: "Members: {{count}}",
		es: "Miembros: {{count}}",
	},
	"groups.form.title": {
		fr: "Nouveau groupe",
		en: "New group",
		es: "Nuevo grupo",
	},
	"groups.form.organizationPlaceholder": {
		fr: " Choisir une organisation ",
		en: " Select an organization ",
		es: " Elegir una organización ",
	},
	"groups.form.namePlaceholder": {
		fr: "Nom du groupe",
		en: "Group name",
		es: "Nombre del grupo",
	},
	"groups.form.loadingMembers": {
		fr: "Chargement des membres",
		en: "Loading members",
		es: "Cargando miembros",
	},
	"groups.form.noMembers": {
		fr: "Aucun membre disponible pour cette organisation.",
		en: "No members available for this organization.",
		es: "No hay miembros disponibles para esta organización.",
	},
	"groups.form.submit": { fr: "Créer", en: "Create", es: "Crear" },
	"groups.details.title": {
		fr: "Détails du groupe",
		en: "Group details",
		es: "Detalles del grupo",
	},
	"groups.details.organization": {
		fr: "Organisation",
		en: "Organization",
		es: "Organización",
	},
	"common.selectPlaceholder": {
		fr: " choisir ",
		en: " choose ",
		es: " elegir ",
	},
	"common.name": { fr: "Nom", en: "Name", es: "Nombre" },
	"groups.details.members": { fr: "Membres", en: "Members", es: "Miembros" },
	"groups.details.ownerTag": {
		fr: "(propriétaire)",
		en: "(owner)",
		es: "(propietario)",
	},
	"groups.details.removeMember": { fr: "Retirer", en: "Remove", es: "Quitar" },
	"groups.details.addMember": {
		fr: "Ajouter un membre",
		en: "Add a member",
		es: "Agregar un miembro",
	},
	"groups.details.delete": {
		fr: "Supprimer le groupe",
		en: "Delete group",
		es: "Eliminar el grupo",
	},
	"common.done": { fr: "Terminer", en: "Done", es: "Listo" },
	"common.send": { fr: "Envoyer", en: "Send", es: "Enviar" },
	"common.edit": { fr: "Modifier", en: "Edit", es: "Editar" },
	"common.delete": { fr: "Supprimer", en: "Delete", es: "Eliminar" },
	"comment.reply": { fr: "Répondre", en: "Reply", es: "Responder" },
	"comment.replyAction": { fr: "Répondre", en: "Reply", es: "Responder" },
	"comment.confirm.delete": {
		fr: "Supprimer ce commentaire ?",
		en: "Delete this comment?",
		es: "¿Eliminar este comentario?",
	},
	"comment.replyPlaceholder": {
		fr: "Votre réponse (tapez @pdf pour suggérer des documents)",
		en: "Your reply (type @pdf to suggest documents)",
		es: "Tu respuesta (escribe @pdf para sugerir documentos)",
	},
	"comment.showReplies": {
		fr: "Afficher les réponses",
		en: "Show replies",
		es: "Mostrar respuestas",
	},
	"comment.hideReplies": {
		fr: "Masquer les réponses",
		en: "Hide replies",
		es: "Ocultar respuestas",
	},
	"comment.replyCount.one": {
		fr: "1 réponse à ce message",
		en: "1 reply to this message",
		es: "1 respuesta a este mensaje",
	},
	"comment.replyCount.other": {
		fr: "{{count}} réponses à ce message",
		en: "{{count}} replies to this message",
		es: "{{count}} respuestas a este mensaje",
	},
	"comment.form.title": {
		fr: "Nouveau commentaire",
		en: "New comment",
		es: "Nuevo comentario",
	},
	"comment.form.placeholder": {
		fr: "Saisissez votre commentaire",
		en: "Write your comment",
		es: "Escribe tu comentario",
	},
	"comment.form.submit": { fr: "Publier", en: "Post", es: "Publicar" },
	"organizations.title": {
		fr: "Organisations ({{count}})",
		en: "Organizations ({{count}})",
		es: "Organizaciones ({{count}})",
	},
	"organizations.actions.new": { fr: "Nouvelle", en: "New", es: "Nueva" },
	"organizations.actions.view": { fr: "Voir", en: "View", es: "Ver" },
	"organizations.list.admin": {
		fr: "Admin : {{name}}",
		en: "Admin: {{name}}",
		es: "Administrador: {{name}}",
	},
	"organizations.form.title": {
		fr: "Nouvelle organisation",
		en: "New organization",
		es: "Nueva organización",
	},
	"organizations.form.namePlaceholder": {
		fr: "Nom de l'organisation",
		en: "Organization name",
		es: "Nombre de la organización",
	},
	"organizations.form.ownerPlaceholder": {
		fr: " Choisir un admin ",
		en: " Select an admin ",
		es: " Elegir un administrador ",
	},
	"organizations.form.submit": { fr: "Créer", en: "Create", es: "Crear" },
	"organizations.details.title": {
		fr: "Organisation",
		en: "Organization",
		es: "Organización",
	},
	"organizations.details.owner": {
		fr: "Admin",
		en: "Admin",
		es: "Administrador",
	},
	"organizations.details.members": {
		fr: "Membres",
		en: "Members",
		es: "Miembros",
	},
	"organizations.details.noMembers": {
		fr: "Aucun membre pour l'instant.",
		en: "No members yet.",
		es: "Aún no hay miembros.",
	},
	"organizations.details.delete": {
		fr: "Supprimer l'organisation",
		en: "Delete organization",
		es: "Eliminar la organización",
	},
	"organizations.details.deleting": {
		fr: "Suppression",
		en: "Deleting",
		es: "Eliminando",
	},
	"organizations.details.saving": {
		fr: "Enregistrement",
		en: "Saving",
		es: "Guardando",
	},
	"common.remove": { fr: "Retirer", en: "Remove", es: "Quitar" },
	"common.addMember": {
		fr: "Ajouter un membre",
		en: "Add a member",
		es: "Agregar un miembro",
	},
	"common.save": { fr: "Sauvegarder", en: "Save", es: "Guardar" },
	"common.copy": { fr: "Copier", en: "Copy", es: "Copiar" },
	"common.close": { fr: "Fermer", en: "Close", es: "Cerrar" },
	"assistant.initialMessage": {
		fr: "Bonjour, je suis l'assistant OntoZIPE. Posez-moi une question sur votre ontologie.",
		en: "Hello, I am the OntoZIPE assistant. Ask me a question about your ontology.",
		es: "Hola, soy el asistente de OntoZIPE. Hazme una pregunta sobre tu ontología.",
	},
	"assistant.errors.connection": {
		fr: "Une erreur de connexion est survenue.",
		en: "A connection error occurred.",
		es: "Se produjo un error de conexión.",
	},
	"assistant.errors.loadOntologies": {
		fr: "Erreur lors du chargement des ontologies disponibles.",
		en: "Error loading available ontologies.",
		es: "Error al cargar las ontologías disponibles.",
	},
	"assistant.title": {
		fr: "Assistant OntoZIPE",
		en: "OntoZIPE Assistant",
		es: "Asistente OntoZIPE",
	},
	"assistant.ontologyLabel": {
		fr: "Ontologie :",
		en: "Ontology:",
		es: "Ontología:",
	},
	"assistant.sessions.current": {
		fr: "Conversation :",
		en: "Conversation:",
		es: "Conversación:",
	},
	"assistant.sessions.new": {
		fr: "Nouvelle conversation",
		en: "New conversation",
		es: "Nueva conversación",
	},
	"assistant.sessions.rename": {
		fr: "Renommer",
		en: "Rename",
		es: "Renombrar",
	},
	"assistant.sessions.delete": {
		fr: "Supprimer",
		en: "Delete",
		es: "Eliminar",
	},
	"assistant.sessions.emptyState": {
		fr: "Aucune conversation",
		en: "No conversations yet",
		es: "Sin conversaciones",
	},
	"assistant.sessions.created": {
		fr: "Nouvelle conversation créée.",
		en: "New conversation created.",
		es: "Nueva conversación creada.",
	},
	"assistant.sessions.renamed": {
		fr: "Conversation renommée.",
		en: "Conversation renamed.",
		es: "Conversación renombrada.",
	},
	"assistant.sessions.deleted": {
		fr: "Conversation supprimée.",
		en: "Conversation deleted.",
		es: "Conversación eliminada.",
	},
	"assistant.sessions.renamePrompt": {
		fr: "Renommer la conversation :",
		en: "Rename conversation:",
		es: "Renombrar la conversación:",
	},
	"assistant.sessions.deleteConfirm": {
		fr: "Supprimer la conversation « {{title}} » ?",
		en: 'Delete conversation "{{title}}"?',
		es: '¿Eliminar la conversación "{{title}}"?',
	},
	"assistant.sessions.errors.load": {
		fr: "Impossible de charger les conversations.",
		en: "Unable to load conversations.",
		es: "No se pudieron cargar las conversaciones.",
	},
	"assistant.sessions.errors.create": {
		fr: "Impossible de créer la conversation.",
		en: "Unable to create the conversation.",
		es: "No se pudo crear la conversación.",
	},
	"assistant.sessions.errors.rename": {
		fr: "Erreur lors du renommage de la conversation.",
		en: "Could not rename the conversation.",
		es: "No se pudo renombrar la conversación.",
	},
	"assistant.sessions.errors.renameEmpty": {
		fr: "Le nom ne peut pas être vide.",
		en: "Name cannot be empty.",
		es: "El nombre no puede estar vacío.",
	},
	"assistant.sessions.errors.delete": {
		fr: "Impossible de supprimer la conversation.",
		en: "Unable to delete the conversation.",
		es: "No se pudo eliminar la conversación.",
	},
	"assistant.sessions.errors.deleteLast": {
		fr: "Vous devez conserver au moins une conversation.",
		en: "You must keep at least one conversation.",
		es: "Debes conservar al menos una conversación.",
	},
	"assistant.sessions.errors.noActive": {
		fr: "Aucune conversation active. Créez-en une pour démarrer.",
		en: "No active conversation. Create one to start.",
		es: "No hay conversación activa. Crea una para comenzar.",
	},
	"assistant.sessions.errors.loadMessages": {
		fr: "Impossible de charger l'historique de la conversation.",
		en: "Unable to load conversation history.",
		es: "No se pudo cargar el historial de la conversación.",
	},
	"pdf.comments.header": {
		fr: "Discussion PDF",
		en: "PDF discussion",
		es: "Discusión PDF",
	},
	"pdf.comments.loading": {
		fr: "Chargement...",
		en: "Loading...",
		es: "Cargando...",
	},
	"pdf.comments.meta": {
		fr: "{{comments}} commentaire(s) • {{participants}} participant(s)",
		en: "{{comments}} comment(s) • {{participants}} participant(s)",
		es: "{{comments}} comentario(s) • {{participants}} participante(s)",
	},
	"pdf.comments.placeholder": {
		fr: "Commenter ce document... (tapez @pdf pour suggérer des documents)",
		en: "Comment on this document... (type @pdf to suggest documents)",
		es: "Comenta este documento... (escribe @pdf para sugerir documentos)",
	},
	"pdf.comments.shortcut": {
		fr: "Ctrl+Entrée pour envoyer",
		en: "Ctrl+Enter to send",
		es: "Ctrl+Enter para enviar",
	},
	"pdf.comments.emptyTitle": {
		fr: "Aucun commentaire",
		en: "No comments yet",
		es: "Sin comentarios",
	},
	"pdf.comments.emptySubtitle": {
		fr: "Soyez le premier à commenter !",
		en: "Be the first to comment!",
		es: "¡Sé el primero en comentar!",
	},
	"pdf.comments.count": {
		fr: "{{count}} commentaire(s)",
		en: "{{count}} comment(s)",
		es: "{{count}} comentario(s)",
	},
	"pdf.comments.participants": {
		fr: "{{count}} participant(s)",
		en: "{{count}} participant(s)",
		es: "{{count}} participante(s)",
	},
	"assistant.systemPrompt.title": {
		fr: "Prompt système",
		en: "System prompt",
		es: "Prompt del sistema",
	},
	"assistant.systemPrompt.readOnly": {
		fr: "lecture seule",
		en: "read-only",
		es: "solo lectura",
	},
	"assistant.systemPrompt.copyAria": {
		fr: "Copier la prompt système",
		en: "Copy the system prompt",
		es: "Copiar el prompt del sistema",
	},
	"assistant.systemPrompt.empty": {
		fr: "Aucune prompt pour le moment.",
		en: "No prompt available yet.",
		es: "Aún no hay prompt disponible.",
	},
	"assistant.agentReasoning.summary": {
		fr: "Raisonnement de l'agent...",
		en: "Agent reasoning...",
		es: "Razonamiento del agente...",
	},
	"assistant.agentReasoning.toolCall": {
		fr: "Appel de l'outil : {{name}}",
		en: "Tool call: {{name}}",
		es: "Llamada a la herramienta: {{name}}",
	},
	"assistant.agentReasoning.result": {
		fr: "Résultat :",
		en: "Result:",
		es: "Resultado:",
	},
	"assistant.agentReasoning.inProgress": {
		fr: "Observation en cours...",
		en: "Observation in progress...",
		es: "Observación en curso...",
	},
	"assistant.agentReasoning.planTitle": {
		fr: "Stratégie",
		en: "Strategy",
		es: "Estrategia",
	},
	"assistant.agentReasoning.liveStatus": {
		fr: "Progression",
		en: "Live status",
		es: "Estado en vivo",
	},
	"assistant.input.placeholder": {
		fr: "Posez votre question (Maj+Entrée pour nouvelle ligne)",
		en: "Ask your question (Shift+Enter for a new line)",
		es: "Haz tu pregunta (Mayús+Enter para una nueva línea)",
	},
	"assistant.input.ariaSend": {
		fr: "Envoyer",
		en: "Send",
		es: "Enviar",
	},
	"assistant.footer.hint": {
		fr: "L'assistant peut utiliser des outils pour interroger l'ontologie sélectionnée.",
		en: "The assistant can use tools to query the selected ontology.",
		es: "El asistente puede utilizar herramientas para consultar la ontología seleccionada.",
	},
	"individual.relations.title": {
		fr: "Relations",
		en: "Relations",
		es: "Relaciones",
	},
	"individual.relations.openWithData": {
		fr: "Ouvrir les détails (données disponibles)",
		en: "Open details (data available)",
		es: "Abrir detalles (datos disponibles)",
	},
	"individual.relations.openWithoutData": {
		fr: "Ouvrir les détails (aucune donnée spécifique)",
		en: "Open details (no specific data)",
		es: "Abrir detalles (sin datos específicos)",
	},
	"individual.relations.empty": {
		fr: "Aucune relation pour le moment.",
		en: "No relations yet.",
		es: "Aún no hay relaciones.",
	},
	"individual.commonGroups": {
		fr: "Groupes communs",
		en: "Shared groups",
		es: "Grupos comunes",
	},
	"individual.comments.title": {
		fr: "Commentaires",
		en: "Comments",
		es: "Comentarios",
	},
	"individual.comments.placeholder": {
		fr: "Ajouter un commentaire",
		en: "Add a comment",
		es: "Añadir un comentario",
	},
	"individual.pdf.associated": {
		fr: "Documents PDF associés",
		en: "Associated PDF documents",
		es: "Documentos PDF asociados",
	},
	"individual.pdf.hint": {
		fr: "(cliquer pour prévisualiser)",
		en: "(click to preview)",
		es: "(haz clic para previsualizar)",
	},
	"individual.data.title": {
		fr: "Données",
		en: "Data",
		es: "Datos",
	},
	"individual.noData": {
		fr: "Aucune donnée disponible",
		en: "No data available",
		es: "No hay datos disponibles",
	},
	"individual.data.empty": {
		fr: "Aucune donnée pour cet individu.",
		en: "No data for this individual.",
		es: "No hay datos para este individuo.",
	},
	"individual.comments.empty": {
		fr: "Aucun commentaire pour le moment.",
		en: "No comments yet.",
		es: "Aún no hay comentarios.",
	},
	"individual.noDataShort": {
		fr: "Aucune donnée",
		en: "No data",
		es: "Sin datos",
	},
	"individual.form.class": { fr: "Classe", en: "Class", es: "Clase" },
	"individual.form.literalProperties": {
		fr: "Propriétés littérales",
		en: "Literal properties",
		es: "Propiedades literales",
	},
	"individual.form.valuePlaceholder": {
		fr: "Valeur",
		en: "Value",
		es: "Valor",
	},
	"individual.form.relationsTitle": {
		fr: "Relations",
		en: "Relations",
		es: "Relaciones",
	},
	"individual.form.addRelation": {
		fr: "+ Ajouter",
		en: "+ Add",
		es: "+ Añadir",
	},
	"individual.form.predicatePlaceholder": {
		fr: "-- Prédicat --",
		en: "-- Predicate --",
		es: "-- Predicado --",
	},
	"individual.form.selectIndividual": {
		fr: "-- Sélectionner un individu --",
		en: "-- Select individual --",
		es: "-- Seleccionar individuo --",
	},
	"individual.form.visibilityTitle": {
		fr: "Visibilité  Groupes autorisés",
		en: "Visibility  Allowed groups",
		es: "Visibilidad  Grupos autorizados",
	},
	"individual.form.noGroups": {
		fr: "Aucun groupe disponible",
		en: "No groups available",
		es: "No hay grupos disponibles",
	},
	"common.create": { fr: "Créer", en: "Create", es: "Crear" },
	"individual.form.errors.labelRequired": {
		fr: "Le label est requis",
		en: "A label is required",
		es: "Se requiere un nombre",
	},
	"individual.form.confirmDelete": {
		fr: "Supprimer définitivement cet individu ?",
		en: "Permanently delete this individual?",
		es: "¿Eliminar permanentemente este individuo?",
	},
	"individual.form.titleEdit": {
		fr: "Modifier un individu",
		en: "Edit individual",
		es: "Editar individuo",
	},
	"individual.form.titleCreate": {
		fr: "Nouvel individu",
		en: "New individual",
		es: "Nuevo individuo",
	},
	"individual.panel.selectClass": {
		fr: "Sélectionnez une classe",
		en: "Select a class",
		es: "Selecciona una clase",
	},
	"individual.panel.allGroups": {
		fr: "Tous les groupes",
		en: "All groups",
		es: "Todos los grupos",
	},
	"individual.panel.searchPlaceholder": {
		fr: "Rechercher...",
		en: "Search...",
		es: "Buscar...",
	},
	"individual.panel.groupFilterTitle": {
		fr: "Visibilité par groupe",
		en: "Group visibility",
		es: "Visibilidad por grupo",
	},
	"individual.panel.createTooltip": {
		fr: "Nouvel individu",
		en: "New individual",
		es: "Nuevo individuo",
	},
	"individual.panel.count": {
		fr: "{{count}} individu(s)",
		en: "{{count}} individual(s)",
		es: "{{count}} individuo(s)",
	},
	"ontology.loading": {
		fr: "Chargement des données",
		en: "Loading data",
		es: "Cargando datos",
	},
	"ontology.allClasses": {
		fr: "Toutes les classes",
		en: "All classes",
		es: "Todas las clases",
	},
	"ontology.resizeSidebar": {
		fr: "Redimensionner le panneau des individus",
		en: "Resize individuals panel",
		es: "Redimensionar el panel de individuos",
	},
	"ontology.activeClass": {
		fr: "Classe active",
		en: "Active class",
		es: "Clase activa",
	},
	"ontology.summary.filtered": {
		fr: "Individus visibles",
		en: "Visible individuals",
		es: "Individuos visibles",
	},
	"ontology.summary.total": {
		fr: "Total d'individus",
		en: "Total individuals",
		es: "Total de individuos",
	},

	"common.yes": { fr: "Oui", en: "Yes", es: "Sí" },
	"common.no": { fr: "Non", en: "No", es: "No" },
	"adminUsers.title": {
		fr: "Gestion des utilisateurs",
		en: "User management",
		es: "Gestión de usuarios",
	},
	"adminUsers.subtitle": {
		fr: "Liste complète des comptes, réservée aux super administrateurs.",
		en: "Full account list, reserved for super administrators.",
		es: "Lista completa de cuentas, reservada a los superadministradores.",
	},
	"adminUsers.search.placeholder": {
		fr: "Rechercher par nom ou email",
		en: "Search by name or email",
		es: "Buscar por nombre o correo",
	},
	"adminUsers.search.submit": { fr: "Rechercher", en: "Search", es: "Buscar" },
	"adminUsers.filter.onlyUnverified": {
		fr: "Non vérifiés uniquement",
		en: "Only unverified",
		es: "Solo no verificados",
	},
	"adminUsers.filter.role": {
		fr: "Filtrer par rôle",
		en: "Filter by role",
		es: "Filtrar por rol",
	},
	"adminUsers.filter.pageSize": {
		fr: "Nombre d'éléments par page",
		en: "Items per page",
		es: "Elementos por página",
	},
	"adminUsers.roles.superAdmin": {
		fr: "Super administrateur",
		en: "Super administrator",
		es: "Superadministrador",
	},
	"adminUsers.roles.admin": {
		fr: "Administrateur",
		en: "Administrator",
		es: "Administrador",
	},
	"adminUsers.roles.user": { fr: "Utilisateur", en: "User", es: "Usuario" },
	"adminUsers.roles.all": {
		fr: "Tous les rôles",
		en: "All roles",
		es: "Todos los roles",
	},
	"adminUsers.roles.none": { fr: "Aucun", en: "None", es: "Ninguno" },
	"adminUsers.userSingular": { fr: "utilisateur", en: "user", es: "usuario" },
	"adminUsers.userPlural": { fr: "utilisateurs", en: "users", es: "usuarios" },
	"adminUsers.summary": {
		fr: "{{count}} {{users}} · page {{page}} / {{totalPages}}",
		en: "{{count}} {{users}} · page {{page}} / {{totalPages}}",
		es: "{{count}} {{users}} · página {{page}} / {{totalPages}}",
	},
	"adminUsers.pagination.label": {
		fr: "Page {{page}} sur {{totalPages}}",
		en: "Page {{page}} of {{totalPages}}",
		es: "Página {{page}} de {{totalPages}}",
	},
	"adminUsers.pagination.previous": {
		fr: "Précédent",
		en: "Previous",
		es: "Anterior",
	},
	"adminUsers.pagination.next": { fr: "Suivant", en: "Next", es: "Siguiente" },
	"adminUsers.refreshing": {
		fr: "Actualisation",
		en: "Refreshing",
		es: "Actualizando",
	},
	"adminUsers.table.name": { fr: "Nom", en: "Name", es: "Nombre" },
	"adminUsers.table.email": { fr: "Email", en: "Email", es: "Correo" },
	"adminUsers.table.verified": {
		fr: "Vérifié",
		en: "Verified",
		es: "Verificado",
	},
	"adminUsers.table.roles": { fr: "Rôles", en: "Roles", es: "Roles" },
	"adminUsers.table.actions": { fr: "Actions", en: "Actions", es: "Acciones" },
	"adminUsers.table.avatar": { fr: "Avatar", en: "Avatar", es: "Avatar" },
	"adminUsers.table.empty": {
		fr: "Aucun utilisateur à afficher.",
		en: "No users to display.",
		es: "No hay usuarios para mostrar.",
	},
	"adminUsers.modal.title": {
		fr: "Modifier l'utilisateur",
		en: "Edit user",
		es: "Editar usuario",
	},
	"adminUsers.modal.verified": {
		fr: "Utilisateur vérifié",
		en: "Verified user",
		es: "Usuario verificado",
	},
	"adminUsers.modal.roles": { fr: "Rôles", en: "Roles", es: "Roles" },
	"adminUsers.messages.updateSuccess": {
		fr: "Utilisateur mis à jour.",
		en: "User updated.",
		es: "Usuario actualizado.",
	},
	"adminUsers.messages.updateError": {
		fr: "chec de la mise à jour.",
		en: "Update failed.",
		es: "Error al actualizar.",
	},
	"adminUsers.messages.saveError": {
		fr: "Impossible d'enregistrer.",
		en: "Unable to save.",
		es: "No se pudo guardar.",
	},
	"adminUsers.messages.deleteConfirm": {
		fr: "Supprimer définitivement {{target}} ?",
		en: "Permanently delete {{target}}?",
		es: "¿Eliminar permanentemente a {{target}}?",
	},
	"adminUsers.messages.deleteDefaultTarget": {
		fr: "cet utilisateur",
		en: "this user",
		es: "este usuario",
	},
	"adminUsers.messages.deleteError": {
		fr: "chec de la suppression.",
		en: "Deletion failed.",
		es: "Error al eliminar.",
	},
	"adminUsers.messages.deleteSuccess": {
		fr: "Utilisateur supprimé.",
		en: "User deleted.",
		es: "Usuario eliminado.",
	},
	"adminUsers.messages.removeError": {
		fr: "Impossible de supprimer l'utilisateur.",
		en: "Unable to delete the user.",
		es: "No se pudo eliminar al usuario.",
	},
	"profile.loading": {
		fr: "Chargement du profil",
		en: "Loading profile",
		es: "Cargando el perfil",
	},
	"profile.error.load": {
		fr: "Impossible de charger le profil.",
		en: "Unable to load profile.",
		es: "No se puede cargar el perfil.",
	},
	"profile.title": { fr: "Votre profil", en: "Your profile", es: "Tu perfil" },
	"profile.subtitle": {
		fr: "Gérez vos informations personnelles et sécurisez votre compte en quelques clics.",
		en: "Manage your personal details and secure your account in just a few clicks.",
		es: "Gestiona tu información personal y asegura tu cuenta en unos pocos clics.",
	},
	"profile.badge.label": { fr: "Utilisateur", en: "User", es: "Usuario" },
	"profile.badge.anonymous": {
		fr: "Utilisateur anonyme",
		en: "Anonymous user",
		es: "Usuario anónimo",
	},
	"profile.sections.info.title": {
		fr: "Informations générales",
		en: "General information",
		es: "Información general",
	},
	"profile.sections.info.description": {
		fr: "Mettez à jour votre nom et le lien d'avatar partagé avec l'équipe.",
		en: "Update your name and the avatar link shared with the team.",
		es: "Actualiza tu nombre y el enlace del avatar compartido con el equipo.",
	},
	"profile.fields.name.label": { fr: "Nom", en: "Name", es: "Nombre" },
	"profile.fields.name.placeholder": {
		fr: "Votre nom",
		en: "Your name",
		es: "Tu nombre",
	},
	"profile.fields.email.label": {
		fr: "Email",
		en: "Email",
		es: "Correo electrónico",
	},
	"profile.fields.avatar.label": {
		fr: "Avatar (URL)",
		en: "Avatar (URL)",
		es: "Avatar (URL)",
	},
	"profile.fields.avatar.placeholder": {
		fr: "https://exemple.com/avatar.png",
		en: "https://example.com/avatar.png",
		es: "https://ejemplo.com/avatar.png",
	},
	"profile.actions.save": { fr: "Enregistrer", en: "Save", es: "Guardar" },
	"profile.actions.saving": {
		fr: "Enregistrement",
		en: "Saving",
		es: "Guardando",
	},
	"profile.success.info": {
		fr: "Informations mises à jour.",
		en: "Information updated.",
		es: "Información actualizada.",
	},
	"profile.error.infoEmptyName": {
		fr: "Le nom ne peut pas être vide.",
		en: "Name cannot be empty.",
		es: "El nombre no puede estar vacío.",
	},
	"profile.error.infoUpdate": {
		fr: "Mise à jour impossible.",
		en: "Unable to update.",
		es: "No se pudo actualizar.",
	},
	"profile.sections.security.title": {
		fr: "Sécurité du compte",
		en: "Account security",
		es: "Seguridad de la cuenta",
	},
	"profile.sections.security.description": {
		fr: "Choisissez un mot de passe fort pour protéger vos données.",
		en: "Choose a strong password to protect your data.",
		es: "Elige una contraseña segura para proteger tus datos.",
	},
	"profile.fields.oldPassword.label": {
		fr: "Ancien mot de passe",
		en: "Current password",
		es: "Contraseña actual",
	},
	"profile.fields.newPassword.label": {
		fr: "Nouveau mot de passe",
		en: "New password",
		es: "Nueva contraseña",
	},
	"profile.fields.confirmPassword.label": {
		fr: "Confirmez le nouveau mot de passe",
		en: "Confirm new password",
		es: "Confirma la nueva contraseña",
	},
	"profile.password.hintTitle": {
		fr: "Votre mot de passe doit contenir au moins :",
		en: "Your password must include at least:",
		es: "Tu contraseña debe incluir al menos:",
	},
	"profile.password.rule.minLength": {
		fr: "8 caractères minimum",
		en: "Minimum 8 characters",
		es: "Mínimo 8 caracteres",
	},
	"profile.password.rule.special": {
		fr: "1 caractère spécial (&, ', -, _, ?, ., ;, /, :, !)",
		en: "1 special character (&, ', -, _, ?, ., ;, /, :, !)",
		es: "1 carácter especial (&, ', -, _, ?, ., ;, /, :, !)",
	},
	"profile.password.rule.digit": {
		fr: "1 chiffre minimum",
		en: "At least 1 digit",
		es: "Al menos 1 dígito",
	},
	"profile.actions.changePassword": {
		fr: "Changer le mot de passe",
		en: "Change password",
		es: "Cambiar la contraseña",
	},
	"profile.actions.updatingPassword": {
		fr: "Mise à jour",
		en: "Updating",
		es: "Actualizando",
	},
	"profile.error.password.minLength": {
		fr: "Le nouveau mot de passe doit comporter au moins 8 caractères.",
		en: "The new password must be at least 8 characters long.",
		es: "La nueva contraseña debe tener al menos 8 caracteres.",
	},
	"profile.error.password.special": {
		fr: "Ajoutez au moins un caractère spécial (&, ', -, _, ?, ., ;, /, :, !).",
		en: "Add at least one special character (&, ', -, _, ?, ., ;, /, :, !).",
		es: "Añade al menos un carácter especial (&, ', -, _, ?, ., ;, /, :, !).",
	},
	"profile.error.password.digit": {
		fr: "Ajoutez au moins un chiffre dans votre mot de passe.",
		en: "Add at least one digit to your password.",
		es: "Añade al menos un número a tu contraseña.",
	},
	"profile.error.password.session": {
		fr: "Session expirée. Veuillez vous reconnecter.",
		en: "Session expired. Please sign in again.",
		es: "Sesión expirada. Vuelve a iniciar sesión.",
	},
	"profile.error.password.old": {
		fr: "Ancien mot de passe incorrect.",
		en: "Incorrect current password.",
		es: "La contraseña actual es incorrecta.",
	},
	"profile.error.password.generic": {
		fr: "Changement impossible.",
		en: "Unable to change password.",
		es: "No se pudo cambiar la contraseña.",
	},
	"profile.error.password.mismatch": {
		fr: "Les nouveaux mots de passe ne correspondent pas.",
		en: "The new passwords do not match.",
		es: "Las nuevas contraseñas no coinciden.",
	},
	"profile.success.password": {
		fr: "Mot de passe mis à jour.",
		en: "Password updated.",
		es: "Contraseña actualizada.",
	},

	"notifications.title": {
		fr: "Notifications",
		en: "Notifications",
		es: "Notificaciones",
	},
	"notifications.subtitle": {
		fr: "{{count}} non lues",
		en: "{{count}} unread",
		es: "{{count}} sin leer",
	},
	"notifications.filters.all": { fr: "Toutes", en: "All", es: "Todas" },
	"notifications.filters.unread": {
		fr: "Non lues",
		en: "Unread",
		es: "Sin leer",
	},
	"notifications.categories.all": { fr: "Toutes", en: "All", es: "Todas" },
	"notifications.categories.groups": {
		fr: "Groupes",
		en: "Groups",
		es: "Grupos",
	},
	"notifications.categories.admin": {
		fr: "Administration",
		en: "Administration",
		es: "Administración",
	},
	"notifications.categories.organizations": {
		fr: "Organisations",
		en: "Organizations",
		es: "Organizaciones",
	},
	"notifications.categories.ontologies": {
		fr: "Ontologies",
		en: "Ontologies",
		es: "Ontologías",
	},
	"notifications.scope.personal": {
		fr: "Mon activité",
		en: "My activity",
		es: "Mi actividad",
	},
	"notifications.scope.group": {
		fr: "Activité de groupes",
		en: "Group activity",
		es: "Actividad de grupos",
	},
	"notifications.loading": {
		fr: "Chargement des notifications...",
		en: "Loading notifications...",
		es: "Cargando notificaciones...",
	},
	"notifications.empty": {
		fr: "Aucune notification pour le moment.",
		en: "No notifications yet.",
		es: "Sin notificaciones por ahora.",
	},
	"notifications.actions.markAllRead": {
		fr: "Tout marquer comme lu",
		en: "Mark all as read",
		es: "Marcar todo como leído",
	},
	"notifications.actions.markingAll": {
		fr: "Marquage...",
		en: "Marking...",
		es: "Marcando...",
	},
	"notifications.actions.view": { fr: "Ouvrir", en: "Open", es: "Abrir" },
	"notifications.actions.markRead": {
		fr: "Marquer comme lue",
		en: "Mark as read",
		es: "Marcar como leída",
	},
	"notifications.actions.delete": {
		fr: "Supprimer",
		en: "Delete",
		es: "Eliminar",
	},
	"notifications.actions.confirmDelete": {
		fr: "Voulez-vous supprimer cette notification ?",
		en: "Delete this notification?",
		es: "¿Eliminar esta notificación?",
	},
	"notifications.status.unread": {
		fr: "Non lue",
		en: "Unread",
		es: "Sin leer",
	},
	"notifications.status.read": { fr: "Lue", en: "Read", es: "Leída" },
	"notifications.preview.title": {
		fr: "Aperçu",
		en: "Preview",
		es: "Vista previa",
	},
	"notifications.preview.viewAll": {
		fr: "Tout voir",
		en: "See all",
		es: "Ver todo",
	},
	"notifications.target": { fr: "sur", en: "on", es: "en" },
	"notifications.pagination": {
		fr: "Page {{page}} / {{totalPages}}",
		en: "Page {{page}} / {{totalPages}}",
		es: "Página {{page}} / {{totalPages}}",
	},
	"navbar.guide": { fr: "Guide", en: "Guide", es: "Guía" },
	"guide.page.badge": {
		fr: "Front Guide",
		en: "Front Guide",
		es: "Front Guide",
	},
	"guide.page.title": {
		fr: "Guide d'utilisation",
		en: "User guide",
		es: "Guía de uso",
	},
	"guide.page.subtitle": {
		fr: "Des parcours courts pour avancer vite, sans jargon.",
		en: "Short, friendly paths to move fast without the jargon.",
		es: "Rutas cortas para avanzar rápido, sin jerga.",
	},
	"guide.sidebar.title": { fr: "Sommaire", en: "Contents", es: "Contenido" },
	"guide.sidebar.subtitle": {
		fr: "Choisissez un parcours.",
		en: "Pick a path.",
		es: "Elige un camino.",
	},
	"guide.sidebar.open": {
		fr: "Ouvrir le menu",
		en: "Open menu",
		es: "Abrir menú",
	},
	"guide.sidebar.close": {
		fr: "Fermer le menu",
		en: "Close menu",
		es: "Cerrar menú",
	},
	"guide.search.placeholder": {
		fr: "Rechercher une section",
		en: "Search a section",
		es: "Buscar una sección",
	},
	"guide.search.aria": {
		fr: "Rechercher dans le guide",
		en: "Search the guide",
		es: "Buscar en la guía",
	},
	"guide.search.clear": { fr: "Effacer", en: "Clear", es: "Limpiar" },
	"guide.search.emptyTitle": {
		fr: "Aucun résultat",
		en: "No results",
		es: "Sin resultados",
	},
	"guide.search.emptyHint": {
		fr: "Essayez un autre mot ou videz la recherche.",
		en: "Try another word or clear the search.",
		es: "Prueba otra palabra o limpia la búsqueda.",
	},
	"guide.empty.title": {
		fr: "Choisissez une section",
		en: "Pick a section",
		es: "Elige una sección",
	},
	"guide.empty.subtitle": {
		fr: "La colonne de gauche vous guide pas à pas.",
		en: "The left menu guides you step by step.",
		es: "El menú izquierdo te guía paso a paso.",
	},
	"guide.callout.warning.title": {
		fr: "⚠️ Points d’attention",
		en: "⚠️ Watch outs",
		es: "⚠️ Puntos de atención",
	},
	"guide.callout.tip.title": {
		fr: "✅ Astuces",
		en: "✅ Tips",
		es: "✅ Consejos",
	},
	"guide.callout.note.title": {
		fr: "📌 À retenir",
		en: "📌 Key takeaways",
		es: "📌 Para recordar",
	},
	"guide.access.admin": { fr: "Admin", en: "Admin", es: "Admin" },
	"guide.access.superadmin": {
		fr: "SuperAdmin",
		en: "SuperAdmin",
		es: "SuperAdmin",
	},
	"guide.video.title": { fr: "Vidéo", en: "Video", es: "Video" },
	"guide.video.badge": { fr: "Tutoriel", en: "Tutorial", es: "Tutorial" },
	"guide.video.aria": {
		fr: "Vidéo du guide",
		en: "Guide video",
		es: "Video de guía",
	},
	"guide.video.play": {
		fr: "Lancer la vidéo",
		en: "Play video",
		es: "Reproducir video",
	},
	"guide.video.hint": {
		fr: "Si l'autoplay ne démarre pas, lancez la vidéo.",
		en: "If autoplay does not start, hit play.",
		es: "Si el autoplay no inicia, pulsa reproducir.",
	},
	"guide.video.unavailable": {
		fr: "Vidéo indisponible pour le moment.",
		en: "Video unavailable for now.",
		es: "Video no disponible por ahora.",
	},
	"guide.nav.category.profile": { fr: "Profil", en: "Profile", es: "Perfil" },
	"guide.nav.category.organization": {
		fr: "Organisation",
		en: "Organization",
		es: "Organización",
	},
	"guide.nav.category.group": { fr: "Groupe", en: "Group", es: "Grupo" },
	"guide.nav.category.ontology": {
		fr: "Ontologie",
		en: "Ontology",
		es: "Ontología",
	},
	"guide.nav.category.chatbot": { fr: "Chatbot", en: "Chatbot", es: "Chatbot" },
	"guide.nav.section.profile.basics": {
		fr: "Premiers pas",
		en: "Getting started",
		es: "Primeros pasos",
	},
	"guide.nav.section.organization.basics": {
		fr: "Vue d'ensemble",
		en: "Overview",
		es: "Resumen",
	},
	"guide.nav.section.organization.people": {
		fr: "Équipe et rôles",
		en: "Team and roles",
		es: "Equipo y roles",
	},
	"guide.nav.section.organization.admin": {
		fr: "Administration avancée",
		en: "Advanced admin",
		es: "Administración avanzada",
	},
	"guide.nav.section.group.basics": {
		fr: "Créer un groupe",
		en: "Create a group",
		es: "Crear un grupo",
	},
	"guide.nav.section.group.people": {
		fr: "Membres",
		en: "Members",
		es: "Miembros",
	},
	"guide.nav.section.ontology.explore": {
		fr: "Explorer",
		en: "Explore",
		es: "Explorar",
	},
	"guide.nav.section.ontology.admin": {
		fr: "Gouvernance",
		en: "Governance",
		es: "Gobernanza",
	},
	"guide.nav.section.chatbot.basics": {
		fr: "Conversation",
		en: "Conversation",
		es: "Conversación",
	},
	"guide.nav.section.chatbot.insights": {
		fr: "Résumés",
		en: "Summaries",
		es: "Resúmenes",
	},
	"guide.nav.item.profile.start": {
		fr: "Votre espace perso",
		en: "Your space",
		es: "Tu espacio",
	},
	"guide.nav.item.profile.security": {
		fr: "Sécurité du compte",
		en: "Account security",
		es: "Seguridad de la cuenta",
	},
	"guide.nav.item.organization.overview": {
		fr: "Organisation en un coup d'œil",
		en: "Organization at a glance",
		es: "Organización de un vistazo",
	},
	"guide.nav.item.organization.members": {
		fr: "Ajouter des personnes",
		en: "Add people",
		es: "Agregar personas",
	},
	"guide.nav.item.organization.settings": {
		fr: "Modifier l'organisation",
		en: "Edit organization",
		es: "Editar la organización",
	},
	"guide.nav.item.organization.users": {
		fr: "Gestion des utilisateurs",
		en: "Manage users",
		es: "Gestión de usuarios",
	},
	"guide.nav.item.organization.superadmin": {
		fr: "Administration globale",
		en: "Global administration",
		es: "Administración global",
	},
	"guide.nav.item.group.create": {
		fr: "Créer un groupe",
		en: "Create a group",
		es: "Crear un grupo",
	},
	"guide.nav.item.group.members": {
		fr: "Gérer les membres",
		en: "Manage members",
		es: "Gestionar miembros",
	},
	"guide.nav.item.ontology.explore": {
		fr: "Explorer une ontologie",
		en: "Explore an ontology",
		es: "Explorar una ontología",
	},
	"guide.nav.item.ontology.share": {
		fr: "Partager l'ontologie",
		en: "Share the ontology",
		es: "Compartir la ontología",
	},
	"guide.nav.item.ontology.superadmin": {
		fr: "Créer ou supprimer une ontologie",
		en: "Create or delete an ontology",
		es: "Crear o eliminar una ontología",
	},
	"guide.nav.item.chatbot.start": {
		fr: "Lancer le chatbot",
		en: "Start the chatbot",
		es: "Iniciar el chatbot",
	},
	"guide.nav.item.chatbot.summaries": {
		fr: "Résumés intelligents",
		en: "Smart summaries",
		es: "Resúmenes inteligentes",
	},
	"guide.content.profile.start.title": {
		fr: "Bienvenue dans votre espace",
		en: "Welcome to your space",
		es: "Bienvenido a tu espacio",
	},
	"guide.content.profile.start.summary": {
		fr: "Un tableau clair pour retrouver vos projets et vos repères.",
		en: "A clear hub to find your projects and cues.",
		es: "Un centro claro para encontrar proyectos y señales.",
	},
	"guide.content.profile.start.markdown": {
		fr: "### Ce que vous voyez\n- Un panorama simple de vos ontologies actives.\n- Des raccourcis vers le tableau de bord et les notifications.\n- Un bouton rapide pour lancer l'assistant.\n\n### Mini-checklist\n- [ ] Ouvrir une ontologie favorite.\n- [ ] Explorer une notification récente.",
		en: "### What you see\n- A simple panorama of your active ontologies.\n- Shortcuts to the dashboard and notifications.\n- A quick button to launch the assistant.\n\n### Mini checklist\n- [ ] Open a favorite ontology.\n- [ ] Check a recent notification.",
		es: "### Lo que ves\n- Un panorama simple de tus ontologías activas.\n- Atajos al panel y las notificaciones.\n- Un botón rápido para lanzar el asistente.\n\n### Mini checklist\n- [ ] Abrir una ontología favorita.\n- [ ] Revisar una notificación reciente.",
	},
	"guide.content.profile.start.steps.1": {
		fr: "Ouvrez l'accueil après connexion.",
		en: "Open the home page after signing in.",
		es: "Abre el inicio después de iniciar sesión.",
	},
	"guide.content.profile.start.steps.2": {
		fr: "Choisissez une ontologie à mettre en favori.",
		en: "Mark one ontology as a favorite.",
		es: "Marca una ontología como favorita.",
	},
	"guide.content.profile.start.steps.3": {
		fr: "Cliquez sur l'assistant pour une première question.",
		en: "Ask your first question to the assistant.",
		es: "Haz tu primera pregunta al asistente.",
	},
	"guide.content.profile.start.callouts.warning": {
		fr: "Gardez vos favoris à jour pour gagner du temps.",
		en: "Keep favorites tidy to save time.",
		es: "Mantén los favoritos al día para ahorrar tiempo.",
	},
	"guide.content.profile.start.callouts.tip": {
		fr: "Un petit tour quotidien suffit pour rester aligné.",
		en: "A quick daily glance keeps you aligned.",
		es: "Un vistazo diario te mantiene alineado.",
	},
	"guide.content.profile.start.callouts.note": {
		fr: "Votre vue s'adapte à votre rythme.",
		en: "The view adapts to your rhythm.",
		es: "La vista se adapta a tu ritmo.",
	},
	"guide.content.profile.security.title": {
		fr: "Sécuriser votre compte",
		en: "Secure your account",
		es: "Asegura tu cuenta",
	},
	"guide.content.profile.security.summary": {
		fr: "Un mot de passe solide, une tranquillité durable.",
		en: "A strong password, lasting peace of mind.",
		es: "Una contraseña fuerte, tranquilidad duradera.",
	},
	"guide.content.profile.security.markdown": {
		fr: "### Les bons réflexes\n- Utilisez une phrase simple mais unique.\n- Évitez de réutiliser un mot de passe personnel.\n- Changez-le après une session partagée.\n\n### À faire\n- [ ] Mettre à jour votre mot de passe.\n- [ ] Vérifier votre adresse email.",
		en: "### Good habits\n- Use a simple but unique phrase.\n- Avoid reusing personal passwords.\n- Change it after a shared session.\n\n### To do\n- [ ] Update your password.\n- [ ] Check your email address.",
		es: "### Buenos hábitos\n- Usa una frase simple pero única.\n- Evita reutilizar contraseñas personales.\n- Cámbiala después de una sesión compartida.\n\n### Para hacer\n- [ ] Actualizar tu contraseña.\n- [ ] Verificar tu correo.",
	},
	"guide.content.profile.security.steps.1": {
		fr: "Ouvrez Profil puis Sécurité.",
		en: "Open Profile, then Security.",
		es: "Abre Perfil y luego Seguridad.",
	},
	"guide.content.profile.security.steps.2": {
		fr: "Saisissez l'ancien et le nouveau mot de passe.",
		en: "Enter the old and the new password.",
		es: "Escribe la contraseña antigua y la nueva.",
	},
	"guide.content.profile.security.steps.3": {
		fr: "Validez et reconnectez-vous si besoin.",
		en: "Save and reconnect if needed.",
		es: "Guarda y reconecta si hace falta.",
	},
	"guide.content.profile.security.callouts.warning": {
		fr: "Ne partagez jamais votre mot de passe par message.",
		en: "Never share your password in chat.",
		es: "Nunca compartas tu contraseña por chat.",
	},
	"guide.content.profile.security.callouts.tip": {
		fr: "Une phrase de 3 ou 4 mots est facile à retenir.",
		en: "A 3-4 word phrase is easy to remember.",
		es: "Una frase de 3 o 4 palabras es fácil de recordar.",
	},
	"guide.content.profile.security.callouts.note": {
		fr: "Vous êtes déconnecté automatiquement quand le jeton expire.",
		en: "You are logged out when the token expires.",
		es: "Se cierra la sesión cuando el token expira.",
	},
	"guide.content.organization.overview.title": {
		fr: "Comprendre votre organisation",
		en: "Understand your organization",
		es: "Entender tu organización",
	},
	"guide.content.organization.overview.summary": {
		fr: "Voyez la structure et l'activité en un clin d'œil.",
		en: "See structure and activity at a glance.",
		es: "Ve estructura y actividad de un vistazo.",
	},
	"guide.content.organization.overview.markdown": {
		fr: "### Ce que la page raconte\n- Qui pilote l'organisation et les groupes.\n- Les projets visibles pour votre équipe.\n- Les membres actifs du moment.\n\n### À explorer\n- [ ] Ouvrir la liste des organisations.\n- [ ] Identifier le groupe qui vous concerne.",
		en: "### What the page tells you\n- Who leads the organization and its groups.\n- Which projects are visible to your team.\n- The members active right now.\n\n### Explore\n- [ ] Open the organizations list.\n- [ ] Find the group that matters to you.",
		es: "### Lo que cuenta la página\n- Quién lidera la organización y los grupos.\n- Qué proyectos ve tu equipo.\n- Los miembros activos del momento.\n\n### Explora\n- [ ] Abrir la lista de organizaciones.\n- [ ] Encontrar el grupo que te importa.",
	},
	"guide.content.organization.overview.steps.1": {
		fr: "Ouvrez l'onglet Organisations.",
		en: "Open the Organizations tab.",
		es: "Abre la pestaña Organizaciones.",
	},
	"guide.content.organization.overview.steps.2": {
		fr: "Choisissez l'organisation qui vous concerne.",
		en: "Select the organization you belong to.",
		es: "Elige tu organización.",
	},
	"guide.content.organization.overview.steps.3": {
		fr: "Repérez les groupes et les projets en cours.",
		en: "Spot groups and ongoing projects.",
		es: "Identifica grupos y proyectos en curso.",
	},
	"guide.content.organization.overview.callouts.warning": {
		fr: "Les droits peuvent varier selon les groupes.",
		en: "Rights can vary by group.",
		es: "Los permisos pueden variar por grupo.",
	},
	"guide.content.organization.overview.callouts.tip": {
		fr: "Nommez clairement vos groupes pour mieux naviguer.",
		en: "Clear group names speed up navigation.",
		es: "Nombres claros aceleran la navegación.",
	},
	"guide.content.organization.overview.callouts.note": {
		fr: "Les membres apparaissent aussi via les groupes.",
		en: "Members can also appear through groups.",
		es: "Los miembros también aparecen vía grupos.",
	},
	"guide.content.organization.members.title": {
		fr: "Ajouter des personnes",
		en: "Add people",
		es: "Agregar personas",
	},
	"guide.content.organization.members.summary": {
		fr: "Invitez rapidement et gardez l'équipe alignée.",
		en: "Invite fast and keep the team aligned.",
		es: "Invita rápido y mantén el equipo alineado.",
	},
	"guide.content.organization.members.markdown": {
		fr: "### Ce que vous pouvez faire (Admin)\n- Ajouter ou retirer des membres.\n- Ajuster l'owner lorsque l'équipe évolue.\n- Garder les groupes cohérents.\n\n### Mini-checklist\n- [ ] Préparer la liste des personnes.\n- [ ] Vérifier l'organisation cible.",
		en: "### What you can do (Admin)\n- Add or remove members.\n- Adjust the owner as the team evolves.\n- Keep groups coherent.\n\n### Mini checklist\n- [ ] Prepare the people list.\n- [ ] Double-check the target org.",
		es: "### Lo que puedes hacer (Admin)\n- Agregar o quitar miembros.\n- Ajustar el owner cuando el equipo cambia.\n- Mantener los grupos coherentes.\n\n### Mini checklist\n- [ ] Preparar la lista de personas.\n- [ ] Confirmar la organización objetivo.",
	},
	"guide.content.organization.members.steps.1": {
		fr: "Ouvrez l'organisation à mettre à jour.",
		en: "Open the organization to update.",
		es: "Abre la organización a actualizar.",
	},
	"guide.content.organization.members.steps.2": {
		fr: "Cliquez sur Ajouter un membre.",
		en: "Click Add member.",
		es: "Haz clic en Agregar miembro.",
	},
	"guide.content.organization.members.steps.3": {
		fr: "Validez et informez l'équipe.",
		en: "Confirm and inform the team.",
		es: "Confirma e informa al equipo.",
	},
	"guide.content.organization.members.callouts.warning": {
		fr: "Ajoutez uniquement les personnes concernées.",
		en: "Add only the people who need access.",
		es: "Agrega solo a quien necesita acceso.",
	},
	"guide.content.organization.members.callouts.tip": {
		fr: "Un message court accélère l'onboarding.",
		en: "A short welcome message speeds onboarding.",
		es: "Un mensaje corto acelera el onboarding.",
	},
	"guide.content.organization.members.callouts.note": {
		fr: "Vous pouvez rééquilibrer les groupes ensuite.",
		en: "You can rebalance groups afterward.",
		es: "Puedes reequilibrar grupos después.",
	},
	"guide.content.organization.settings.title": {
		fr: "Mettre à jour l'organisation",
		en: "Update the organization",
		es: "Actualizar la organización",
	},
	"guide.content.organization.settings.summary": {
		fr: "Ajustez le nom, le responsable et les repères sans perturber l'équipe.",
		en: "Adjust the name, owner, and cues without disrupting the team.",
		es: "Ajusta el nombre, el responsable y las referencias sin perturbar al equipo.",
	},
	"guide.content.organization.settings.markdown": {
		fr: "### Ce que vous pouvez ajuster\n- Le nom affiché partout.\n- La personne responsable de l'organisation.\n- Des repères pour garder l'équipe alignée.\n\n### Mini-checklist\n- [ ] Valider le nouveau nom.\n- [ ] Prévenir l'équipe du changement.",
		en: "### What you can adjust\n- The name shown everywhere.\n- The organization owner.\n- A few cues to keep the team aligned.\n\n### Mini checklist\n- [ ] Validate the new name.\n- [ ] Let the team know.",
		es: "### Lo que puedes ajustar\n- El nombre que aparece en todas partes.\n- La persona responsable de la organización.\n- Referencias para mantener al equipo alineado.\n\n### Mini checklist\n- [ ] Validar el nuevo nombre.\n- [ ] Avisar al equipo del cambio.",
	},
	"guide.content.organization.settings.steps.1": {
		fr: "Ouvrez l'organisation à modifier.",
		en: "Open the organization you want to update.",
		es: "Abre la organización que deseas modificar.",
	},
	"guide.content.organization.settings.steps.2": {
		fr: "Cliquez sur Modifier puis ajustez les champs.",
		en: "Click Edit and update the fields.",
		es: "Pulsa Editar y ajusta los campos.",
	},
	"guide.content.organization.settings.steps.3": {
		fr: "Validez et vérifiez l'affichage.",
		en: "Save and check the new label.",
		es: "Guarda y verifica el nuevo nombre.",
	},
	"guide.content.organization.settings.callouts.warning": {
		fr: "Un changement de nom peut surprendre l'équipe.",
		en: "Renaming can confuse the team if unannounced.",
		es: "Cambiar el nombre puede desorientar al equipo.",
	},
	"guide.content.organization.settings.callouts.tip": {
		fr: "Un nom court aide tout le monde à s'y retrouver.",
		en: "Short names are easier to scan.",
		es: "Un nombre corto se recuerda mejor.",
	},
	"guide.content.organization.settings.callouts.note": {
		fr: "Les groupes et projets conservent leurs accès.",
		en: "Groups and projects keep their access.",
		es: "Los grupos y proyectos conservan sus accesos.",
	},
	"guide.content.organization.users.title": {
		fr: "Gérer les utilisateurs",
		en: "Manage users",
		es: "Gestionar usuarios",
	},
	"guide.content.organization.users.summary": {
		fr: "Voir l'ensemble des comptes et ajuster les rôles sensibles.",
		en: "See all accounts and adjust sensitive roles.",
		es: "Ver todas las cuentas y ajustar roles sensibles.",
	},
	"guide.content.organization.users.markdown": {
		fr: "### Ce que vous pilotez (SuperAdmin)\n- La liste complète des comptes.\n- Les rôles Admin / SuperAdmin.\n- Les accès sensibles à surveiller.\n\n### À faire\n- [ ] Identifier les comptes actifs.\n- [ ] Ajuster un rôle si besoin.",
		en: "### What you control (SuperAdmin)\n- The full account list.\n- Admin / SuperAdmin roles.\n- Sensitive access to monitor.\n\n### To do\n- [ ] Spot active accounts.\n- [ ] Adjust a role if needed.",
		es: "### Lo que controlas (SuperAdmin)\n- La lista completa de cuentas.\n- Los roles Admin / SuperAdmin.\n- Accesos sensibles a vigilar.\n\n### Para hacer\n- [ ] Identificar cuentas activas.\n- [ ] Ajustar un rol si hace falta.",
	},
	"guide.content.organization.users.steps.1": {
		fr: "Ouvrez Users depuis l'administration.",
		en: "Open Users from Administration.",
		es: "Abre Usuarios desde Administración.",
	},
	"guide.content.organization.users.steps.2": {
		fr: "Recherchez la personne concernée.",
		en: "Find the person you need.",
		es: "Busca a la persona.",
	},
	"guide.content.organization.users.steps.3": {
		fr: "Mettez à jour le rôle puis sauvegardez.",
		en: "Update the role and save.",
		es: "Actualiza el rol y guarda.",
	},
	"guide.content.organization.users.callouts.warning": {
		fr: "Donnez le rôle SuperAdmin avec parcimonie.",
		en: "Grant SuperAdmin sparingly.",
		es: "Otorga SuperAdmin con moderación.",
	},
	"guide.content.organization.users.callouts.tip": {
		fr: "Documentez la raison d'un changement de rôle.",
		en: "Note why a role changes.",
		es: "Anota por qué cambia un rol.",
	},
	"guide.content.organization.users.callouts.note": {
		fr: "Un rafraîchissement confirme les droits.",
		en: "A refresh confirms the permissions.",
		es: "Un refresco confirma los permisos.",
	},
	"guide.content.organization.superadmin.title": {
		fr: "Administration globale",
		en: "Global administration",
		es: "Administración global",
	},
	"guide.content.organization.superadmin.summary": {
		fr: "Créez, nettoyez et pilotez les accès à grande échelle.",
		en: "Create, clean up, and steer access at scale.",
		es: "Crea, limpia y gobierna accesos a escala.",
	},
	"guide.content.organization.superadmin.markdown": {
		fr: "### Vos leviers SuperAdmin\n- Créer ou supprimer une organisation.\n- Consulter la liste des utilisateurs.\n- Garder un paysage propre et lisible.\n\n### À garder en tête\n- [ ] Vérifier les dépendances avant suppression.\n- [ ] Uniformiser les noms d'organisations.",
		en: "### Your SuperAdmin levers\n- Create or remove an organization.\n- Review the user list.\n- Keep the landscape clean and readable.\n\n### Keep in mind\n- [ ] Check dependencies before deletion.\n- [ ] Use a consistent naming pattern.",
		es: "### Tus palancas SuperAdmin\n- Crear o eliminar una organización.\n- Revisar la lista de usuarios.\n- Mantener el paisaje limpio y claro.\n\n### Ten en cuenta\n- [ ] Revisar dependencias antes de borrar.\n- [ ] Usar un nombre consistente.",
	},
	"guide.content.organization.superadmin.steps.1": {
		fr: "Ouvrez la section Administration.",
		en: "Open the Administration area.",
		es: "Abre el área de Administración.",
	},
	"guide.content.organization.superadmin.steps.2": {
		fr: "Créez ou supprimez une organisation selon le besoin.",
		en: "Create or remove an organization as needed.",
		es: "Crea o elimina una organización según necesidad.",
	},
	"guide.content.organization.superadmin.steps.3": {
		fr: "Passez sur Users pour vérifier les accès.",
		en: "Visit Users to verify access.",
		es: "Ve a Users para verificar accesos.",
	},
	"guide.content.organization.superadmin.callouts.warning": {
		fr: "La suppression est définitive pour les données liées.",
		en: "Deletion is final for linked data.",
		es: "Eliminar es definitivo para datos vinculados.",
	},
	"guide.content.organization.superadmin.callouts.tip": {
		fr: "Gardez un format de nommage commun.",
		en: "Stick to a shared naming format.",
		es: "Usa un formato de nombres común.",
	},
	"guide.content.organization.superadmin.callouts.note": {
		fr: "Un petit audit régulier évite les doublons.",
		en: "A small regular audit prevents duplicates.",
		es: "Una auditoría regular evita duplicados.",
	},
	"guide.content.group.create.title": {
		fr: "Créer un groupe",
		en: "Create a group",
		es: "Crear un grupo",
	},
	"guide.content.group.create.summary": {
		fr: "Un espace léger pour une équipe claire.",
		en: "A lightweight space for a focused team.",
		es: "Un espacio ligero para un equipo enfocado.",
	},
	"guide.content.group.create.markdown": {
		fr: "### Pourquoi un groupe\n- Partager des ontologies à un cercle précis.\n- Structurer les projets par équipes.\n- Simplifier la communication.\n\n### Mini-checklist\n- [ ] Choisir un nom court.\n- [ ] Ajouter les membres essentiels.",
		en: "### Why a group\n- Share ontologies with a precise circle.\n- Structure projects by teams.\n- Simplify communication.\n\n### Mini checklist\n- [ ] Pick a short name.\n- [ ] Add essential members.",
		es: "### Por qué un grupo\n- Compartir ontologías con un círculo preciso.\n- Organizar proyectos por equipos.\n- Simplificar la comunicación.\n\n### Mini checklist\n- [ ] Elegir un nombre corto.\n- [ ] Agregar miembros clave.",
	},
	"guide.content.group.create.steps.1": {
		fr: "Ouvrez Groupes puis Nouveau groupe.",
		en: "Open Groups, then New group.",
		es: "Abre Grupos y luego Nuevo grupo.",
	},
	"guide.content.group.create.steps.2": {
		fr: "Donnez un nom qui parle à l'équipe.",
		en: "Give it a team-friendly name.",
		es: "Pon un nombre claro para el equipo.",
	},
	"guide.content.group.create.steps.3": {
		fr: "Ajoutez les premiers membres.",
		en: "Add the first members.",
		es: "Agrega los primeros miembros.",
	},
	"guide.content.group.create.callouts.warning": {
		fr: "Évitez les groupes trop génériques.",
		en: "Avoid overly generic groups.",
		es: "Evita grupos demasiado genéricos.",
	},
	"guide.content.group.create.callouts.tip": {
		fr: "Un nom court aide à la navigation.",
		en: "Short names make navigation faster.",
		es: "Nombres cortos ayudan a navegar.",
	},
	"guide.content.group.create.callouts.note": {
		fr: "Vous pourrez toujours modifier les membres.",
		en: "You can adjust members anytime.",
		es: "Puedes ajustar miembros cuando quieras.",
	},
	"guide.content.group.members.title": {
		fr: "Gérer les membres",
		en: "Manage members",
		es: "Gestionar miembros",
	},
	"guide.content.group.members.summary": {
		fr: "Faites évoluer le groupe sans friction.",
		en: "Keep the circle up to date, without friction.",
		es: "Mantén el círculo al día sin fricción.",
	},
	"guide.content.group.members.markdown": {
		fr: "### Actions rapides\n- Ajouter un membre en un clic.\n- Retirer quelqu'un quand le scope change.\n- Garder un noyau actif.\n\n### À garder en tête\n- [ ] Valider que chacun a l'info utile.\n- [ ] Retirer les anciens accès.",
		en: "### Quick actions\n- Add a member in one click.\n- Remove someone when scope changes.\n- Keep a small active core.\n\n### Keep in mind\n- [ ] Make sure everyone has useful access.\n- [ ] Remove old access when it is no longer needed.",
		es: "### Acciones rápidas\n- Agregar un miembro en un clic.\n- Quitar a alguien cuando cambia el alcance.\n- Mantener un núcleo activo.\n\n### Ten en cuenta\n- [ ] Asegurar acceso útil para todos.\n- [ ] Retirar accesos antiguos.",
	},
	"guide.content.group.members.steps.1": {
		fr: "Ouvrez le groupe concerné.",
		en: "Open the relevant group.",
		es: "Abre el grupo correspondiente.",
	},
	"guide.content.group.members.steps.2": {
		fr: "Ajoutez ou retirez un membre.",
		en: "Add or remove a member.",
		es: "Agrega o quita un miembro.",
	},
	"guide.content.group.members.steps.3": {
		fr: "Confirmez et prévenez l'équipe.",
		en: "Confirm and notify the team.",
		es: "Confirma y avisa al equipo.",
	},
	"guide.content.group.members.callouts.warning": {
		fr: "Les accès aux ontologies suivent le groupe.",
		en: "Ontology access follows the group.",
		es: "El acceso a ontologías sigue al grupo.",
	},
	"guide.content.group.members.callouts.tip": {
		fr: "Un tour mensuel suffit pour garder le cap.",
		en: "A monthly sweep keeps things clean.",
		es: "Una revisión mensual mantiene todo limpio.",
	},
	"guide.content.group.members.callouts.note": {
		fr: "Les notifications aident à suivre les changements.",
		en: "Notifications help track changes.",
		es: "Las notificaciones ayudan a seguir cambios.",
	},
	"guide.content.ontology.explore.title": {
		fr: "Explorer une ontologie",
		en: "Explore an ontology",
		es: "Explorar una ontología",
	},
	"guide.content.ontology.explore.summary": {
		fr: "Parcourez vos connaissances comme une carte vivante.",
		en: "Navigate like a living map.",
		es: "Navega como en un mapa vivo.",
	},
	"guide.content.ontology.explore.markdown": {
		fr: "### Ce que vous pouvez faire\n- Visualiser les classes et leurs liens.\n- Ouvrir une classe pour voir ses propriétés.\n- Comprendre la structure en quelques clics.\n\n### À essayer\n- [ ] Zoomer sur une zone du graphe.\n- [ ] Cliquer sur une classe clé.",
		en: "### What you can do\n- Visualize classes and their links.\n- Open a class to see its properties.\n- Understand structure in a few clicks.\n\n### Try it\n- [ ] Zoom into a graph area.\n- [ ] Click a key class.",
		es: "### Lo que puedes hacer\n- Visualizar clases y sus enlaces.\n- Abrir una clase para ver propiedades.\n- Entender la estructura en pocos clics.\n\n### Prueba\n- [ ] Acercarte a una zona del grafo.\n- [ ] Hacer clic en una clase clave.",
	},
	"guide.content.ontology.explore.steps.1": {
		fr: "Ouvrez une ontologie depuis l'accueil.",
		en: "Open an ontology from Home.",
		es: "Abre una ontología desde Inicio.",
	},
	"guide.content.ontology.explore.steps.2": {
		fr: "Explorez le graphe et ses relations.",
		en: "Explore the graph and relations.",
		es: "Explora el grafo y las relaciones.",
	},
	"guide.content.ontology.explore.steps.3": {
		fr: "Cliquez sur une classe pour les détails.",
		en: "Click a class to see details.",
		es: "Haz clic en una clase para detalles.",
	},
	"guide.content.ontology.explore.callouts.warning": {
		fr: "Les gros graphes peuvent demander un peu de temps.",
		en: "Large graphs may take a moment.",
		es: "Los grafos grandes pueden tardar un poco.",
	},
	"guide.content.ontology.explore.callouts.tip": {
		fr: "Commencez par une classe racine.",
		en: "Start from a root class.",
		es: "Empieza por una clase raíz.",
	},
	"guide.content.ontology.explore.callouts.note": {
		fr: "Les labels s'adaptent à votre langue.",
		en: "Labels adapt to your language.",
		es: "Las etiquetas se adaptan al idioma.",
	},
	"guide.content.ontology.share.title": {
		fr: "Partager l'ontologie",
		en: "Share the ontology",
		es: "Compartir la ontología",
	},
	"guide.content.ontology.share.summary": {
		fr: "Ouvrez l'accès au bon groupe, ni plus ni moins.",
		en: "Open access to the right group, no more.",
		es: "Abre acceso al grupo correcto, nada más.",
	},
	"guide.content.ontology.share.markdown": {
		fr: "### Ce que le partage change\n- Les groupes choisis voient l'ontologie.\n- Les commentaires suivent les visibilités.\n- Le travail reste clair et sécurisé.\n\n### À faire\n- [ ] Choisir les groupes cibles.\n- [ ] Confirmer les droits.",
		en: "### What sharing changes\n- Chosen groups can see the ontology.\n- Comments follow visibility rules.\n- Work stays clear and secure.\n\n### To do\n- [ ] Select the target groups.\n- [ ] Confirm the rights.",
		es: "### Lo que cambia al compartir\n- Los grupos elegidos ven la ontología.\n- Los comentarios siguen la visibilidad.\n- El trabajo queda claro y seguro.\n\n### Para hacer\n- [ ] Seleccionar los grupos objetivo.\n- [ ] Confirmar los permisos.",
	},
	"guide.content.ontology.share.steps.1": {
		fr: "Ouvrez l'ontologie à partager.",
		en: "Open the ontology you want to share.",
		es: "Abre la ontología a compartir.",
	},
	"guide.content.ontology.share.steps.2": {
		fr: "Sélectionnez les groupes autorisés.",
		en: "Select the authorized groups.",
		es: "Selecciona los grupos autorizados.",
	},
	"guide.content.ontology.share.steps.3": {
		fr: "Validez et prévenez votre équipe.",
		en: "Confirm and inform your team.",
		es: "Confirma y avisa a tu equipo.",
	},
	"guide.content.ontology.share.callouts.warning": {
		fr: "Un groupe de plus = plus de visibilité.",
		en: "Each extra group increases visibility.",
		es: "Cada grupo extra aumenta la visibilidad.",
	},
	"guide.content.ontology.share.callouts.tip": {
		fr: "Commencez petit et élargissez ensuite.",
		en: "Start small, expand later.",
		es: "Empieza pequeño y amplía después.",
	},
	"guide.content.ontology.share.callouts.note": {
		fr: "Vous pouvez ajuster la liste à tout moment.",
		en: "You can adjust the list anytime.",
		es: "Puedes ajustar la lista cuando quieras.",
	},
	"guide.content.ontology.superadmin.title": {
		fr: "Créer ou supprimer une ontologie",
		en: "Create or delete an ontology",
		es: "Crear o eliminar una ontología",
	},
	"guide.content.ontology.superadmin.summary": {
		fr: "SuperAdmin : un geste pour lancer ou nettoyer.",
		en: "SuperAdmin: start or clean up with confidence.",
		es: "SuperAdmin: iniciar o limpiar con confianza.",
	},
	"guide.content.ontology.superadmin.markdown": {
		fr: "### Vos actions\n- Créer une nouvelle ontologie avec un nom clair.\n- Importer un fichier si besoin.\n- Supprimer une ontologie obsolète.\n\n### Checklist rapide\n- [ ] Vérifier le besoin avant création.\n- [ ] Sauvegarder avant suppression.",
		en: "### Your actions\n- Create a new ontology with a clear name.\n- Import a file if needed.\n- Remove an obsolete ontology.\n\n### Quick checklist\n- [ ] Validate the need before creating.\n- [ ] Back up before deletion.",
		es: "### Tus acciones\n- Crear una ontología con un nombre claro.\n- Importar un archivo si hace falta.\n- Eliminar una ontología obsoleta.\n\n### Checklist rápida\n- [ ] Validar la necesidad antes de crear.\n- [ ] Guardar respaldo antes de borrar.",
	},
	"guide.content.ontology.superadmin.steps.1": {
		fr: "Depuis l'accueil, cliquez sur Nouvelle ontologie.",
		en: "From Home, click New ontology.",
		es: "Desde Inicio, haz clic en Nueva ontología.",
	},
	"guide.content.ontology.superadmin.steps.2": {
		fr: "Renseignez l'IRI et le nom.",
		en: "Fill in the IRI and name.",
		es: "Completa el IRI y el nombre.",
	},
	"guide.content.ontology.superadmin.steps.3": {
		fr: "Supprimez uniquement si tout est migré.",
		en: "Delete only when everything is migrated.",
		es: "Borra solo cuando todo esté migrado.",
	},
	"guide.content.ontology.superadmin.callouts.warning": {
		fr: "La suppression retire aussi les données liées.",
		en: "Deletion removes linked data.",
		es: "Eliminar borra datos vinculados.",
	},
	"guide.content.ontology.superadmin.callouts.tip": {
		fr: "Gardez un modèle d'IRI cohérent.",
		en: "Keep IRI patterns consistent.",
		es: "Mantén un patrón de IRI consistente.",
	},
	"guide.content.ontology.superadmin.callouts.note": {
		fr: "Documentez chaque création pour l'équipe.",
		en: "Document each creation for the team.",
		es: "Documenta cada creación para el equipo.",
	},
	"guide.content.chatbot.start.title": {
		fr: "Lancer le chatbot",
		en: "Start the chatbot",
		es: "Iniciar el chatbot",
	},
	"guide.content.chatbot.start.summary": {
		fr: "Posez une question et obtenez une direction claire.",
		en: "Ask a question, get a clear direction.",
		es: "Haz una pregunta y obtén una dirección clara.",
	},
	"guide.content.chatbot.start.markdown": {
		fr: '### Ce que vous pouvez demander\n- "Résumé cette ontologie."\n- "Montre-moi les concepts clés."\n- "Explique-moi ce lien simplement."\n\n### Mini-checklist\n- [ ] Choisir l\'ontologie active.\n- [ ] Poser une question courte.',
		en: '### What to ask\n- "Summarize this ontology."\n- "Show me the key concepts."\n- "Explain this link simply."\n\n### Mini checklist\n- [ ] Pick the active ontology.\n- [ ] Ask a short question.',
		es: '### Qué puedes preguntar\n- "Resume esta ontología."\n- "Muéstrame los conceptos clave."\n- "Explica este enlace de forma simple."\n\n### Mini checklist\n- [ ] Elegir la ontología activa.\n- [ ] Hacer una pregunta corta.',
	},
	"guide.content.chatbot.start.steps.1": {
		fr: "Choisissez l'ontologie active.",
		en: "Choose the active ontology.",
		es: "Elige la ontología activa.",
	},
	"guide.content.chatbot.start.steps.2": {
		fr: "Écrivez une question simple.",
		en: "Write a simple question.",
		es: "Escribe una pregunta simple.",
	},
	"guide.content.chatbot.start.steps.3": {
		fr: "Suivez les pistes proposées.",
		en: "Follow the suggested paths.",
		es: "Sigue las pistas sugeridas.",
	},
	"guide.content.chatbot.start.callouts.warning": {
		fr: "Les réponses sont plus claires avec un contexte.",
		en: "Answers are clearer with context.",
		es: "Las respuestas son más claras con contexto.",
	},
	"guide.content.chatbot.start.callouts.tip": {
		fr: "Posez une question à la fois.",
		en: "Ask one question at a time.",
		es: "Haz una pregunta a la vez.",
	},
	"guide.content.chatbot.start.callouts.note": {
		fr: "Vous pouvez relancer en précisant votre besoin.",
		en: "You can refine with a follow-up.",
		es: "Puedes precisar con un seguimiento.",
	},
	"guide.content.chatbot.summaries.title": {
		fr: "Résumés intelligents",
		en: "Smart summaries",
		es: "Resúmenes inteligentes",
	},
	"guide.content.chatbot.summaries.summary": {
		fr: "Des synthèses courtes pour gagner du temps.",
		en: "Short syntheses to save time.",
		es: "Síntesis cortas para ahorrar tiempo.",
	},
	"guide.content.chatbot.summaries.markdown": {
		fr: "### Deux usages rapides\n- Résumer un dashboard pour un point d'équipe.\n- Synthétiser des commentaires d'un individu.\n- Gagner du temps avant une réunion.\n\n### À essayer\n- [ ] Ouvrir un dashboard récent.\n- [ ] Demander un résumé de commentaires.",
		en: "### Two quick uses\n- Summarize a dashboard for the team.\n- Summarize comments on an individual.\n- Save time before a meeting.\n\n### Try it\n- [ ] Open a recent dashboard.\n- [ ] Ask for a comment summary.",
		es: "### Dos usos rápidos\n- Resumir un dashboard para el equipo.\n- Sintetizar comentarios de un individuo.\n- Ahorrar tiempo antes de una reunión.\n\n### Prueba\n- [ ] Abrir un dashboard reciente.\n- [ ] Pedir un resumen de comentarios.",
	},
	"guide.content.chatbot.summaries.steps.1": {
		fr: "Ouvrez la section LLM dans le dashboard.",
		en: "Open the LLM panel in the dashboard.",
		es: "Abre el panel LLM en el dashboard.",
	},
	"guide.content.chatbot.summaries.steps.2": {
		fr: "Cliquez sur le résumé voulu.",
		en: "Pick the summary you need.",
		es: "Elige el resumen que necesitas.",
	},
	"guide.content.chatbot.summaries.steps.3": {
		fr: "Partagez la synthèse à l'équipe.",
		en: "Share the synthesis with the team.",
		es: "Comparte la síntesis con el equipo.",
	},
	"guide.content.chatbot.summaries.callouts.warning": {
		fr: "Relisez avant de partager à l'extérieur.",
		en: "Review before sharing externally.",
		es: "Revisa antes de compartir afuera.",
	},
	"guide.content.chatbot.summaries.callouts.tip": {
		fr: "Combinez résumé et actions immédiates.",
		en: "Pair a summary with clear next actions.",
		es: "Combina resumen con acciones claras.",
	},
	"guide.content.chatbot.summaries.callouts.note": {
		fr: "Plus le contexte est clair, plus le résumé est précis.",
		en: "The clearer the context, the better the summary.",
		es: "Cuanto más claro el contexto, mejor el resumen.",
	},
} as const satisfies MessageDefinitions;

export type TranslationKey = keyof typeof definitions;

export const messages = buildDictionaries(definitions);

export const getMessage = (
	lang: SupportedLanguage,
	key: TranslationKey,
): string => {
	const localeDict = messages[lang] ?? messages[FALLBACK_LANGUAGE];
	return localeDict[key] ?? key;
};
