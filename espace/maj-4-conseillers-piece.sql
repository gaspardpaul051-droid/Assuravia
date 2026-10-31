-- Conseillers « au budget » ou « à la pièce » et valeur des leads (à lancer dans Supabase > SQL Editor > New query > Run ;
-- peut être relancé sans risque). Chaque lead a une valeur (CHF 50 par défaut, modifiable par l'admin : super leads 100, 150, 200…).
-- À la pièce : chaque lead attribué coûte sa valeur ; solde = crédit chargé − coût de ses leads.
-- Le coût est noté sur le lead à l'attribution (trigger) : une réattribution ou une suppression le rembourse.

alter table public.conseillers add column if not exists type text not null default 'budget';
alter table public.conseillers drop constraint if exists conseillers_type_check;
alter table public.conseillers add constraint conseillers_type_check check (type in ('budget', 'piece'));
alter table public.conseillers add column if not exists prix_lead numeric(10,2) not null default 0;
alter table public.conseillers add column if not exists credit numeric(10,2) not null default 0;
alter table public.leads add column if not exists cout numeric(10,2);
alter table public.leads add column if not exists valeur numeric(10,2) not null default 50;

-- Coût du lead fixé à l'attribution (automatique ou manuelle) ; un conseiller ne peut pas le modifier
create or replace function public.lead_cout() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.valeur is null then new.valeur := 50; end if;
  -- Un conseiller ne peut changer ni la valeur ni le coût d'un lead
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.est_admin() then
    new.valeur := old.valeur; new.cout := old.cout;
    return new;
  end if;
  -- Coût recalculé à l'attribution, au changement de conseiller ou de valeur
  if tg_op = 'INSERT' or new.conseiller_id is distinct from old.conseiller_id or new.valeur is distinct from old.valeur then
    new.cout := (select case when c.type = 'piece' then new.valeur end from public.conseillers c where c.id = new.conseiller_id);
  end if;
  return new;
end $$;
drop trigger if exists leads_cout on public.leads;
create trigger leads_cout before insert or update on public.leads for each row execute function public.lead_cout();

-- Un conseiller ne peut changer ni sa formule, ni son prix, ni son crédit
drop policy if exists conseillers_modifier on public.conseillers;
create policy conseillers_modifier on public.conseillers for update to authenticated
  using (public.est_admin() or id = auth.uid())
  with check (public.est_admin() or (id = auth.uid() and role = (select c.role from public.conseillers c where c.id = auth.uid())
                                       and poids = (select c.poids from public.conseillers c where c.id = auth.uid())
                                       and actif = (select c.actif from public.conseillers c where c.id = auth.uid())
                                       and type = (select c.type from public.conseillers c where c.id = auth.uid())
                                       and prix_lead = (select c.prix_lead from public.conseillers c where c.id = auth.uid())
                                       and credit = (select c.credit from public.conseillers c where c.id = auth.uid())));

-- Soldes : le conseiller voit le sien, l'admin voit tous les soldes
create or replace function public.soldes()
returns table (conseiller_id uuid, credit numeric, depense numeric, leads_factures bigint, solde numeric)
language sql stable security definer set search_path = public as $$
  select c.id, c.credit, coalesce(sum(l.cout), 0), count(l.cout), c.credit - coalesce(sum(l.cout), 0)
  from public.conseillers c
  left join public.leads l on l.conseiller_id = c.id and l.cout is not null
  where public.est_admin() or c.id = auth.uid()
  group by c.id, c.credit
$$;
grant execute on function public.soldes() to authenticated;
