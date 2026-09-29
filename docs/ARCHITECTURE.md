# Athénée School OS — Variante PostgreSQL (alternative)

> L'implémentation livrée utilise **MERN + MySQL** : voir [ARCHITECTURE-MERN-MYSQL.md](ARCHITECTURE-MERN-MYSQL.md) et `server/database/schema.sql`. Ce document décrit l'option PostgreSQL (Row-Level Security native).

Le dépôt contient un **prototype front-end complet et fonctionnel**, alimenté par des données de démonstration. Ce document décrit comment le porter vers une vraie SaaS multi-tenant commercialisable.

## 1. Stack recommandée

| Couche | Choix | Pourquoi |
|---|---|---|
| Front web | Next.js (React + TypeScript), design system repris de `assets/css` | SSR pour la landing et le SEO, SPA pour l'app |
| Mobile | React Native / Expo (parents, élèves, accompagnateurs de bus) | Notifications push, scan QR/NFC |
| API | NestJS (TypeScript) en REST + WebSocket | Modules métier, guards RBAC, validation |
| Base | PostgreSQL 16 + Row-Level Security (`docs/schema.sql`) | Isolation des tenants au niveau des données |
| Cache / files d'attente | Redis + BullMQ | Notifications, relances, génération PDF |
| Temps réel | WebSocket (Socket.IO) + Redis pub/sub | Positions GPS, chat, présence |
| Fichiers | Stockage objet S3-compatible, URLs signées, préfixe `tenant_id/` | Documents, devoirs, vidéos |
| PDF | Gotenberg / Puppeteer (modèles HTML aux couleurs du tenant) | Certificats, bulletins, reçus |
| Recherche | PostgreSQL `tsvector` (puis OpenSearch si besoin) | Bibliothèque, objets perdus |
| IA | API Claude via un service backend dédié | Voir §6 |
| Paiement | Stripe / CMI (Maroc), webhooks signés | Aucune donnée bancaire stockée |
| Notifications | FCM/APNs (push), SES/Postmark (email), fournisseur SMS local | Multi-canal |
| Observabilité | OpenTelemetry, Sentry, Grafana | |

## 2. Multi-tenant

- **Un tenant = un établissement** (ou un groupe avec plusieurs établissements).
- Résolution du tenant : sous-domaine (`alfarabi.athenee.app`) ou domaine personnalisé (`ecole-lumiere.ma`), puis un claim `tid` dans le JWT.
- **Toute table métier porte `tenant_id`.** RLS PostgreSQL : l'API exécute `SET LOCAL app.tenant_id` dans chaque transaction. Une requête qui oublie de filtrer ne renvoie donc rien, au lieu de renvoyer les données d'une autre école.
- Stockage objet préfixé `tenant_id/…` ; clés KMS dédiées par tenant pour les données de santé.
- Limites du plan (`plans.features`, nombre d'élèves, stockage, SMS, requêtes IA) vérifiées par un middleware de quotas.
- Personnalisation : logo, couleur principale, domaine, langues, règles de calcul et devise dans `tenants.branding` et `tenants.settings`.
- Les groupes scolaires ont un tenant parent avec des vues consolidées en lecture seule.

## 3. Sécurité

- Mots de passe hachés en argon2id, **2FA TOTP** (obligatoire pour le personnel), SSO Google / Microsoft / SAML.
- Sessions courtes (access token 15 min + refresh rotatif), révocation par appareil, verrouillage après échecs.
- **RBAC** : rôles par tenant (`roles.permissions`), vérifiés par des guards côté API. Des politiques RLS fines complètent (un parent ne lit que ses enfants ; les données de santé sont réservées à l'infirmerie et à la direction).
- Chiffrement : TLS 1.3 ; AES-256 au repos ; chiffrement applicatif (enveloppe KMS) des colonnes de santé.
- **Audit log** append-only : connexions, exports, consultation de dossiers médicaux, changements de notes ou de rôles.
- Sauvegardes chiffrées toutes les 6 h, PITR, test de restauration mensuel.
- Conformité RGPD / loi 09-08 (CNDP) : registre, consentements, export et suppression sur demande.

## 4. Modules → domaines backend

`identity` (auth, RBAC, sessions) · `school` (niveaux, classes, matières, salles) · `people` (élèves, parents, enseignants) · `timetable` (créneaux, exceptions, remplacements, contrainte d'exclusion anti-conflit) · `attendance` · `assessment` (évaluations, notes, moteur de moyennes, bulletins) · `homework` · `learning` (cours, chapitres, quiz, progression) · `library` · `transport` (bus, lignes, GPS, pointages) · `canteen` · `activities` · `health` · `lostfound` · `documents` · `enrollment` · `finance` · `messaging` · `notifications` · `calendar` · `support` · `analytics` · `ai` · `billing` (SaaS).

## 5. Flux clés

- **Absence** : appel validé → événement `attendance.absent` → file de notifications → push + SMS au parent → justificatif possible depuis l'app.
- **Bus** : le boîtier GPS ou le téléphone de l'accompagnateur envoie une position toutes les 5 s → `bus_positions` (table partitionnée) → diffusion WebSocket aux parents concernés. L'ETA est calculée sur les arrêts restants. Un scan QR/RFID/NFC crée `bus_boardings` et une notification « monté / descendu ».
- **Moyennes** : calcul déterministe selon `tenants.settings.grading` (coefficients, arrondis, meilleure note, classement), recalcul incrémental à chaque note et historisé par période.
- **Paiements** : échéancier → facture → paiement en ligne (webhook) → reçu PDF → relances J+5, J+10, J+20.

## 6. IA intégrée

- Service `ai` côté serveur uniquement. Le navigateur n'appelle jamais le LLM directement.
- Le contexte est construit à partir de données **déjà filtrées par tenant et par rôle**. Les données de santé sont exclues.
- Cas d'usage : génération d'exercices, de quiz et de fiches ; résumé de cours ; analyse d'élève ; rapports de classe et de direction ; FAQ parents (RAG sur le règlement intérieur, le calendrier et les menus).
- Quotas par plan, journalisation des requêtes, aucune donnée utilisée pour l'entraînement.
- Dans le prototype, `assets/js/ai.js` simule ce service avec un moteur d'intentions local. Il suffit de remplacer `AI.answer()` par un appel à `/api/ai/chat`.

## 7. Déploiement

Conteneurs (Docker) sur Kubernetes ou un PaaS managé, PostgreSQL managé multi-AZ, CDN pour les assets, environnements `staging` et `production`, CI avec tests et migrations versionnées.
