# Correction du build Cloudflare Pages

## Cause de l’échec

Le dépôt GitHub contenait encore `public/_redirects`. Un téléversement de nouveaux fichiers dans GitHub ne supprime pas automatiquement un ancien fichier absent du nouveau ZIP.

## Correction intégrée

Les scripts `npm run check` et `npm run build` suppriment désormais automatiquement `public/_redirects` dans l’environnement de build avant la publication. Le Worker reste l’unique gestionnaire de `/login`, `/app` et `/plan-expired`.

## Configuration Cloudflare exacte

- Framework preset : `None`
- Build command : `npm run build`
- Build output directory : `public`
- Root directory : vide
- Production branch : `main`
- Node.js : `20` ou version supérieure

## Nettoyage recommandé dans GitHub

Supprimer définitivement `public/_redirects` du dépôt reste recommandé, même si le build le neutralise automatiquement.
