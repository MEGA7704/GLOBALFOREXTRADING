# Configuration Cloudflare Pages exacte

## Git / Build

| Champ Cloudflare Pages | Valeur exacte |
|---|---|
| Type de projet | Pages — connexion GitHub |
| Framework preset | `None` |
| Production branch | `main` |
| Root directory | `/` — laisser vide si le projet est à la racine du dépôt |
| Build command | `npm run build` |
| Build output directory | `public` |
| Node.js | variable de build `NODE_VERSION=20` |

Le fichier `public/_worker.js` active le mode avancé Cloudflare Pages. Le dossier historique `functions/` a été supprimé pour éviter tout double routage.

## Bindings déjà inscrits dans wrangler.toml

```text
FOREX_KV = 8e8f17076a7840eba723ca071ae8b76a
FOREX_D1 = Forex_d1
D1 ID = c15a88c1-f0c6-4c1d-9807-b29c0c0a25ea
```

## Variables non secrètes

Elles sont déjà déclarées dans `wrangler.toml` :

```text
SUPER_ADMIN_EMAIL=mega@services.local
FREE_PLAN_DAYS=21
BUSINESS_PLAN_DAYS=365
```

## Secrets obligatoires

Créer le projet Pages avant d’exécuter ces commandes :

```bash
npm install
npx wrangler login
npm run secret:pepper
npm run secret:superadmin
```

Lors de `npm run secret:pepper`, saisir un secret long et aléatoire.

Lors de `npm run secret:superadmin`, saisir le mot de passe initial communiqué par le propriétaire du projet. Cette valeur n’est volontairement pas écrite dans GitHub ni dans le ZIP.

## Migration D1

```bash
npm run db:migrate:remote
```

Cette commande applique successivement :

```text
migrations/0001_initial.sql
migrations/0002_security_multitenancy.sql
```

## Déploiement GitHub

Après la configuration des secrets et la migration :

```bash
git add .
git commit -m "Sécurisation Cloudflare KV D1"
git push origin main
```

Cloudflare Pages relance automatiquement le build.

## Déploiement manuel facultatif

```bash
npm run build
npm run deploy
```

## URL de connexion après déploiement

Utilisez exactement :

```text
https://globalforextrading.pages.dev/login
```

N’ajoutez pas `login.html` et ne recréez pas de règle `_redirects` pour `/login`. Cloudflare Pages gère automatiquement l’URL HTML canonique sans extension.

## Vérification après déploiement V4

Ouvrir directement :

```text
https://globalforextrading.pages.dev/login
```

Cette URL doit afficher la page de connexion sans modifier l'adresse en `/login.html`. Le build `npm run build` supprime automatiquement les anciens fichiers HTML de connexion conservés dans le dépôt.

## Initialisation D1 V5

Après le déploiement, ouvrez `/login`. Le Worker initialise automatiquement une base D1 vide avant de traiter la connexion. La commande `npm run db:migrate:remote` reste disponible, mais n’est plus obligatoire pour corriger l’erreur `no such table: users`.

Les secrets `AUTH_PEPPER` et `SUPER_ADMIN_INITIAL_PASSWORD` restent obligatoires.
