-- data-specification.md §4.1 `teams`
-- CRUD-entity table (§1.4), client-generated id -- offline team creation (A-24).
-- No soft-deletion column: §4.1 states this is "not applicable" here; a team
-- with match history is never deleted (enforced by history existing, not a
-- flag), and hard-delete-by-creator-only for an unused ad-hoc team is an
-- authorization rule (who may delete), not a schema concern -- belongs to
-- RLS/backend, not this migration (TASK-0004, not TASK-0003).

create table public.teams (
  id               uuid primary key,
  organization_id  uuid null references public.organizations (id),
  name             text not null,
  canonical_ref    uuid null references public.teams (id),
  row_version      integer not null default 1,
  created_at       timestamptz not null default now(),
  created_by       uuid null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid null
);

create index teams_organization_id_ix on public.teams (organization_id);
create index teams_name_trgm_ix on public.teams using gin (name gin_trgm_ops);
