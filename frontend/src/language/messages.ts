import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from "./config";
import type { SupportedLanguage } from "./config";

type MessageDefinitions = Record<string, Record<SupportedLanguage, string>>;

type LocaleDictionaries<T extends MessageDefinitions> = {
    [L in SupportedLanguage]: { [K in keyof T]: string };
};

const buildDictionaries = <T extends MessageDefinitions>(defs: T): LocaleDictionaries<T> => {
    const base = Object.fromEntries(
        SUPPORTED_LANGUAGES.map((lang) => [lang, {} as { [K in keyof T]: string }])
    ) as LocaleDictionaries<T>;

    (Object.entries(defs) as Array<[keyof T, T[keyof T]]>).forEach(([key, translations]) => {
        SUPPORTED_LANGUAGES.forEach((lang) => {
            base[lang][key] = translations[lang];
        });
    });

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
    "navbar.home": { fr: "Accueil", en: "Home", es: "Inicio" },
    "navbar.assistant": { fr: "Assistant", en: "Assistant", es: "Asistente" },
    "navbar.groups": { fr: "Groupes", en: "Groups", es: "Grupos" },
    "navbar.organisations": { fr: "Organisations", en: "Organizations", es: "Organizaciones" },
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
    "auth.login.submit": { fr: "Se connecter", en: "Sign in", es: "Iniciar sesión" },
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
    "auth.register.title": { fr: "Créer un compte", en: "Create an account", es: "Crear una cuenta" },
    "auth.register.submit": { fr: "S'inscrire", en: "Sign up", es: "Registrarse" },
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
    "home.loadError": {
        fr: "Impossible de charger les ontologies.",
        en: "Unable to load ontologies.",
        es: "No se pueden cargar las ontologías.",
    },
    "home.greeting": {
        fr: "Bonjour, {{name}} !",
        en: "Hello, {{name}}!",
        es: "Hola, {{name}}!",
    },
    "home.subtitle": {
        fr: "Sélectionnez une ontologie ou créez-en une nouvelle.",
        en: "Select an ontology or create a new one.",
        es: "Selecciona una ontología o crea una nueva.",
    },
    "home.actions.newOntology": {
        fr: "+ Nouvelle ontologie",
        en: "+ New ontology",
        es: "+ Nueva ontología",
    },
    "home.table.ontology": { fr: "Ontologie", en: "Ontology", es: "Ontología" },
    "home.table.actions": { fr: "Actions", en: "Actions", es: "Acciones" },
    "home.table.open": { fr: "Ouvrir", en: "Open", es: "Abrir" },
    "home.table.openToolTip": { fr: "Ouvrir", en: "Open", es: "Abrir" },
    "home.table.configure": { fr: "Configurer", en: "Configure", es: "Configurar" },
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
    "home.modal.title": { fr: "Nouvelle ontologie", en: "New ontology", es: "Nueva ontología" },
    "common.label": { fr: "Label", en: "Label", es: "Etiqueta" },
    "home.modal.labelPlaceholder": {
        fr: "Nom lisible",
        en: "Readable name",
        es: "Nombre legible",
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
        fr: "Fichier RDF / TTL (optionnel)",
        en: "RDF / TTL file (optional)",
        es: "Archivo RDF / TTL (opcional)",
    },
    "home.modal.fileSelected": {
        fr: "Fichier sélectionné : {{file}} ({{size}} kio)",
        en: "Selected file: {{file}} ({{size}} KB)",
        es: "Archivo seleccionado: {{file}} ({{size}} KB)",
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
    "groups.form.title": { fr: "Nouveau groupe", en: "New group", es: "Nuevo grupo" },
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
    "groups.details.organization": { fr: "Organisation", en: "Organization", es: "Organización" },
    "common.selectPlaceholder": { fr: "— choisir —", en: "— choose —", es: "— elegir —" },
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
    "comment.form.title": { fr: "Nouveau commentaire", en: "New comment", es: "Nuevo comentario" },
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
    "organizations.form.title": { fr: "Nouvelle organisation", en: "New organization", es: "Nueva organización" },
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
    "organizations.details.title": { fr: "Organisation", en: "Organization", es: "Organización" },
    "organizations.details.owner": { fr: "Admin", en: "Admin", es: "Administrador" },
    "organizations.details.members": { fr: "Membres", en: "Members", es: "Miembros" },
    "organizations.details.noMembers": {
        fr: "Aucun membre pour l’instant.",
        en: "No members yet.",
        es: "Aún no hay miembros.",
    },
    "common.remove": { fr: "Retirer", en: "Remove", es: "Quitar" },
    "common.addMember": { fr: "Ajouter un membre", en: "Add a member", es: "Agregar un miembro" },
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
    "assistant.title": { fr: "Assistant OntoZIPE", en: "OntoZIPE Assistant", es: "Asistente OntoZIPE" },
    "assistant.ontologyLabel": { fr: "Ontologie :", en: "Ontology:", es: "Ontología:" },
    "assistant.systemPrompt.title": { fr: "Prompt système", en: "System prompt", es: "Prompt del sistema" },
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
    "individual.relations.title": { fr: "Relations", en: "Relations", es: "Relaciones" },
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
    "individual.commonGroups": { fr: "Groupes communs", en: "Shared groups", es: "Grupos comunes" },
    "individual.comments.title": { fr: "Commentaires", en: "Comments", es: "Comentarios" },
    "individual.comments.placeholder": {
        fr: "Ajouter un commentaire…",
        en: "Add a comment…",
        es: "Añadir un comentario…",
    },
    "individual.noData": { fr: "Aucune donnée disponible", en: "No data available", es: "No hay datos disponibles" },
    "individual.noDataShort": { fr: "Aucune donnée", en: "No data", es: "Sin datos" },
    "individual.form.class": { fr: "Classe", en: "Class", es: "Clase" },
    "individual.form.literalProperties": {
        fr: "Propriétés littérales",
        en: "Literal properties",
        es: "Propiedades literales",
    },
    "individual.form.valuePlaceholder": { fr: "Valeur", en: "Value", es: "Valor" },
    "individual.form.relationsTitle": { fr: "Relations", en: "Relations", es: "Relaciones" },
    "individual.form.addRelation": { fr: "+ Ajouter", en: "+ Add", es: "+ Añadir" },
    "individual.form.predicatePlaceholder": { fr: "-- Prédicat --", en: "-- Predicate --", es: "-- Predicado --" },
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
    "individual.form.titleEdit": { fr: "Modifier un individu", en: "Edit individual", es: "Editar individuo" },
    "individual.form.titleCreate": { fr: "Nouvel individu", en: "New individual", es: "Nuevo individuo" },
    "individual.panel.selectClass": { fr: "Sélectionnez une classe", en: "Select a class", es: "Selecciona una clase" },
    "individual.panel.allGroups": { fr: "Tous les groupes", en: "All groups", es: "Todos los grupos" },
    "individual.panel.searchPlaceholder": { fr: "Rechercher...", en: "Search...", es: "Buscar..." },
    "individual.panel.createTooltip": { fr: "Nouvel individu", en: "New individual", es: "Nuevo individuo" },
    "ontology.loading": { fr: "Chargement des données…", en: "Loading data…", es: "Cargando datos…" },
} as const satisfies MessageDefinitions;

export type TranslationKey = keyof typeof definitions;

export const messages = buildDictionaries(definitions);

export const getMessage = (lang: SupportedLanguage, key: TranslationKey): string => {
    const localeDict = messages[lang] ?? messages[FALLBACK_LANGUAGE];
    return localeDict[key] ?? key;
};
