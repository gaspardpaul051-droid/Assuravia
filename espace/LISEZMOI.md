# Espace conseillers : mise en service

1. Créer un projet gratuit sur supabase.com (région Europe, par exemple Zurich ou Francfort).
2. SQL Editor > New query : coller `espace/schema.sql`, puis Run.
3. Authentication > URL Configuration : Site URL = `https://assuravia.ch/espace/`, et ajouter la même adresse dans Redirect URLs.
4. Authentication > Users > Add user > Create new user : votre e-mail et un mot de passe, cocher « Auto confirm ». Le premier compte devient administrateur.
5. Project Settings > API : copier Project URL, la clé `anon` et la clé `service_role`.
6. Netlify > Site configuration > Environment variables : ajouter
   - `SUPABASE_URL` (Project URL)
   - `SUPABASE_ANON_KEY` (clé anon, publique)
   - `SUPABASE_SERVICE_ROLE_KEY` (clé service_role, secrète : seulement dans Netlify)
   puis Deploys > Trigger deploy.
7. Ouvrir https://assuravia.ch/espace/, se connecter, onglet « Conseillers et répartition » : inviter les conseillers et régler les pourcentages.

Chaque demande envoyée sur le site (Netlify Forms) déclenche `netlify/functions/submission-created.mjs`, qui crée le lead et l'attribue.
Les e-mails de notification Netlify continuent de fonctionner en parallèle.

## Mises à jour de la base
- `maj-1-repartition-par-source.sql` : répartition par page ou formulaire. À exécuter une fois dans Supabase › SQL Editor (inutile si `schema.sql` a été exécuté après cette mise à jour).
