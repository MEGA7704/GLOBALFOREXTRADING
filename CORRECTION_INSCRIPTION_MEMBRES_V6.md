# Correction V6 — Inscription autonome des membres

## Interface

Le bouton **S’inscrire** est placé à côté du bouton **Se connecter**. Il ouvre un formulaire demandant le nom complet, l’entreprise ou l’activité, l’adresse e-mail, le mot de passe et sa confirmation.

## Route serveur

`POST /api/register` est protégée par le jeton CSRF et vérifie le mot de passe exclusivement dans `public/_worker.js`. La route impose côté serveur :

- rôle `member` ;
- statut actif ;
- plan `free` ;
- durée de 21 jours ;
- entreprise distincte pour isoler les données ;
- limitation à trois tentatives en quinze minutes par IP et par e-mail ;
- journal `MEMBER_SELF_REGISTERED` dans D1.

Après la création, une session HttpOnly, Secure et SameSite=Lax est ouverte automatiquement.
