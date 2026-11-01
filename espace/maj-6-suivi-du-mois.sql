-- Suivi du mois des conseillers (onglet « Conseillers et répartition ») : objectif du mois, plafond de leads par jour et types de leads acceptés.
-- Relançable sans risque. À lancer une fois dans Supabase (SQL Editor).

alter table public.conseillers add column if not exists objectif_mois numeric;   -- CHF de leads visés ce mois (vide : solde + reçu pour un conseiller à la pièce)
alter table public.conseillers add column if not exists plafond_jour integer;    -- nombre maximum de leads attribués automatiquement par jour (vide : pas de plafond)
alter table public.conseillers add column if not exists types_leads text[];      -- types de leads acceptés (produits) ; vide : tous les types

-- Un conseiller ne peut changer ni son objectif ni son plafond (seul l'admin les règle)
drop policy if exists conseillers_modifier on public.conseillers;
create policy conseillers_modifier on public.conseillers for update to authenticated
  using (public.est_admin() or id = auth.uid())
  with check (public.est_admin() or (id = auth.uid() and role = (select c.role from public.conseillers c where c.id = auth.uid())
                                       and poids = (select c.poids from public.conseillers c where c.id = auth.uid())
                                       and actif = (select c.actif from public.conseillers c where c.id = auth.uid())
                                       and type = (select c.type from public.conseillers c where c.id = auth.uid())
                                       and prix_lead = (select c.prix_lead from public.conseillers c where c.id = auth.uid())
                                       and credit = (select c.credit from public.conseillers c where c.id = auth.uid())
                                       and objectif_mois is not distinct from (select c.objectif_mois from public.conseillers c where c.id = auth.uid())
                                       and plafond_jour is not distinct from (select c.plafond_jour from public.conseillers c where c.id = auth.uid())
                                       and types_leads is not distinct from (select c.types_leads from public.conseillers c where c.id = auth.uid())));
