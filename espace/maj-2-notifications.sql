-- Notifications par e-mail des nouveaux leads (à lancer une fois dans Supabase > SQL Editor > New query > Run).
-- L'administrateur active ou non les e-mails pour chaque conseiller dans « Conseillers et répartition ».
alter table public.conseillers add column if not exists notif_email boolean not null default false;
