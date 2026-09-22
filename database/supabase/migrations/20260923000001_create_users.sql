-- data-specification.md §3.1 `users`
-- CRUD-entity table (§1.4); soft deletion policy 2 via anonymized_at (§1.7); RLS per §1.8.

create table public.users (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  display_name      text not null,
  is_minor          boolean not null default false,
  guardian_user_id  uuid null references public.users (id),
  anonymized_at     timestamptz null,
  row_version       integer not null default 1,
  created_at        timestamptz not null default now(),
  -- No FK on created_by/updated_by: §1.5 allows a device-local placeholder for a
  -- not-yet-claimed guest match, which would violate a strict reference to users(id).
  created_by        uuid null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid null
);

-- guardian_user_id is set iff is_minor (data-specification.md §3.1's "Set iff is_minor" note).
alter table public.users
  add constraint users_guardian_requires_minor
  check (guardian_user_id is null or is_minor);

-- email is unique only among non-anonymized rows (§3.1: "UQ: email (where anonymized_at IS NULL)").
create unique index users_email_uq on public.users (email) where anonymized_at is null;
create index users_email_ix on public.users (email);
