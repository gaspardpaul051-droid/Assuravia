# Assuravia : notes pour Claude

Site de génération de leads assurance et prévoyance pour la Suisse romande (français uniquement).
Le site est statique : `python3 build.py` génère `dist/`, publié par Netlify à chaque push sur `main`.

## Structure
- `build.py` : générateur (Jinja2 + Markdown).
- `content/produits/*.md` : un fichier par produit (champs widgets : `retenir`, `pour_qui`, `quiz`, comme les articles) (carte sur la page Privé ou Pro, entrée de menu
  et page produit générée avec `templates/produit.html`). Un produit avec un champ `url` a une page fixe.
  Groupes et catégories autorisées : `GROUPES` dans `build.py`.
- `templates/pages/` : pages fixes ; le chemin donne l'URL.
- Simulations (parcours en plusieurs écrans) : toutes héritent de `templates/simulation.html` et utilisent les écrans de `templates/partials/etapes.html`. Tarifs : attributs `data-prime-base`, `data-taux-fixe`, `data-taux` (formules), `data-prix-base` × `data-facteur`, options `data-prix`. Écran `coordonnees` : téléphone et e-mail obligatoires avant d'afficher la prime (bouton « Voir ma prime », qui envoie la demande ; plus d'option sans coordonnées). Un produit pointe vers sa simulation avec le champ `simulateur:` (et `entree: logement` pour commencer par appartement ou maison). Conversion : la simulation commence par une question simple (logement, secteur, type de bien) et demande le nom avec le téléphone et l'e-mail (`coordonnees(nom_prenom=True)`), jamais en premier ; options payantes regroupées sur un écran à cocher (`e.options`), code postal seul (`e.npa`, champs `logement_npa`, `logement_localite`) ; message d'encouragement avant la prime (`data-funnel-encourage`) ; les étapes déjà répondues sur la page produit (`?logement=`, `?secteur=…&passer=secteur`) sont sautées, même la première. Sur mobile, les pages produit avec simulateur (`hero-produit--direct`) affichent le bloc de départ juste sous le titre et une barre « Calculer ma prime » fixe en bas (`partials/barre-cta.html`). « Être rappelé dans la journée » : une seule fenêtre sur toutes les pages (`partials/rappel-rapide.html`, incluse dans `base.html`, formulaire `demande`), ouverte par `rr.bouton(produit, accroche, choix, question)` (bouton présent sur chaque page produit, simulation, 3e pilier, garantie de loyer, comparateurs LAMal et hypothécaire, RC pro) ; un produit peut définir `accroche_rappel` et `rappel_choix` (choix séparés par |).
- Charte graphique : `design-system/assuravia/MASTER.md` (couleurs Privé bleu clair, Pro marine et or).
- `templates/pages/lp/` : pages publicitaires (Google Ads), sans menu (`landing = true`), `noindex`. Ne jamais les lier depuis le site. Exception : `lp/complementaire-sante` garde le menu et tous les liens du site, marque Assuravia comme tout le site (ne jamais afficher un autre nom) ; formules économiques à la carte, sans nommer d'assureur. Contenu sur la page, simulateur à part (`lp/complementaire-sante/simulation`, grille `content/complementaires-eco.json` passée par `{% set complementaires = complementaires_eco %}`).
- Formulaire sur une page à part : un produit avec `demande_titre`, `demande_texte`, `demande_points` affiche un bouton vers `<url>demande/` (page dans `templates/pages/.../demande.html`). Formulaires en étapes : `{% from "partials/questions.html" import question %}` dans une zone `data-etapes`.
- Pages de demande Pro (sans prime) : `templates/pages/entreprises/<slug>/demande.html` définit `slug`, `form_nom`, `h1`, `chapeau` et la liste `questions`, puis hérite de `templates/demande-pro.html`. Jamais de formulaire directement sur une page produit : un bouton mène à la page de demande ou à la simulation.
- SEO : titre de page de 60 caractères au plus avec « | Assuravia » (champ `titre_seo` pour produits et articles), description de 120 à 160 caractères, un seul h1. Les pages de demande sont `noindex` et hors du sitemap.
- Adresse : macro `f.adresse(prefixe)`, quatre champs saisis à la main (rue, n°, NPA, localité), sans suggestions automatiques (choix du propriétaire du site).
- Page 3e pilier (`templates/pages/particuliers/3e-pilier.html`) : sommaire latéral, simulateur en haut, demande en étapes (`3e-pilier/demande.html`, formulaire `3e-pilier` : besoin, statut, famille, revenu, impôts, fortune, 3a actuel, épargne, risque, priorités). Les champs sont aussi déclarés (désactivés) dans `partials/form-3a.html` pour Netlify.
- Capture des leads : tout formulaire `data-lead` est envoyé une première fois en arrière-plan dès que téléphone et e-mail sont valides (`site.js`, champ `statut_envoi` ajouté par `f.ouvrir`), la demande finale est ensuite fusionnée dans l'espace conseillers. Mentionné dans la page confidentialité.
- `content/articles/*.md` : articles du blog, publiés sous `/blog/<nom-du-fichier>/`.
- Formulaires : Netlify Forms. Ne pas renommer les attributs `name` des formulaires existants
  (`rc-pro`, `3e-pilier`, `garantie-loyer`, `demande`, `demande-prive`, `demande-pro`, `contact`, `contact-rapide`, `declaration-impots`, `simulation-menage`, `simulation-rc-privee`, `simulation-protection-juridique`, `simulation-voyage`, `simulation-objets-de-valeur`, `simulation-batiment`, `simulation-rc-pro`, `comparateur-lamal`, `simulation-hospitalisation`, `simulation-ambulatoire`, `simulation-complementaires`, `placements`, `complementaires-rappel`, `libre-passage`, `vehicule`, `pj-entreprise`, `transport`, `techniques`, `lpp`, `laa`, `perte-de-gain-maladie`, `cyber-entreprise`, `commerce-inventaire`, `vehicules-entreprise`, `hypotheque`, `simulation-sante-eco`), sinon Netlify crée un nouveau formulaire.

