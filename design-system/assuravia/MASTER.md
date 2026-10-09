# Assuravia : système de design

Direction : plateforme d'assurance, « confiance + conversion » (style accessible et plat).
Les jetons sont dans `static/css/site.css` (`:root`). Ne pas utiliser de couleur en dur dans les composants.

## Couleurs
| Jeton | Valeur | Usage |
|---|---|---|
| `--primaire` | #0369A1 | Liens, icônes, états actifs (5.9:1 sur blanc) |
| `--primaire-fonce` | #0C4A6E | Titres, bandeau, encarts de résultat |
| `--action` | #15803D | Uniquement les boutons d'action (texte blanc 5.0:1) |
| `--teinte` / `--teinte-forte` | #F0F9FF / #E0F2FE | Fonds de sections alternées, pastilles d'icônes |
| `--texte` / `--texte-doux` | #102A43 / #486581 | Corps de texte / texte secondaire |
| `--bordure` / `--bordure-champ` | #CFE3F1 / #8AA6BD | Cartes / contrôles de formulaire (3:1) |
| `--erreur` | #B91C1C | Messages d'erreur, toujours avec du texte |

## Typographie
- Titres : Lexend 600-700. Corps : Source Sans 3, 17 px, interligne 1.6.
- Échelle : 14 / 16 / 17 / 20 / 24 / 26-32 / 32-48.

## Composants
- Une seule action principale verte par écran.
- Cartes produit : icône au trait (24 px, trait 2) dans une pastille bleue claire, rayon 12 px.
- Formulaires : libellé visible, erreur sous le champ (liée par `aria-describedby`), champs de 48 px,
  formulaires longs en étapes avec barre de progression.
- Icônes : `templates/partials/icones.html`, jamais d'emoji.

## Règles
- Cibles tactiles de 44 px minimum, focus visible, mouvement réduit respecté.
- Aucun défilement horizontal à 375 px.
