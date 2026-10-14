-- Mise à jour 1 : répartition des leads selon leur source (formulaire ou page).
-- À coller une seule fois dans Supabase > SQL Editor > New query, puis « Run ».
create table if not exists public.regles (
  id bigint generated always as identity primary key,
  source text not null,           -- nom du formulaire (ex. simulation-menage) ou début d'adresse de page (ex. /lp/)
  conseiller_id uuid not null references public.conseillers (id) on delete cascade,
  poids integer not null default 0 check (poids >= 0),
  unique (source, conseiller_id)
);
alter table public.regles enable row level security;
drop policy if exists regles_lire on public.regles;
create policy regles_lire on public.regles for select to authenticated using (true);
drop policy if exists regles_admin on public.regles;
create policy regles_admin on public.regles for all to authenticated using (public.est_admin()) with check (public.est_admin());
