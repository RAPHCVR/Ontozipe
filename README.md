# 🧠 Plateforme de Gestion d'Ontologies – Projet TX UTC

Cette plateforme web permet de **gérer, explorer et enrichir des ontologies OWL** de manière collaborative.
Initialement développée autour d'une ontologie des **véhicules autonomes**, elle peut accueillir **tout type d'ontologie RDF**.

---

## 🚀 Fonctionnalités principales

* Visualisation graphique des classes et individus RDF
* Ajout et édition d’individus
* Système de commentaires et de discussion sur chaque ressource
* Gestion des organisations, groupes de travail et droits d’accès
* Authentification sécurisée (JWT)
* Backend en NestJS / Frontend en React / Base RDF via Fuseki (SPARQL)

---

## 🧰 Prérequis

* [Node.js](https://nodejs.org/) ≥ 18.x
* [Yarn](https://yarnpkg.com/)
* [Docker + Docker Compose](https://www.docker.com/products/docker-desktop)

---

## 📦 Installation

1. Clonez le projet :

```bash
git clone https://github.com/votre-repo/plateforme-ontologie.git
cd plateforme-ontologie
```

2. Installez les dépendances :

```bash
yarn install         # à la racine
cd frontend && yarn install
cd ../backend && yarn install
```

---

## 🐳 Lancer Fuseki (serveur RDF)

Depuis la racine du projet :

```bash
docker compose up -d fuseki
```

Accédez ensuite à l’interface : [http://localhost:3030](http://localhost:3030)

* **Utilisateur** : `admin`
* **Mot de passe** : `Pass123`

> ⚠️ Ces identifiants peuvent être modifiés dans la config, puis reconstruits.

### 📥 Importer l'ontologie de base

1. Cliquez sur **“Add new dataset”**
2. Nom : `autonomy` (obligatoire)
3. Importez le fichier `./ontology/core.ttl`

---

## ▶️ Lancer l'application

### Méthode 1 – Automatique :

```bash
yarn dev
```

### Méthode 2 – Manuelle (2 terminaux) :

```bash
# Terminal 1
cd frontend && yarn dev  # http://localhost:5173

# Terminal 2
cd backend && yarn start:dev  # http://localhost:3000
```

---

## 👤 Création du compte Super Administrateur

Créez un compte avec l’e-mail exact :

```
superadmin@admin.com
```

Cela vous donnera automatiquement les **droits super admin** (gestion des organisations, utilisateurs, etc.).

> ✏️ Ce mail peut être modifié dans `backend/src/auth/auth.service.ts`

---

## 📁 Structure du projet

### Backend – NestJS (`/backend/src`)

* `auth/` → Authentification (JWT, login, vérification)
* `ontology/` → Interactions SPARQL, gestion RDF
* `app.module.ts` → Déclaration des modules

Chaque dossier contient :

* `controller.ts` → Gère les routes
* `service.ts` → Logique métier
* `module.ts` → Dépendances

---

### Frontend – React (`/frontend/src`)

* `pages/` → Pages principales (`HomePage`, `GroupsPage`, etc.)
* `components/` → Composants réutilisables (formulaires, accordéons…)
* `auth/` → Login, contexte utilisateur, gestion du token
* `lib/` → Fonctions utilitaires
* `style/` → Fichiers CSS ou Tailwind

Fichier principal : `App.tsx` (routing, layout global)

---

## 🧠 Ontologies supportées

* Format : OWL, RDF/XML, TTL
* L’IRI principal doit être unique dans chaque fichier
* Import possible via l’interface super admin

---

## 📬 Contact

Pour toute question ou contribution, contactez l'équipe développement ou créez une issue sur le dépôt GitLab.

---
