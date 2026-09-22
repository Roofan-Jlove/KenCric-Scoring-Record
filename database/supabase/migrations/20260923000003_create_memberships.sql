-- data-specification.md §3.3 `memberships`
-- CRUD-entity table (§1.4). The additive-RBAC join between a user and an organization;
-- the RLS anchor for every tenant-scoped table (§3.3). Soft deletion is policy 2
-- (status = DEACTIVATED, never a row delete) — deactivation must retain authorship
-- of past events (§3.3, BR-024), which requires the row itself to persist.

create table public.memberships (
  id                uuid primary key,
  user_id           uuid not null references public.users (id),
  organization_id   uuid not null references public.organizations (id),
  roles             text[] not null default '{}',
  -- Implemented as a CHECK, not a native Postgres enum type, so adding a role/status
  -- value later is an ALTER TABLE, not an ALTER TYPE (data-specification.md §1.2's
  -- enum(...) notation does not mandate a specific SQL representation).
  status            text not null default 'ACTIVE'
                       check (status in ('ACTIVE', 'DEACTIVATED')),
  row_version       integer not null default 1,
  created_at        timestamptz not null default now(),
  created_by        uuid null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid null
);

alter table public.memberships
  add constraint memberships_user_org_uq unique (user_id, organization_id);

create index memberships_organization_id_ix on public.memberships (organization_id);
create index memberships_user_id_ix on public.memberships (user_id);
