# Correction V17 — Authentification exclusivement en popup

- Connexion, inscription et mot de passe oublié sont intégrés à la page d’accueil.
- Aucun clic de connexion ou d’inscription n’ouvre une page séparée.
- `/login` et `/login.html` redirigent vers `/?auth=login` ou `/?auth=register`.
- L’ancienne ressource `public/internal-pages/login.page` et ses assets dédiés ont été supprimés.
- Les routes API, D1, KV, CSRF, cookies et règles de sécurité sont inchangés.
