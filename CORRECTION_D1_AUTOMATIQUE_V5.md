# Correction D1 automatique — V5

Cette version corrige l’erreur :

```text
D1_ERROR: no such table: users
```

## Fonctionnement

`public/_worker.js` exécute désormais `ensureDatabaseSchema()` avant toute authentification ou route API.

Au premier appel après déploiement, le Worker :

1. vérifie si la table `users` existe ;
2. crée automatiquement le schéma D1 final si la base est vide ;
3. crée `companies`, `users`, `password_credentials`, `analyses`, `audit_logs`, `company_data` et `app_schema_meta` ;
4. crée les index nécessaires ;
5. vérifie que `password_hash` n’est pas stocké dans la table générale `users` ;
6. migre automatiquement l’ancien schéma V1 lorsqu’il est détecté ;
7. permet ensuite la création du Super Admin lors de sa première connexion.

L’initialisation est idempotente : `CREATE TABLE IF NOT EXISTS` et `CREATE INDEX IF NOT EXISTS` empêchent la duplication des structures.

## Après déploiement

Aucune commande de migration n’est obligatoire pour une base D1 vide. Les migrations Wrangler restent disponibles pour l’administration manuelle :

```bash
npm run db:migrate:remote
```

Le secret `AUTH_PEPPER` et le secret `SUPER_ADMIN_INITIAL_PASSWORD` doivent toujours être configurés dans Cloudflare.