## Comparateur LAMal
- Page `templates/pages/particuliers/comparateur-lamal.html`, script `static/js/comparateur-lamal.js`, données `static/data/lamal/` (une fichier JSON par canton + `index.json`).
- Mise à jour annuelle (fin septembre, quand l'OFSP publie les primes) : télécharger sur opendata.swiss (jeu « Primes de l'assurance-maladie ») `Prämien_CH.csv`, `Tarife.csv`, `Einzugsgebiete.csv`, et sur bag.admin.ch le fichier « Prämienregionen » (XLSX) ; les mettre dans `donnees/ofsp-AAAA/` (non versionné), puis `python3 outils/import_lamal.py donnees/ofsp-AAAA`. Ajouter le nom d'une nouvelle caisse dans `CAISSES` si le script le demande.
- Ne jamais imiter un site fédéral (pas de croix suisse, pas « officiel ») ; citer la source OFSP (licence CC BY).

## Comparateur hypothécaire
- Page `templates/pages/particuliers/comparateur-hypothecaire.html`, script `static/js/hypotheque.js`, données `static/data/hypotheques.json` (aussi intégrées au HTML par `build.py`, variable `taux_hypo`).
- Source : BNS, cube `zikrepro` (taux des nouveaux contrats : moyenne, 1er et 3e quartile). Mise à jour automatique chaque lundi par `.github/workflows/taux-hypothecaires.yml`, qui lance `python3 outils/maj_taux_hypothecaires.py` et pousse le JSON s'il a changé. Toujours citer la source BNS.

