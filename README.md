# Athénée — School OS

Plateforme SaaS multi-établissements de gestion pour écoles privées.

**Stack : MySQL · Express · React · Node.js** (MERN avec MySQL à la place de MongoDB).
Architecture détaillée : [docs/ARCHITECTURE-MERN-MYSQL.md](docs/ARCHITECTURE-MERN-MYSQL.md).

```
server/   API Express + Sequelize + MySQL (multi-tenant, RBAC, Socket.IO, PDF, IA)
client/   Application React (Vite) branchée sur l'API
mobile/   Application React Native (Expo + TypeScript) Android / iOS
docs/     Architecture
index.html, app.html, assets/   Landing page + prototype statique
```

## Prérequis

La version mobile et ses instructions sont disponibles dans [mobile/README.md](mobile/README.md). Elle utilise Node.js 22.13+ et la même API que le client web.

- Node.js 18 ou plus
- MySQL 8 ou MariaDB 10.4 ou plus (XAMPP convient)

## Installation

```bash
cd server
cp .env.example .env
npm install
npm run db:reset
```

- Adaptez `DB_*` dans `.env` à votre base.
- `npm run db:reset` crée la base `athenee`, applique `database/schema.sql` et charge les données de démo.

```bash
cd client
npm install
```

## Lancer

Ouvrez deux terminaux. Dans le premier, placé dans le dossier `server` :

```bash
npm run dev
```

Dans le second, placé dans le dossier `client` :

```bash
npm run dev
```

Depuis le dossier racine `Ecoles privées`, vous pouvez aussi utiliser `npm --prefix server run dev` et `npm --prefix client run dev`.

Ouvrez <http://localhost:5180> :
- l'API tourne sur :4000 ;
- Vite relaie `/api` et `/socket.io`.

## Comptes de démonstration

Choisissez l'établissement sur l'écran de connexion. Tous les comptes utilisent le mot de passe `Athenee2026!`.

| Rôle | Email (`<école>` = `alfarabi` ou `lumiere`) |
|---|---|
| Direction | `direction@<école>.athenee.app` |
| Scolarité | `scolarite@<école>.athenee.app` |
| Comptabilité | `comptabilite@<école>.athenee.app` |
| Enseignant (maths) | `enseignant@<école>.athenee.app` |
| Parent (2 enfants) | `parent@<école>.athenee.app` |
| Élève | `eleve@<école>.athenee.app` |
| Infirmerie | `infirmerie@<école>.athenee.app` |
| Chauffeur (Al Farabi) | `chauffeur@alfarabi.athenee.app` |

Les deux écoles de démo sont sur des plans différents :
- **Al Farabi** est en plan *Premium* : transport, e-learning, analytics et IA sont actifs.
- **Lumière** est en plan *Essentiel* : ces modules renvoient `402`.

Ces comptes sont réservés au développement. En production, supprimez-les, puis créez les établissements et les utilisateurs réels.

## Tests

```bash
npm --prefix server run smoke
```

Ce script lance 69 vérifications de bout en bout sur la base de démo. Il la modifie, donc relancez ensuite `npm --prefix server run db:reset`. Il vérifie :
- l'isolation entre écoles (jeton, ORM, clés étrangères MySQL) ;
- les permissions par rôle et le périmètre parent/enseignant ;
- l'appel avec notifications, la saisie et la publication des notes, les conflits d'emploi du temps (409) ;
- les paiements, les PDF, le GPS, la correspondance des objets perdus, l'IA, l'audit et l'inscription publique.
- les fichiers (types contrôlés, signature binaire, droits de lecture), les envois tracés, le paiement en ligne sans double encaissement, l'import Excel avec aperçu des erreurs.

## Évolutions de la base (migrations)

Les changements de schéma se placent dans `server/database/migrations/NNN_nom.sql`. Pour appliquer uniquement les migrations nouvelles, sans perdre de données :

```bash
npm --prefix server run db:migrate
```

## Fichiers, envois et paiement

Tout fonctionne sans configuration en développement. Chaque service passe en mode réel dès que sa variable est renseignée dans `server/.env`.

| Service | Sans configuration (dev) | En production |
|---|---|---|
| Fichiers téléversés | `server/uploads/<école>/` | volume persistant ou adaptateur S3 (`services/storage.js`) |
| Emails | fichiers `.eml` dans `server/outbox/<école>/` | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` |
| SMS | écrits dans la console (statut « ignoré ») | `SMS_PROVIDER=twilio` ou `http` (fournisseur marocain exposant une API JSON) |
| Push navigateur | clés générées dans votre `.env` | `npm --prefix server run vapid` pour générer de nouvelles clés |
| Paiement en ligne | page de paiement simulée | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et webhook `POST /api/webhooks/stripe` |

Chaque envoi est tracé : **Paramètres → Envois** (envoyé / ignoré / échec, avec le motif).

Pour tester Stripe en mode test, avec la [Stripe CLI](https://stripe.com/docs/stripe-cli) :

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

## Langues

L'interface est disponible en français, en arabe (de droite à gauche) et en anglais. Le sélecteur est en haut de chaque page, et la langue est mémorisée dans le profil.

La traduction couvre la navigation, la connexion et les écrans des familles. Les écrans d'administration restent en français. Pour ajouter une traduction, complétez `client/src/i18n/fr.js`, puis `ar.js` et `en.js`.

## Assistant IA

Renseignez `ANTHROPIC_API_KEY` dans `server/.env` pour utiliser Claude (modèle `claude-opus-5`, modifiable avec `AI_MODEL`). Sans clé, un moteur local de secours répond.
