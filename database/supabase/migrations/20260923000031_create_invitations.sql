-- data-specification.md §3.4 `invitations` -- added by RCR, 2026-10-03
-- (TASK-0119), resolving the genuine schema gap TASK-0102's own mint note
-- first flagged: domain-model.md's ENT-MEMBERSHIP Lifecycle names an
-- `Invited` state memberships.status's ACTIVE/DEACTIVATED-only enum
-- cannot represent. Resolved as its own small, ephemeral, pre-membership
-- table instead of a third status value -- api-specification.md §11.5's
-- own contract already implies this (the accept endpoint's response is
-- "the new memberships row," meaning the row doesn't exist before
-- acceptance). See §3.4's own note for the full reasoning.

create table public.invitations (
  id                uuid primary key,
  organization_id   uuid not null references public.organizations (id),
  email             text not null,
  roles             text[] not null default '{}',
  token             text not null,
  -- Implemented as a CHECK, not a native Postgres enum type, matching
  -- memberships' own §3.3 convention (20260923000003_create_memberships.sql).
  status            text not null default 'PENDING'
                       check (status in ('PENDING', 'ACCEPTED', 'REVOKED')),
  expires_at        timestamptz not null,
  invited_at        timestamptz not null default now(),
  invited_by        uuid not null,
  accepted_at       timestamptz null
);

alter table public.invitations
  add constraint invitations_token_uq unique (token);

create index invitations_organization_id_ix on public.invitations (organization_id);
create index invitations_token_ix on public.invitations (token);

alter table public.invitations enable row level security;

-- Visible to org members, same org-membership-or-creator pattern
-- 20260923000008_teams_players_squads_rls.sql already established --
-- the exact org-admin role token is still unconfirmed anywhere reachable
-- from a migration (same gap that file's own comment names), so this
-- under-grants to "any org member" rather than risking a wrong guess at
-- the admin-only token.
create policy invitations_select on public.invitations
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.organization_id = invitations.organization_id and m.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies -- sending/accepting an invitation goes
-- through TASK-0120's own command handler, not a raw client-writable RLS
-- policy, same reasoning as every other command-backed table in this
-- migration set. Left as default-deny.
