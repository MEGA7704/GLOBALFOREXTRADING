# Forex Capture Analyzer Pro — Cloudflare Pages sécurisé

Version 2.0 convertie en projet GitHub + Cloudflare Pages **Advanced Mode** avec routeur serveur unique dans `public/_worker.js`.

## Corrections de sécurité appliquées

- vraie route serveur `POST /api/login` ;
- vérification et hachage des mots de passe uniquement dans `public/_worker.js` ;
- aucun hash, sel ou donnée d’authentification sensible renvoyé au navigateur ;
- routes `GET /api/load` et `POST /api/save` protégées par session ;
- cookie de session `HttpOnly; Secure; SameSite=Lax` ;
- jeton CSRF obligatoire sur toutes les écritures, y compris connexion et déconnexion ;
- rôles serveur `member` et `super_admin` ;
- données D1 toujours filtrées par `company_id` issu de la session ;
- plans, statuts et rôles impossibles à modifier via `/api/save` ;
- aucune utilisation de `localStorage` ;
- limitation pendant 15 minutes, séparément par adresse IP et par compte ;
- invalidation de toutes les sessions par `session_version` après changement ou réinitialisation du mot de passe ;
- création, modification, activation, désactivation, réinitialisation et suppression des membres réservées au Super Admin ;
- journal des actions sensibles dans `audit_logs` ;
- anciens hashes déplacés vers la table dédiée `password_credentials` par la migration `0002_security_multitenancy.sql`.

## Super Admin initial

```text
E-mail : mega@services.local
```

Le mot de passe initial doit être ajouté comme secret Cloudflare `SUPER_ADMIN_INITIAL_PASSWORD`. Il n’est volontairement pas écrit dans le dépôt GitHub. Lors de la première connexion réussie, `public/_worker.js` crée le Super Admin et stocke uniquement son empreinte PBKDF2 dans D1.

Après la première connexion, utilisez **Compte → Changer mon mot de passe**, puis vous pouvez supprimer le secret initial :

```bash
npx wrangler pages secret delete SUPER_ADMIN_INITIAL_PASSWORD --project-name=forex-capture-analyzer-pro
```

## Plans membres

### Plan Free

- accès complet à l’application ;
- durée : **21 jours** ;
- popup professionnel à l’ouverture de l’application, à l’ouverture des sections et toutes les 15 minutes ;
- boutons **Compris** et **Acheter mon plan Business**.

### Plan Business

- accès complet à l’application ;
- durée : **365 jours** ;
- aucun popup promotionnel Free.

Lien de paiement configuré côté interface :

```text
https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=365000
```

L’achat n’active pas automatiquement le compte. Le Super Admin confirme ensuite le plan Business dans sa section d’administration.

## Section Super Admin

Le bouton **Super Admin** apparaît uniquement pour le rôle `super_admin`. Il permet de :

- créer un compte membre et son entreprise isolée ;
- choisir Free 21 jours ou Business 365 jours ;
- modifier le nom, l’e-mail et l’entreprise ;
- activer ou désactiver un membre ;
- assister un mot de passe perdu en imposant un nouveau mot de passe ;
- invalider automatiquement toutes les sessions du membre ;
- supprimer le compte et ses données ;
- consulter les actions sensibles enregistrées dans D1.

## Bindings Cloudflare

```text
KV binding : FOREX_KV
KV ID      : 8e8f17076a7840eba723ca071ae8b76a

D1 binding : FOREX_D1
D1 name    : Forex_d1
D1 ID      : c15a88c1-f0c6-4c1d-9807-b29c0c0a25ea
```

## Installation

```bash
npm install
npx wrangler login
npm run db:migrate:remote
npm run secret:pepper
npm run secret:superadmin
npm run check
npm run build
```

Pour `secret:superadmin`, saisir le mot de passe initial convenu. Pour `secret:pepper`, saisir un secret différent, long et aléatoire.

## Configuration Build exacte

Consultez [`CLOUDFLARE_BUILD_EXACT.md`](CLOUDFLARE_BUILD_EXACT.md).

Résumé :

```text
Framework preset       : None
Production branch      : main
Root directory         : vide ou /
Build command          : npm run build
Build output directory : public
Build variable         : NODE_VERSION=20
```

## Développement local

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Le cookie de production impose `Secure`. Le contrôle final de connexion doit donc être effectué sur l’URL HTTPS Cloudflare Pages.

## Arborescence

```text
public/
  _worker.js             Routeur, authentification et sécurité serveur
  index.html             Application
  login.html             Connexion
  plan-expired.html      Échéance d’abonnement
  assets/                Interface navigateur
migrations/
  0001_initial.sql
  0002_security_multitenancy.sql
scripts/
wrangler.toml
package.json
CLOUDFLARE_BUILD_EXACT.md
```

## Remarque

L’application reste un outil éducatif d’aide à l’analyse. Elle ne garantit aucun résultat financier.
