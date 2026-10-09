# Assuravia : charte graphique

Les jetons sont dans `static/css/site.css` (`:root`, `.theme-prive`, `.theme-pro`).
Aucune couleur en dur dans les composants : toujours passer par les jetons.

## Logo
- Écusson marine (#0B2545), filet or (#C9A227), monogramme « A » or clair (#E2BE52).
- Versions : `static/marque/logo-horizontal.svg` (fond clair), `logo-inverse.svg` (fond marine),
  `embleme.svg` (écusson seul, favicon, avatars). Dans le site, le logo est intégré en ligne
  (`templates/partials/logo.html`) pour utiliser la police du site.
- Zone de protection : la largeur du « A » tout autour. Taille minimale de l'écusson : 16 px.

## Couleurs
| Rôle | Jeton | Valeur | Règle |
|---|---|---|---|
| Marque, titres, Pro | `--marine` | #0B2545 | Texte 15.6:1 sur blanc |
| Accent Pro | `--or` | #C9A227 | Décoratif uniquement (bandes, filets) |
| Bouton d'action | `--or-clair` | #E2BE52 | Toujours avec texte marine (8.4:1) |
| Texte or | `--or-texte` | #8A6D10 | Seule nuance d'or pour du texte sur blanc |
| Privé, liens | `--bleu` | #1565A8 | Texte 5.9:1 sur blanc |
| Accent Privé | `--bleu-vif` | #3A9AE0 | Décoratif (bandes, pastilles) |
| Fonds Privé | `--bleu-pale` | #EAF4FD | Fonds de sections et d'icônes |
| Texte | `--texte` / `--texte-doux` | #14213D / #4E5D73 | |
| Fond / surface | `--fond` / `--surface` | #FFFFFF / #F5F8FC | |
| Erreur | `--erreur` | #B42318 | Toujours accompagnée d'un texte |

### Distinction Privé / Pro
- Chaque page déclare son univers : `{% block theme %}prive{% endblock %}` ou `pro`.
- Privé : bleu clair, ambiance accessible. Cartes avec quatre bleus selon la catégorie.
- Pro : marine et or, ambiance corporate. Icônes or sur pastille marine, boutons marine à texte or.
- Le bouton d'action principal (or clair, texte marine) est le même dans les deux univers.

## Typographie
- Plus Jakarta Sans pour tout le site : 800 pour h1, 700 pour h2/h3 et boutons, 600 pour les libellés, 400 pour le texte.
- Corps 17 px, interligne 1.65. Échelle : 14 / 16 / 17 / 20 / 24 / 26-34 / 32-50.

## Composants
- Carte produit : bande de couleur en haut, badge or en haut à droite, icône dans un rond,
  titre de couleur, description, 3 points avec coches, bouton pleine largeur.
- Icônes au trait (24 px, trait 2) dans `templates/partials/icones.html`. Jamais d'emoji.
- Formulaires : libellés visibles, champs de 50 px, erreur sous le champ, formulaires longs en étapes.
- Une seule action principale par écran.

## Règles d'accessibilité
- Contraste texte 4.5:1 minimum, éléments d'interface 3:1.
- Cibles tactiles de 44 px minimum, focus visible, mouvement réduit respecté.
- Aucun défilement horizontal à 375 px.