## Mesure d'audience et contact
- `build.py` : `WHATSAPP` (41782653473), `GA_ID` (Google Analytics 4), `CLARITY_ID` (Microsoft Clarity), `ADS_ID` (balise Google Ads AW-18207426103) et `ADS_CONV` (libellé de la conversion Google Ads « Envoi de formulaire de lead », AW-18207426103/jO1iCPqbhqEdELeM_elD, envoyée par `conversionAds()` dans `site.js` avec le suivi avancé : e-mail et téléphone via `user_data`, mentionné dans la page confidentialité) ; chaque demande envoie aussi `demande_confirmee`, événement clé GA4 repris de l'ancien site, `GSC_VERIF` (Google Search Console). Vides = désactivés. Google (GA et Ads) se charge en mode consentement (Consent Mode v2 : refusé par défaut, signaux sans cookies, passé à « accordé » après « OK ») ; Clarity ne se charge qu'après « OK » dans la fenêtre cookies en bas d'écran, voile léger qui bloque jusqu'au choix (`base.html`, boutons « OK » et « Non merci », pas affichée sur confidentialité et mentions légales) ; lien « Gérer les cookies » dans le pied de page. Les formulaires ont `data-clarity-mask`.
- Éditeur : Assuravia Sàrl, 33 chemin Charles-Poluzzi, 1227 Carouge, info@assuravia.ch. La plateforme transmet les demandes à des compagnies, courtiers et conseillers agréés ; elle n'est pas intermédiaire d'assurance.

