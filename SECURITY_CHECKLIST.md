# Checklist de sécurité appliquée

| Exigence | Implémentation |
|---|---|
| Route réelle `POST /api/login` | Route déclarée et traitée dans `public/_worker.js` |
| Vérification des mots de passe côté serveur | PBKDF2-SHA-256, sel aléatoire et pepper uniquement dans `_worker.js` |
| Aucun hash ou sel dans le navigateur | Les réponses API n’interrogent ni ne renvoient `password_credentials` |
| `/api/load` et `/api/save` protégés | Session KV vérifiée puis utilisateur rechargé depuis D1 |
| Cookie sécurisé | `__Host-fx_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` |
| CSRF obligatoire | Cookie `__Host-fx_csrf` + en-tête `X-CSRF-Token` sur chaque écriture |
| Rôles serveur | `member` et `super_admin`, vérifiés dans `_worker.js` |
| Isolation entreprise | `company_id` vient exclusivement de la session et jamais du corps client |
| Plans et statuts protégés | Modification uniquement par routes `/api/admin/*` |
| Suppression de localStorage | Aucun appel à `localStorage` dans `public/` |
| Limitation des connexions | Compteurs KV distincts par IP et par adresse e-mail, fenêtre de 15 minutes |
| Invalidation de toutes les sessions | Incrément de `session_version` dans D1 + suppression des index KV |
| Gestion des membres | Création, modification, activation, désactivation, reset et suppression Super Admin |
| Audit D1 | Table `audit_logs`, détails sensibles expurgés |
| Migration des anciens hashes | Déplacement de `users.password_hash` vers `password_credentials` dans la migration 0002 |
| Plans | Free 7 jours, Standard 30 jours, Business 365 jours, dates calculées côté serveur |
| Popup Free | Ouverture de l’application, ouverture des sections et rappel toutes les 15 minutes |

- [x] Schéma D1 final initialisé et vérifié automatiquement côté Worker avant toute authentification.
