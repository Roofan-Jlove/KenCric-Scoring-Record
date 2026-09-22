-- data-specification.md §3.2 `organizations`
-- CRUD-entity table (§1.4). No soft-deletion column: §3.2 states this is "not defined in
-- this iteration — organizations are not expected to be deleted; revisit if a
-- decommissioning flow is added (§13)." Not invented here.

create extension if not exists pg_trgm;

create table public.organizations (
  id           uuid primary key,
  name         text not null,
  branding     jsonb null,
  row_version  integer not null default 1,
  created_at   timestamptz not null default now(),
  created_by   uuid null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid null
);

-- Trigram index for admin search (§3.2: "IX: name (trigram, for admin search)").
create index organizations_name_trgm_ix on public.organizations using gin (name gin_trgm_ops);
