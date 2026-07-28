# Correction ciblée de l’interface — V9

Cette version modifie uniquement la présentation et la séparation visuelle des rôles.

## Interface

- identité affichée : **GLOBAL FOREX TRADING** ;
- sous-titre : **Forex Capture Analyzer Edition** ;
- thème vert militaire avec accents dorés et ombres ;
- page de connexion responsive ;
- en-tête unique et menu horizontal unique sur ordinateur ;
- menu adaptatif sans défilement horizontal sur tablette et mobile ;
- suppression de l’ancien en-tête dupliqué ;
- suppression des boutons légaux situés sous la grande carte ;
- alignement et lisibilité renforcés.

## Séparation des rôles

- le membre conserve l’intégralité de l’application de trading ;
- le Super Admin ne voit plus l’espace de trading ;
- le Super Admin accède directement à une page de gestion des membres ;
- les fonctions existantes de création, modification, activation, désactivation, plan, réinitialisation et suppression restent inchangées ;
- le journal sensible et l’état du système restent accessibles.

## Éléments non modifiés

- routes API ;
- authentification ;
- sécurité CSRF ;
- cookies de session ;
- bindings KV et D1 ;
- schéma et migrations D1 ;
- logique d’analyse Forex ;
- plans Free et Business.
