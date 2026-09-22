-- data-specification.md §5.2 `officials`
-- A person who can serve as umpire/referee/head-scorer/assistant-scorer --
-- distinct from players. user_id is nullable: an official is typically,
-- but not necessarily, also a users account holder.

create table public.officials (
  id                uuid primary key,
  organization_id   uuid null references public.organizations (id),
  user_id           uuid null references public.users (id),
  name              text not null,
  row_version       integer not null default 1,
  created_at        timestamptz not null default now(),
  created_by        uuid null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid null
);

create index officials_organization_id_ix on public.officials (organization_id);
