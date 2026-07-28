# Correction inscription membre V8

## Problème corrigé

Le navigateur pouvait recopier automatiquement l’adresse de connexion du Super Admin dans le champ e-mail de la fenêtre d’inscription. Le serveur refusait alors logiquement cette adresse avec le message « Cette adresse est réservée à l’administration ».

## Corrections

- Le formulaire d’inscription est vidé à chaque ouverture.
- Le champ e-mail d’inscription n’utilise plus l’autocomplétion du compte de connexion.
- Le serveur ne réserve que l’adresse exacte définie par `SUPER_ADMIN_EMAIL`.
- Aucun domaine complet n’est interdit aux membres.
- L’erreur précise désormais qu’il faut utiliser une autre adresse e-mail membre.
- Le compte membre reçoit automatiquement le rôle `member` et le plan Free de 21 jours.

## Exemple

- Réservée : `mega@services.local`
- Autorisées : `membre@gmail.com`, `entreprise@exemple.ci`, `utilisateur@services.local`
