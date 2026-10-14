# Assuravia : notes pour Claude

Site de génération de leads assurance et prévoyance pour la Suisse romande (français uniquement).
Le site est statique : `python3 build.py` génère `dist/`, publié par Netlify à chaque push sur `main`.

## Structure
- `build.py` : générateur (Jinja2 + Markdown).
- `content/produits/*.md` : un fichier par produit (champs widgets : `retenir`, `pour_qui`, `quiz`, comme les articles) (carte sur la page Privé ou Pro, entrée de menu
  et page produit générée avec `templates/produit.html`). Un produit avec un champ `url` a une page fixe.
  Groupes et catégories autorisées : `GROUPES` dans `build.py`.
- `templates/pages/` : pages fixes ; le chemin donne l'URL.
- Simulations (parcours en plusieurs écrans) : toutes héritent de `templates/simulation.html` et utilisent les écrans de `templates/partials/etapes.html`. Tarifs : attributs `data-prime-base`, `data-taux-fixe`, `data-taux` (formules), `data-prix-base` × `data-facteur`, options `data-prix`. Un produit pointe vers sa simulation avec le champ `simulateur:` (et `entree: logement` pour commencer par appartement ou maison).
- Charte graphique : `design-system/assuravia/MASTER.md` (couleurs Privé bleu clair, Pro marine et or).
- `templates/pages/lp/` : pages publicitaires (Google Ads), sans menu, `noindex`. Ne jamais les lier depuis le site.
- `content/articles/*.md` : articles du blog, publiés sous `/blog/<nom-du-fichier>/`.
- Formulaires : Netlify Forms. Ne pas renommer les attributs `name` des formulaires existants
  (`rc-pro`, `3e-pilier`, `garantie-loyer`, `demande`, `demande-prive`, `demande-pro`, `contact`, `contact-rapide`, `declaration-impots`, `simulation-menage`, `simulation-rc-privee`, `simulation-protection-juridique`, `simulation-voyage`, `simulation-objets-de-valeur`, `simulation-batiment`, `simulation-rc-pro`, `comparateur-lamal`, `simulation-hospitalisation`, `simulation-ambulatoire`, `simulation-complementaires`, `placements`, `complementaires-rappel`), sinon Netlify crée un nouveau formulaire.

## Comparateur LAMal
- Page `templates/pages/particuliers/comparateur-lamal.html`, script `static/js/comparateur-lamal.js`, données `static/data/lamal/` (une fichier JSON par canton + `index.json`).
- Mise à jour annuelle (fin septembre, quand l'OFSP publie les primes) : télécharger sur opendata.swiss (jeu « Primes de l'assurance-maladie ») `Prämien_CH.csv`, `Tarife.csv`, `Einzugsgebiete.csv`, et sur bag.admin.ch le fichier « Prämienregionen » (XLSX) ; les mettre dans `donnees/ofsp-AAAA/` (non versionné), puis `python3 outils/import_lamal.py donnees/ofsp-AAAA`. Ajouter le nom d'une nouvelle caisse dans `CAISSES` si le script le demande.
- Ne jamais imiter un site fédéral (pas de croix suisse, pas « officiel ») ; citer la source OFSP (licence CC BY).

## Complémentaires maladie
- Pages publiques NEUTRES : aucune référence à un assureur, ni dans les noms, ni dans la structure, ni dans les chiffres. Couverture organisée par besoin (hospitalisation par type de chambre, soins ambulatoires à la carte avec niveau Standard ou Étendu, dentaire par plafond annuel, indemnité par jour, protection juridique santé).
- Grille : `content/complementaires.json` (primes indicatives par âge, sexe, canton). Utilisée par le simulateur de la page Privé (`partials/simulateur-sante.html`) et les trois simulations (hospitalisation, ambulatoire, complète, avec `"lca": True`). Écrans dans `etapes.html` (`profil_sante`, `lca_cartes`, `niveau_amb`, `resultat_lca`). Prime floutée jusqu'aux coordonnées.
- Les pages orientées assureur (Helsana, Assura…) seront des pages publicitaires `templates/pages/lp/`, non liées au site. Grille inspirée d'Helsana conservée dans `archives/complementaires-helsana/`.

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
retenir: 3 à 4 points clés séparés par | (encadré « L'essentiel en 30 secondes »)
produits_lies: slugs de produits séparés par des virgules, par exemple 3e-pilier, placements
quiz: Affirmation | vrai ou faux | Explication ;; Affirmation 2 | … (3 questions, facultatif)
pour_qui: 4 situations « Vous … » séparées par | (widget à cocher, facultatif)
widget: capital-3a (simulateur de capital, facultatif)
---
Corps en Markdown, ## pour les intertitres. Un encadré se fait avec une citation commençant par un titre en gras :
`> **Le saviez-vous ?** Texte…`. L'encart d'appel à l'action s'insère automatiquement avant le 3e intertitre.
```

Règles éditoriales :
- Sujet utile à un lecteur de Suisse romande, en lien avec un produit du site (voir `content/produits/`).
  Alterner particuliers et entreprises, et suivre le calendrier (3e pilier en novembre-décembre,
  déclaration d'impôts en février-mars, LAMal et complémentaires en septembre-novembre).
- 1200 à 2000 mots (le blog peut être long), au moins 4 intertitres, 2 liens internes vers des pages produit,
  un encadré « Le saviez-vous ? », un quiz de 3 questions et une FAQ de 3 questions.
- Titre et description optimisés pour une recherche précise (« rc pro indépendant suisse »…), vouvoiement, phrases courtes, aucun superlatif publicitaire.
- Chaque chiffre (plafonds, taux, délais) est vérifié sur une source officielle ou un assureur
  ou une banque suisse avant publication. En cas de doute, ne pas donner le chiffre.
- Pas de contenu copié : tout est rédigé.
- Ne pas promettre de résultats, ne pas se présenter comme indépendant ou neutre.
- Ton : mettre en avant la qualité des prestations et du conseil, pas le prix. Éviter les accroches du type « vous payez trop cher » ou « au juste prix ».
- Vérifier qu'aucun article existant ne traite déjà le même sujet.
- Lancer `python3 build.py` et vérifier qu'il n'y a pas d'erreur avant de pousser.
- Mettre `brouillon: oui` dans l'en-tête pour préparer un article sans le publier.
- Une section `## Questions fréquentes` suivie de `### Question` et d'un paragraphe de réponse
  devient automatiquement une FAQ dépliable avec données structurées pour Google.
