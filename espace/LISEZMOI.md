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
- `maj-2-notifications.sql` : colonne `notif_email` (notifications par e-mail). À exécuter une fois.

## Notifications par e-mail des nouveaux leads
L'administrateur choisit, conseiller par conseiller, qui reçoit un e-mail à chaque lead attribué
(colonne « Notif. e-mail » dans « Conseillers et répartition »). L'e-mail part aussi quand l'admin attribue un lead à la main.
Envoi par Resend (gratuit jusqu'à 3000 e-mails par mois) :
1. Créer un compte sur resend.com, puis Domains > Add domain : `assuravia.ch`. Ajouter chez l'hébergeur DNS du domaine les enregistrements indiqués (DKIM, SPF), puis « Verify ».
2. API Keys > Create API key (droit « Sending access »).
3. Netlify > Environment variables : `RESEND_API_KEY` = la clé. Facultatif : `MAIL_EXPEDITEUR` (par défaut `Assuravia <leads@assuravia.ch>`).
4. Deploys > Trigger deploy.
Le lien « Ouvrir la fiche » de l'e-mail ouvre directement le lead dans l'espace.

## Conseillers à la pièce (solde)
Lancez une fois `espace/maj-4-conseillers-piece.sql` dans Supabase (SQL Editor > New query > Run). Ensuite, dans « Conseillers et répartition », section « Formule et solde » : choisissez « À la pièce » et ajoutez du crédit. Chaque lead attribué est déduit du solde à sa valeur (CHF 50 par défaut ; l'admin la change dans la fiche du lead pour un super lead) ; un lead réattribué ou supprimé est remboursé.

## Leads mis de côté
Lancez une fois `espace/maj-5-mise-de-cote.sql` dans Supabase (SQL Editor > New query > Run). Les règles se créent dans « Conseillers et répartition », section « Leads mis de côté (Admin) ».

## Suivi du mois (objectif, plafond par jour, types de leads)

Lancez une fois `espace/maj-6-suivi-du-mois.sql` dans Supabase (SQL Editor). L'onglet « Conseillers et répartition » affiche alors une case par conseiller : budget ou solde, rythme du mois, leads reçus, leads encore possibles, objectif du mois et plafond par jour. Le plafond par jour est respecté par l'attribution automatique : une fois atteint, le conseiller ne reçoit plus de lead jusqu'au lendemain. Les types de leads limitent ce qu'il reçoit (par exemple seulement RC pro et ménage) ; sans type choisi, il reçoit tout. Le script est relançable : relancez-le si vous l'aviez lancé avant l'ajout des types de leads.
