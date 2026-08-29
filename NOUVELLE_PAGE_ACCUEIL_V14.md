# V14 — Page d’accueil et nouvelles formules

## Accueil
- `/` devient une page d’accueil publique professionnelle.
- `/app` reste l’espace applicatif protégé.
- `/login` reste la page de connexion sécurisée.
- Le bouton « S’inscrire » de l’accueil ouvre `/login?register=1&next=/app`.
- L’accueil est responsive sans défilement horizontal.

## Formules
- Free : 7 jours — 0 FCFA.
- Standard : 30 jours — 20 600 FCFA.
- Business : 365 jours — 100 600 FCFA.

La table `company_subscriptions` est ajoutée afin de supporter le plan Standard sans casser les anciennes bases D1 dont la table `companies` limitait historiquement `plan_code` à Free/Business.

## Paiement
- Standard : lien Wave avec montant 20 600 FCFA.
- Business : lien Wave avec montant 100 600 FCFA.
- L’activation effective du plan reste une action serveur/Super Admin.

## Sécurité conservée
Les sessions KV, cookies HttpOnly/Secure/SameSite=Lax, CSRF, rôles, séparation des entreprises, journal D1 et contrôles de mots de passe ne sont pas supprimés.