## Espace conseillers (CRM des leads)
- Page `/espace/` (`static/espace/` : `index.html`, `espace.css`, `espace.js`), `noindex`, bloquée dans robots.txt, jamais liée depuis le site. `build.py` écrit `dist/espace/config.js` (URL et clé anon Supabase depuis les variables d'environnement, noms des produits).
- Base Supabase : `espace/schema.sql` (tables `conseillers`, `leads`, `commentaires`, règles d'accès : un conseiller ne voit que ses leads, l'admin voit tout). Mise en service : `espace/LISEZMOI.md`.
- Envoi des demandes (`envoyerDemande` dans `site.js`) : d'abord `netlify/functions/lead.mjs` (enregistrement direct, sans le filtre anti-spam de Netlify Forms qui écartait des demandes), puis copie à Netlify Forms marquée `envoi_direct=oui` (archive, ignorée par `submission-created`) ; si l'envoi direct échoue, la copie Netlify crée le lead.
- Logique d'enregistrement commune : `netlify/lib/enregistrer.mjs`, appelée par `lead.mjs` et `submission-created.mjs` : doublon (même e-mail ou téléphone en moins de 3 h) fusionné, sinon attribution au conseiller actif le plus en retard sur son pourcentage (30 derniers jours). Logique dans `netlify/lib/leads.mjs`.
- Règles par source (table `regles`, mise à jour `espace/maj-1-repartition-par-source.sql`) : parts par conseiller pour un formulaire (`form-name`) ou un début d'adresse de page (`/lp/`) ; la page passe avant le formulaire ; sans règle, répartition générale (`conseillers.poids`, comptée sur les seuls leads hors règles). `build.py` liste formulaires et pages dans `config.js`.
- `netlify/functions/espace-admin.mjs` (clé service_role, réservé aux admins) : `supprimer` (ses leads réattribués puis compte supprimé), `creer` (compte avec mot de passe provisoire, `user_metadata.doit_changer` : le conseiller choisit son mot de passe à la première connexion), `provisoire`, `inviter`, `reinitialiser`.
- L'admin peut sélectionner plusieurs leads et les attribuer d'un coup.
- Notifications e-mail : colonne `conseillers.notif_email` (`espace/maj-2-notifications.sql`), réglée par l'admin. Envoi via Resend (`netlify/lib/mail.mjs`, variable `RESEND_API_KEY`) à l'attribution automatique et à l'attribution manuelle (action `notifier` d'`espace-admin`). Lien direct vers une fiche : `/espace/#lead=<id>`.
- Conseillers : onglet « Mes statistiques » simple (`vuePerf` : période ce mois / 30 jours / tout ; leads reçus, contactés, RDV fixés, signés, taux de conversion, RDV → signés, faux numéros, temps de réaction, leads par statut ; pas de points ni de badges). L'admin voit le « Classement du mois » (signés, RDV, taux de conversion). Calculs dans `bilan()`.
- Onglet « Trafic » (admin uniquement, `vueTrafic`) : visites sans cookies (table `visites`, `espace/maj-3-visites.sql`, fonction `netlify/functions/visite.mjs` appelée par `site.js` à chaque arrivée depuis l'extérieur), par canal et comparées aux leads ; campagnes Google Ads reconnues par `gad_campaignid` (table `ADS_CAMPAGNES` dans `espace.js`, à compléter à chaque nouvelle campagne). Le champ caché `gad_campaignid` est aussi envoyé avec chaque demande.
- Statuts : nouveau, en_cours, a_rappeler, injoignable, faux_numero, rdv, offre, signe, pas_interesse, doublon (liste `STATUTS` dans `espace.js`). Un lead « Nouveau » passe automatiquement à « En cours » dès que le conseiller agit (appel, WhatsApp, e-mail, commentaire ou rappel programmé) ; le conseiller choisit ensuite le statut suivant.

## Téléphone
- Indicatifs : `content/indicatifs.txt` (indicatif | pays | code ISO). Drapeaux SVG dans `static/drapeaux/` (flag-icons, licence MIT). Liste à drapeaux construite en JS sur le select, qui reste le champ envoyé.

## Complémentaires maladie
- Pages publiques NEUTRES : aucune référence à un assureur, ni dans les noms, ni dans la structure, ni dans les chiffres. Couverture organisée par besoin (hospitalisation par type de chambre, soins ambulatoires à la carte avec niveau Standard ou Étendu, dentaire par plafond annuel, indemnité par jour, protection juridique santé).
- Grille : `content/complementaires.json` (primes indicatives par âge, sexe, canton). Utilisée par le simulateur de la page Privé (`partials/simulateur-sante.html`) et les trois simulations (hospitalisation, ambulatoire, complète, avec `"lca": True`). Écrans dans `etapes.html` (`profil_sante`, `lca_cartes`, `niveau_amb`, `resultat_lca`). Pas de prix sur les cartes de choix.
- Les pages orientées assureur (Helsana, Assura…) seront des pages publicitaires `templates/pages/lp/`, non liées au site. Grille inspirée d'Helsana conservée dans `archives/complementaires-helsana/`.

## Article hebdomadaire
Publication automatique : tâche planifiée « Article blog Assuravia » (mardi et vendredi à 8 h 53, heure de Zurich) qui rédige, vérifie et pousse un article selon ces règles.

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
`> **Le saviez-vous ?** Texte…`. La couleur suit le titre : « Exemple… » (bleu), « Attention… » ou « Piège… » (orange), « Astuce », « Bon à savoir » ou « Conseil » (vert), sinon or. Deux encadrés ne doivent pas se suivre sans texte entre eux (Markdown les fusionne).
Appel à l'action dans le texte, seul sur sa ligne : `[[cta]]` (reprend cta_titre, cta_url, cta_bouton) ou `[[cta | Phrase d'accroche | /url/ | Texte du bouton]]`.
L'encart d'appel à l'action s'insère aussi automatiquement avant le 3e intertitre.
```

Règles éditoriales :
- Sujet utile à un lecteur de Suisse romande, en lien avec un produit du site (voir `content/produits/`).
  Alterner particuliers et entreprises, et suivre le calendrier (3e pilier en novembre-décembre,
  déclaration d'impôts en février-mars, LAMal et complémentaires en septembre-novembre).
- 1200 à 2000 mots (le blog peut être long), au moins 4 intertitres, 2 liens internes vers des pages produit,
  un encadré « Le saviez-vous ? », un quiz de 3 questions et une FAQ de 3 questions.
- Lecture facile et ludique : phrases courtes, paragraphes de 2 à 4 lignes, listes et tableaux, au moins un exemple concret avec un personnage (« Julie, 34 ans… »), au moins 3 encadrés de types différents (Le saviez-vous, Exemple, Attention, Astuce), 2 à 3 appels à l'action `[[cta | … ]]` répartis dans le texte, chacun avec une accroche orientée bénéfice et un bouton d'action (« Être conseillé gratuitement », « Comparer », « Faire vérifier mon contrat »).
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
