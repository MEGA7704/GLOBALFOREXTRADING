# Correction ciblée V16

## Footer
Le footer conserve toutes les informations légales, les contacts, les liens CGU et Politique de confidentialité, mais utilise des espacements, tailles et boutons plus compacts afin de réduire sa hauteur.

## Ancienne page d’accueil
Le fichier `public/index.html`, hérité de l’ancienne interface, est supprimé du projet et également supprimé automatiquement pendant le build s’il réapparaît dans GitHub. La seule page d’accueil publique est `public/internal-pages/home.page`, servie par le Worker sur `/`.
