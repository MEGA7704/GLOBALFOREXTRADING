# Correction connexion professionnelle V7

## Interface
- Le formulaire d'inscription n'est plus affiché dans la carte de connexion.
- Il s'ouvre uniquement après un clic sur **S'inscrire** dans une fenêtre modale professionnelle.
- Les boutons **Se connecter** et **S'inscrire** restent côte à côte.
- Les fichiers `login.css` et `login.js` utilisent une version d'URL et sont servis sans cache afin d'éviter le mélange d'anciens styles avec le nouveau HTML.

## Connexion Cloudflare
- PBKDF2-SHA-256 utilise exactement **100 000 itérations**, limite prise en charge par l'environnement constaté.
- Les nouveaux comptes et réinitialisations utilisent ce format.
- Si un ancien compte membre contient un hash supérieur à la limite, le serveur demande une réinitialisation par le Super Admin.
- Si le Super Admin possède un ancien hash incompatible, son identifiant peut être réparé automatiquement avec le secret `SUPER_ADMIN_INITIAL_PASSWORD` lors de la connexion initiale.
