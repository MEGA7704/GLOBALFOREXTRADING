# Correction définitive de la boucle `/login.html` ↔ `/login`

## Cause
Cloudflare Pages applique une canonicalisation automatique aux fichiers `.html`. Dans certains déploiements Advanced Mode, l’appel interne `env.ASSETS.fetch()` sur `/login` peut renvoyer vers `/login.html`, tandis que le Worker renvoie `/login.html` vers `/login`.

## Correction V4
- `login.html` a été remplacé par `public/internal-pages/login.page`.
- `plan-expired.html` a été remplacé par `public/internal-pages/plan-expired.page`.
- Le Worker lit ces fichiers non HTML puis force une réponse `Content-Type: text/html` avec statut `200`.
- Les URL publiques restent `/login` et `/plan-expired`.
- Les accès directs à `/internal-pages/*` retournent `404`.
- `/login.html` ne fait qu’une redirection unique vers `/login`.

Cette architecture ne dépend plus de la canonicalisation HTML de Cloudflare Pages.
