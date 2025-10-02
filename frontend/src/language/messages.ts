import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from "./config";
import type { SupportedLanguage } from "./config";

type MessageDefinitions = Record<string, Record<SupportedLanguage, string>>;

type LocaleDictionaries<T extends MessageDefinitions> = {
	[L in SupportedLanguage]: { [K in keyof T]: string };
};

const buildDictionaries = <T extends MessageDefinitions>(
	defs: T
): LocaleDictionaries<T> => {
	const base = Object.fromEntries(
		SUPPORTED_LANGUAGES.map((lang) => [lang, {} as { [K in keyof T]: string }])
	) as LocaleDictionaries<T>;

	(Object.entries(defs) as Array<[keyof T, T[keyof T]]>).forEach(
		([key, translations]) => {
			SUPPORTED_LANGUAGES.forEach((lang) => {
				base[lang][key] = translations[lang];
			});
		}
	);

	return base;
};

const definitions = {
	"common.language": { fr: "Langue", en: "Language", es: "Idioma" },
	"common.cancel": { fr: "Annuler", en: "Cancel", es: "Cancelar" },
	"common.confirm": { fr: "Valider", en: "Confirm", es: "Confirmar" },
	"common.logout": { fr: "Déconnexion", en: "Log out", es: "Cerrar sesión" },
	"language.option.fr": { fr: "Français", en: "French", es: "Francés" },
	"language.option.en": { fr: "Anglais", en: "English", es: "Inglés" },
	"language.option.es": { fr: "Espagnol", en: "Spanish", es: "Español" },
	"modal.closeAria": {
		fr: "Fermer la fenêtre",
		en: "Close dialog",
		es: "Cerrar la ventana",
	},
	"navbar.home": { fr: "Accueil", en: "Home", es: "Inicio" },
	"navbar.assistant": { fr: "Assistant", en: "Assistant", es: "Asistente" },
	"navbar.groups": { fr: "Groupes", en: "Groups", es: "Grupos" },
	"navbar.organisations": {
		fr: "Organisations",
		en: "Organizations",
		es: "Organizaciones",
	},
	"navbar.profile": { fr: "Profil", en: "Profile", es: "Perfil" },
	"footer.copyright": {
		fr: "© {{year}} · Maher ZIZOUNI & Hugo PEREIRA — Tous droits réservés",
		en: "© {{year}} · Maher ZIZOUNI & Hugo PEREIRA — All rights reserved",
		es: "© {{year}} · Maher ZIZOUNI & Hugo PEREIRA — Todos los derechos reservados",
	},
	"auth.login.title": { fr: "Connexion", en: "Sign in", es: "Iniciar sesión" },
	"auth.login.error": {
		fr: "Identifiants invalides ou erreur de communication.",
		en: "Invalid credentials or communication error.",
		es: "Credenciales inválidas o error de comunicación.",
	},
	"auth.email": { fr: "Email", en: "Email", es: "Correo electrónico" },
	"auth.password": { fr: "Mot de passe", en: "Password", es: "Contraseña" },
	"auth.login.submit": {
		fr: "Se connecter",
		en: "Sign in",
		es: "Iniciar sesión",
	},
	"auth.login.noAccount": {
		fr: "Pas encore de compte ?",
		en: "Don’t have an account yet?",
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
	"auth.name": { fr: "Nom", en: "Name", es: "Nombre" },
	"common.user": { fr: "Utilisateur", en: "User", es: "Usuario" },
	"common.loading": { fr: "Chargement…", en: "Loading…", es: "Cargando…" },
	"home.loading": {
		fr: "Chargement de vos ontologies…",
		en: "Loading your ontologies…",
		es: "Cargando tus ontologías…",
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
		fr: "Lancer l’assistant",
		en: "Launch assistant",
		es: "Lanzar asistente",
	},
	"home.section.title": {
		fr: "Vos ontologies",
		en: "Your ontologies",
		es: "Tus ontologías",
	},
	"home.section.subtitle": {
		fr: "Sélectionnez une ontologie pour l’ouvrir ou démarrez un espace de travail collaboratif instantané.",
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
		fr: "Label de l’ontologie",
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
	"home.modal.fileRequired": {
		fr: "Veuillez importer un fichier RDF/TTL valide (obligatoire).",
		en: "Please upload a valid RDF/TTL file (required).",
		es: "Carga un archivo RDF/TTL válido (obligatorio).",
	},
	"home.modal.fileSelected": {
		fr: "Fichier sélectionné : {{file}} ({{size}} kio)",
		en: "Selected file: {{file}} ({{size}} KB)",
		es: "Archivo seleccionado: {{file}} ({{size}} KB)",
	},
	"home.modal.submit": {
		fr: "Importer l’ontologie",
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
		fr: "Rechercher un utilisateur…",
		en: "Search a user…",
		es: "Buscar un usuario…",
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
		fr: "Organisez vos collaborateurs et contrôlez l’accès aux ontologies partagées.",
		en: "Organise your collaborators and control access to shared ontologies.",
		es: "Organiza a tus colaboradores y controla el acceso a las ontologías compartidas.",
	},
	"groups.header.count": {
		fr: "{{count}} groupe(s)",
		en: "{{count}} group(s)",
		es: "{{count}} grupo(s)",
	},
	"groups.state.loading": {
		fr: "Chargement des groupes…",
		en: "Loading groups…",
		es: "Cargando grupos…",
	},
	"groups.empty.title": {
		fr: "Aucun groupe n’a encore été créé.",
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
		fr: "Sélectionnez d’abord une organisation pour choisir ses membres.",
		en: "Select an organization first to choose its members.",
		es: "Selecciona primero una organización para elegir a sus miembros.",
	},
	"groups.form.nameLabel": {
		fr: "Nom du groupe",
		en: "Group name",
		es: "Nombre del grupo",
	},
	"groups.form.submitting": {
		fr: "Création…",
		en: "Creating…",
		es: "Creando…",
	},
	"groups.details.saving": {
		fr: "Enregistrement…",
		en: "Saving…",
		es: "Guardando…",
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
		fr: "Chargement des organisations…",
		en: "Loading organizations…",
		es: "Cargando organizaciones…",
	},
	"organizations.empty.title": {
		fr: "Aucune organisation n’est enregistrée pour le moment.",
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
		fr: "Impossible de créer l’organisation.",
		en: "Unable to create the organization.",
		es: "No se pudo crear la organización.",
	},
	"organizations.toast.deleteSuccess": {
		fr: "Organisation supprimée.",
		en: "Organization deleted.",
		es: "Organización eliminada.",
	},
	"organizations.toast.deleteError": {
		fr: "Suppression de l’organisation impossible.",
		en: "Unable to delete the organization.",
		es: "No se pudo eliminar la organización.",
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
		fr: "Impossible de mettre à jour l’organisation.",
		en: "Unable to update the organization.",
		es: "No se pudo actualizar la organización.",
	},
	"organizations.form.ownerLabel": {
		fr: "Administrateur principal",
		en: "Primary administrator",
		es: "Administrador principal",
	},
	"organizations.form.nameLabel": {
		fr: "Nom de l’organisation",
		en: "Organization name",
		es: "Nombre de la organización",
	},
	"organizations.form.selectOwner": {
		fr: "Sélectionner un utilisateur",
		en: "Select a user",
		es: "Selecciona un usuario",
	},
	"organizations.form.submitting": {
		fr: "Création…",
		en: "Creating…",
		es: "Creando…",
	},
	"organizations.members.helper": {
		fr: "Glissez-déposez pour gérer les membres de l’organisation.",
		en: "Drag and drop to manage organization members.",
		es: "Arrastra y suelta para gestionar los miembros de la organización.",
	},
	"organizations.members.readonly": {
		fr: "Vous n’avez pas les droits pour modifier les membres de cette organisation.",
		en: "You don’t have permission to modify this organization’s members.",
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
		fr: "— Choisir une organisation —",
		en: "— Select an organization —",
		es: "— Elegir una organización —",
	},
	"groups.form.namePlaceholder": {
		fr: "Nom du groupe",
		en: "Group name",
		es: "Nombre del grupo",
	},
	"groups.form.loadingMembers": {
		fr: "Chargement des membres…",
		en: "Loading members…",
		es: "Cargando miembros…",
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
		fr: "— choisir —",
		en: "— choose —",
		es: "— elegir —",
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
		fr: "Votre réponse…",
		en: "Your reply…",
		es: "Tu respuesta…",
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
		fr: "Saisissez votre commentaire…",
		en: "Write your comment…",
		es: "Escribe tu comentario…",
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
		fr: "— Choisir un admin —",
		en: "— Select an admin —",
		es: "— Elegir un administrador —",
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
		fr: "Aucun membre pour l’instant.",
		en: "No members yet.",
		es: "Aún no hay miembros.",
	},
	"organizations.details.delete": {
		fr: "Supprimer l’organisation",
		en: "Delete organization",
		es: "Eliminar la organización",
	},
	"organizations.details.deleting": {
		fr: "Suppression…",
		en: "Deleting…",
		es: "Eliminando…",
	},
	"organizations.details.saving": {
		fr: "Enregistrement…",
		en: "Saving…",
		es: "Guardando…",
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
		fr: "Bonjour, je suis l’assistant OntoZIPE. Posez-moi une question sur votre ontologie.",
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
	"assistant.input.placeholder": {
		fr: "Posez votre question (Maj+Entrée pour nouvelle ligne)…",
		en: "Ask your question (Shift+Enter for a new line)…",
		es: "Haz tu pregunta (Mayús+Enter para una nueva línea)…",
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
		fr: "Ajouter un commentaire…",
		en: "Add a comment…",
		es: "Añadir un comentario…",
	},
	"individual.noData": {
		fr: "Aucune donnée disponible",
		en: "No data available",
		es: "No hay datos disponibles",
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
		fr: "Visibilité – Groupes autorisés",
		en: "Visibility – Allowed groups",
		es: "Visibilidad – Grupos autorizados",
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
		fr: "Chargement des données…",
		en: "Loading data…",
		es: "Cargando datos…",
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
		fr: "Total d’individus",
		en: "Total individuals",
		es: "Total de individuos",
	},
} as const satisfies MessageDefinitions;

export type TranslationKey = keyof typeof definitions;

export const messages = buildDictionaries(definitions);

export const getMessage = (
	lang: SupportedLanguage,
	key: TranslationKey
): string => {
	const localeDict = messages[lang] ?? messages[FALLBACK_LANGUAGE];
	return localeDict[key] ?? key;
};
