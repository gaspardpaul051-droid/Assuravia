-- Leads mis de côté (à lancer dans Supabase > SQL Editor > New query > Run ; peut être relancé sans risque).
-- Un lead qui remplit les critères d'une règle active (type de lead, prime estimée au moins …, chiffre d'affaires au moins …)
-- n'est attribué à aucun conseiller : il est rangé sous « Admin » (leads.reserve = true) pour être traité à part.

alter table public.leads add column if not exists reserve boolean not null default false;
alter table public.leads add column if not exists reserve_raison text;

create table if not exists public.regles_reserve (
  id bigint generated always as identity primary key,
  nom text not null default '',
  prime_min numeric(12,2),
  ca_min numeric(14,2),
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);
alter table public.regles_reserve add column if not exists produit text; -- vide : tous les produits
alter table public.regles_reserve enable row level security;
drop policy if exists regles_reserve_admin on public.regles_reserve;
create policy regles_reserve_admin on public.regles_reserve for all to authenticated using (public.est_admin()) with check (public.est_admin());
