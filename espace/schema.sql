-- Espace conseillers Assuravia : base de données Supabase.
-- À coller une seule fois dans Supabase > SQL Editor > New query, puis « Run ».
-- Le premier compte créé dans Authentication devient automatiquement administrateur.

-- ---------- Conseillers ----------
create table if not exists public.conseillers (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text not null default '',
  email text,
  telephone text,
  role text not null default 'conseiller' check (role in ('admin', 'conseiller')),
  poids integer not null default 1 check (poids >= 0),
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);

create or replace function public.est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conseillers where id = auth.uid() and role = 'admin');
$$;

-- Chaque nouveau compte crée sa fiche conseiller ; le tout premier est administrateur.
create or replace function public.nouveau_compte() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.conseillers (id, email, nom, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nom', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.conseillers) then 'conseiller' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists apres_nouveau_compte on auth.users;
create trigger apres_nouveau_compte after insert on auth.users
  for each row execute function public.nouveau_compte();

-- ---------- Leads ----------
create table if not exists public.leads (
  id bigint generated always as identity primary key,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  formulaire text,
  produit text,
  page text,
  prenom text,
  nom text,
  email text,
  telephone text,
  canton text,
  prime text,
  donnees jsonb not null default '{}'::jsonb,
  conseiller_id uuid references public.conseillers (id) on delete set null,
  statut text not null default 'nouveau',
  rappel_le timestamptz
);
create index if not exists leads_conseiller on public.leads (conseiller_id, cree_le desc);
create index if not exists leads_contact on public.leads (email, telephone);

create or replace function public.maj_lead() returns trigger language plpgsql as $$
begin new.maj_le = now(); return new; end; $$;
drop trigger if exists avant_maj_lead on public.leads;
create trigger avant_maj_lead before update on public.leads for each row execute function public.maj_lead();

-- ---------- Commentaires et historique ----------
create table if not exists public.commentaires (
  id bigint generated always as identity primary key,
  lead_id bigint not null references public.leads (id) on delete cascade,
  auteur_id uuid references public.conseillers (id) on delete set null,
  texte text not null,
  automatique boolean not null default false,
  cree_le timestamptz not null default now()
);
create index if not exists commentaires_lead on public.commentaires (lead_id, cree_le);

-- ---------- Règles d'accès (chaque conseiller ne voit que ses leads) ----------
alter table public.conseillers enable row level security;
alter table public.leads enable row level security;
alter table public.commentaires enable row level security;

drop policy if exists conseillers_lire on public.conseillers;
create policy conseillers_lire on public.conseillers for select to authenticated using (true);
drop policy if exists conseillers_modifier on public.conseillers;
create policy conseillers_modifier on public.conseillers for update to authenticated
  using (public.est_admin() or id = auth.uid())
  with check (public.est_admin() or (id = auth.uid() and role = (select c.role from public.conseillers c where c.id = auth.uid())
                                       and poids = (select c.poids from public.conseillers c where c.id = auth.uid())
                                       and actif = (select c.actif from public.conseillers c where c.id = auth.uid())));

drop policy if exists leads_lire on public.leads;
create policy leads_lire on public.leads for select to authenticated
  using (conseiller_id = auth.uid() or public.est_admin());
drop policy if exists leads_modifier on public.leads;
create policy leads_modifier on public.leads for update to authenticated
  using (conseiller_id = auth.uid() or public.est_admin())
  with check (public.est_admin() or conseiller_id = auth.uid());
drop policy if exists leads_supprimer on public.leads;
create policy leads_supprimer on public.leads for delete to authenticated using (public.est_admin());

drop policy if exists commentaires_lire on public.commentaires;
create policy commentaires_lire on public.commentaires for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and (l.conseiller_id = auth.uid() or public.est_admin())));
drop policy if exists commentaires_ecrire on public.commentaires;
create policy commentaires_ecrire on public.commentaires for insert to authenticated
  with check (auteur_id = auth.uid()
              and exists (select 1 from public.leads l where l.id = lead_id and (l.conseiller_id = auth.uid() or public.est_admin())));
