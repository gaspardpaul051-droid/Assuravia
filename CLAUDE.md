# Assuravia : notes pour Claude

Site de génération de leads assurance et prévoyance pour la Suisse romande (français uniquement).
Le site est statique : `python3 build.py` génère `dist/`, publié par Netlify à chaque push sur `main`.

## Structure
- `build.py` : générateur (Jinja2 + Markdown).
- `content/produits/*.md` : un fichier par produit (carte sur la page Privé ou Pro, entrée de menu
  et page produit générée avec `templates/produit.html`). Un produit avec un champ `url` a une page fixe.
  Groupes et catégories autorisées : `GROUPES` dans `build.py`.
- `templates/pages/` : pages fixes ; le chemin donne l'URL.
- Charte graphique : `design-system/assuravia/MASTER.md` (couleurs Privé bleu clair, Pro marine et or).
- `templates/pages/lp/` : pages publicitaires (Google Ads), sans menu, `noindex`. Ne jamais les lier depuis le site.
- `content/articles/*.md` : articles du blog, publiés sous `/blog/<nom-du-fichier>/`.
- Formulaires : Netlify Forms. Ne pas renommer les attributs `name` des formulaires existants
  (`rc-pro`, `3e-pilier`, `garantie-loyer`, `demande`, `demande-prive`, `demande-pro`, `contact`, `contact-rapide`), sinon Netlify crée un nouveau formulaire.

## Article hebdomadaire
Format d'un article (`content/articles/<slug-court-sans-accents>.md`) :

```
---
titre: Titre de 50 à 65 caractères, mot-clé principal au début
description: Résumé de 140 à 160 caractères
date: AAAA-MM-JJ
categorie: Prévoyance | Entreprises | Logement | Santé | Véhicule | Impôts
cta_titre: Titre de l'encart final
cta_texte: Une phrase
cta_url: la page produit la plus proche, par exemple /particuliers/3e-pilier/ ou /entreprises/lpp/
cta_bouton: Texte du bouton
---
Corps en Markdown, ## pour les intertitres.
```

Règles éditoriales :
- Sujet utile à un lecteur de Suisse romande, en lien avec un produit du site (voir `content/produits/`).
  Alterner particuliers et entreprises, et suivre le calendrier (3e pilier en novembre-décembre,
  déclaration d'impôts en février-mars, LAMal et complémentaires en septembre-novembre).
- 900 à 1500 mots, vouvoiement, phrases courtes, aucun superlatif publicitaire.
- Chaque chiffre (plafonds, taux, délais) est vérifié sur une source officielle ou un assureur
  ou une banque suisse avant publication. En cas de doute, ne pas donner le chiffre.
- Pas de contenu copié : tout est rédigé.
- Ne pas promettre de résultats, ne pas se présenter comme indépendant ou neutre.
- Vérifier qu'aucun article existant ne traite déjà le même sujet.
- Lancer `python3 build.py` et vérifier qu'il n'y a pas d'erreur avant de pousser.
- Mettre `brouillon: oui` dans l'en-tête pour préparer un article sans le publier.
- Une section `## Questions fréquentes` suivie de `### Question` et d'un paragraphe de réponse
  devient automatiquement une FAQ dépliable avec données structurées pour Google.
