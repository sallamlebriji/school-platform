# Athénée mobile

Application React Native avec Expo SDK 57 (paquet `expo` fixé à `57.0.0`) et TypeScript, connectée à l’API Express existante.

## Démarrage

Utiliser Node.js 22.13 ou plus (Node 22 LTS recommandé). Le Node 20.15 installé sur cet ordinateur est trop ancien pour le SDK Expo généré.

```powershell
cd mobile
npm install
Copy-Item .env.example .env
npm start
```

Renseigner `EXPO_PUBLIC_API_URL` dans `.env`, puis redémarrer Expo. Cette variable est publique : ne jamais y mettre de secret.

- Téléphone physique : `http://<IPv4-LAN-du-PC>:4000`, téléphone et PC sur le même Wi-Fi. Autoriser le port 4000 dans le pare-feu si nécessaire.
- Émulateur Android : `http://10.0.2.2:4000` (valeur par défaut).
- Simulateur iOS sur Mac : `http://localhost:4000` (valeur par défaut).
- Production : URL HTTPS du domaine de l’établissement. L’API doit résoudre cet établissement par son domaine ; `X-Tenant` dépend de `ALLOW_TENANT_HEADER` et sert au développement.

Lancer aussi `npm --prefix server run dev` depuis la racine, avec une base déjà configurée. Ouvrir le projet avec une version d’Expo Go compatible SDK 57 ou un development build. Les builds iOS locaux exigent macOS.

## Fonctionnalités

- Connexion multi-écoles, code TOTP si activé et déconnexion.
- Accueil familles (enfants, moyenne, devoirs, factures), direction (indicateurs), enseignants (cours du jour).
- Consultation des devoirs et de leurs statuts.
- Planning avec sélection de classe et exceptions de cours.
- Lecture des conversations existantes et envoi de messages.
- Notifications de l’API et marquage comme lues.
- Profil ; navigation filtrée par les permissions retournées par l’API.

Glisser vers le bas pour actualiser. Les messages entrants et les notifications sont récupérés lors de l’ouverture ou de l’actualisation. Cette version ne fournit pas encore les push natifs, le temps réel, le dépôt de fichiers, les paiements, la création de conversations ou toutes les fonctions d’administration web. L’interface est en français.

Le jeton d’accès reste en mémoire. Le renouvellement utilise le cookie HTTP-only existant, avec un seul appel de refresh pour les requêtes simultanées. La persistance des cookies dépend de la plateforme : cette version demande une connexion à chaque démarrage et ne garantit pas une session durable sur mobile. Pour une session persistante native, prévoir un protocole refresh dédié avec stockage sécurisé et tests sur appareils.

## Vérification

Le projet conserve la version exacte `expo@57.0.0` demandée, avec `react-native@0.86.0` indiqué dans son fichier `bundledNativeModules.json`. `expo install --check` recommande actuellement les correctifs plus récents `expo@~57.0.26` et `react-native@0.86.3` ; ce contrôle signale donc un écart de versions. Ne pas appliquer `expo install --fix` sans accepter de changer cette contrainte de version exacte.

Vérifications effectuées avec Node 24 : TypeScript réussi et export des bundles Android/iOS réussi. Cela ne remplace pas les tests sur appareil ni une compilation native APK/IPA.

L’audit initial des dépendances signale 23 vulnérabilités (7 modérées, 16 élevées). Examiner `npm audit` avant une livraison ; ne pas appliquer aveuglément `--force`, qui propose des changements majeurs du SDK.

```powershell
npm run typecheck
npx expo export --platform android --platform ios
```

Parcours manuel avec l’API et la base de démo : connexion parent, sélection de chaque enfant dans Planning, consultation des devoirs, lecture et envoi d’un message, marquage des alertes, déconnexion. Refaire avec enseignant, direction et chauffeur pour vérifier les modules autorisés. Tester également mauvais mot de passe, TOTP, API hors ligne et expiration de session. Les comptes de démonstration sont décrits dans le README à la racine.

Référence du SDK utilisé : [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).
