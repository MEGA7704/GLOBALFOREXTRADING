# Correction ciblée de la page de connexion — V11

## Interface

- Titres « GLOBAL FOREX TRADING » et sous-titres centrés dans les deux panneaux.
- Suppression de « ÉDITION SÉCURISÉE CLOUD ».
- Remplacement de la description du panneau gauche par la présentation demandée.
- Suppression des quatre cartes KV, D1, CSRF et PRO.
- Suppression du message d’avertissement financier.
- Suppression du logo GT dans la section principale de connexion.
- Centrage de « ESPACE SÉCURISÉ », « Connexion » et du texte d’accès.
- Centrage des boutons « Se connecter » et « S’inscrire ».
- Suppression de la carte « Nouveau membre / 21 jours ».

## Mot de passe oublié

Le lien « Mot de passe oublié ? » ouvre un formulaire modal dédié.
La demande est enregistrée dans D1 par la route :

```text
POST /api/password-reset-request
```

La route impose un jeton CSRF et une limitation de trois demandes par période de quinze minutes, par adresse IP et par compte.
La réponse publique ne confirme jamais l’existence d’un compte.

Le Super Admin consulte les demandes dans « Demandes mot de passe ». Il peut :

- réinitialiser le mot de passe du membre ;
- marquer la demande comme traitée ;
- ignorer la demande.

La table D1 `password_reset_requests` est créée automatiquement par le Worker et par la migration `0004_password_reset_requests.sql`.
