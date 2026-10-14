# Complémentaires maladie : version inspirée de l'offre Helsana (mise de côté)

Grille utilisée du 12 au 14 octobre 2026 par les simulations hospitalisation, ambulatoire et complète.
Les prestations reprenaient la structure et les plafonds de l'offre Helsana (conditions 2026),
reformulés par Assuravia.

Pour la réactiver : copier `complementaires.json` dans `content/`, puis lancer `python3 build.py`.
Le code des simulations (templates, `etapes.html`, moteur dans `static/js/site.js`) est le même
pour les deux versions : seule la grille change. Version de référence dans git : étiquette `complementaires-helsana`.
