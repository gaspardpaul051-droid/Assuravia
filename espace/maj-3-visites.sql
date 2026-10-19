-- Compteur de visites sans cookies (à lancer une fois dans Supabase > SQL Editor > New query > Run).
-- Une ligne par arrivée sur le site depuis l'extérieur (pub, moteur, lien, accès direct). Aucune donnée personnelle :
-- ni adresse IP, ni cookie, ni identifiant. Lisible uniquement par l'administrateur (onglet « Trafic »).
create table if not exists public.visites (
  id bigint generated always as identity primary key,
  cree_le timestamptz not null default now(),
  page text,
  source text,
  campagne text,
  terme text,
  campagne_id text,
  gclid boolean not null default false,
  provenance text,
  mobile boolean not null default false
);
create index if not exists visites_cree_le on public.visites (cree_le desc);
alter table public.visites enable row level security;
drop policy if exists visites_admin on public.visites;
create policy visites_admin on public.visites for select to authenticated using (public.est_admin());
