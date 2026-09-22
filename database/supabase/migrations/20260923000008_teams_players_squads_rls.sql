-- RLS policies + minors'-data field redaction for teams, players, squad_members.
-- security-specification.md: SR-B01 (RLS enforcement), SR-B04 (least-privilege
-- default), SR-B09/SR-J05 (minor-data access is role- and relationship-gated;
-- "a minor's non-public profile fields shall be visible only to the minor's
-- own account, their guardian, and roles with an explicit organizational
-- need (org-admin) -- never to a general viewer or another member by
-- default").
--
-- TWO GAPS, flagged rather than silently worked around:
-- 1. `players` (data-specification.md §4.2) has no linkage to `users` at
--    all -- no user_id/guardian FK. "The minor's own account" and "their
--    guardian" therefore cannot be resolved by RLS as the schema currently
--    stands. Needs either a schema RCR adding a players->users linkage, or
--    an explicit product decision that self/guardian access is out of
--    scope until one exists.
-- 2. The exact org-admin role string is not confirmed anywhere reachable
--    from this migration -- `memberships.roles` is deliberately an
--    unconstrained text[] (no enum to check against), and
--    product-foundation.md names the role conceptually ("Organization
--    Admin") but not its stored token. Hardcoding a guessed string here
--    would be an unverified invention; instead the org-admin exception is
--    left out. This under-grants (an org-admin sees the same redacted
--    view as anyone else) rather than risks over-granting on a wrong
--    guess -- the safe direction to err in for a field-redaction rule.
--
-- What IS implemented: redaction to everyone except the row's own creator,
-- which can be expressed with certainty (`created_by = auth.uid()`).

alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.squad_members enable row level security;

-- teams: visible to org members, or -- for org-less/ad-hoc teams -- to the
-- creator only. data-specification.md §1.8's general principle for guest
-- data is "organization_id IS NULL with device-scoped access"; approximated
-- here as creator-scoped, since per-device identity isn't available to RLS.
create policy teams_select on public.teams
  for select
  using (
    (organization_id is not null and exists (
      select 1 from public.memberships m
      where m.organization_id = teams.organization_id and m.user_id = auth.uid()
    ))
    or (organization_id is null and created_by = auth.uid())
  );

-- players: base-row visibility follows the same org-membership-or-creator
-- pattern as teams. This does NOT redact dob/photo_ref -- RLS cannot
-- express column-level redaction on the base table; see players_public.
create policy players_select on public.players
  for select
  using (
    (organization_id is not null and exists (
      select 1 from public.memberships m
      where m.organization_id = players.organization_id and m.user_id = auth.uid()
    ))
    or (organization_id is null and created_by = auth.uid())
  );

-- players_public: the redacted projection SR-B09 requires. Application
-- code performing any general-purpose display (squad lists, scorecards)
-- should read from this view, not the base players table.
create view public.players_public as
select
  id,
  organization_id,
  name,
  case when created_by = auth.uid() then dob else null end as dob,
  case when created_by = auth.uid() then photo_ref else null end as photo_ref,
  status,
  merged_into_player_id,
  row_version,
  created_at, created_by, updated_at, updated_by
from public.players;

-- squad_members: visible if the associated team is visible.
create policy squad_members_select on public.squad_members
  for select
  using (
    exists (
      select 1 from public.teams t
      where t.id = squad_members.team_id
        and (
          (t.organization_id is not null and exists (
            select 1 from public.memberships m
            where m.organization_id = t.organization_id and m.user_id = auth.uid()
          ))
          or (t.organization_id is null and t.created_by = auth.uid())
        )
    )
  );

-- No INSERT/UPDATE/DELETE policies in this migration, same reasoning as
-- TASK-0002: creating/modifying a team, player, or squad entry is exactly
-- the kind of operation that should go through a backend command handler
-- (squad management, player registration) once one exists, not a raw
-- client-writable RLS policy. Left as default-deny.
