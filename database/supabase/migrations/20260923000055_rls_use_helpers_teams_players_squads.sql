-- TASK-0160: rewrites 20260923000008_teams_players_squads_rls.sql's
-- own teams_select/players_select/squad_members_select, and the
-- players_public view's own org-admin redaction branches
-- (20260923000042/20260923000046), to call SR-B10's my_orgs() helper
-- instead of their own inline subqueries. Neither original migration
-- is retroactively edited -- this DROPs/CREATEs the policies and
-- `CREATE OR REPLACE`s the view, the same forward-only shape
-- TASK-0141/0159 already used.
--
-- **The identical deliberate tightening TASK-0160's own first
-- migration (identity_tenancy) already applies, for the identical
-- reason:** none of these three SELECT policies' own original
-- conditions checked `memberships.status` -- a DEACTIVATED member
-- currently keeps reading every org's teams/players/squad data.
-- my_orgs() always filters to ACTIVE; the user confirmed this
-- tightening directly, once, for the whole retrofit.
--
-- The personal (org-less, creator-scoped) branch on each policy is
-- untouched -- `my_orgs()` has nothing to say about a row with no
-- organization at all, matching every one of these policies' own
-- original `or (organization_id is null and created_by = auth.uid())`
-- shape exactly.
--
-- `players_public`'s own org-admin CASE branches (dob/photo_ref
-- redaction) already required `'ORGANIZATION_ADMIN' = any(m.roles)`
-- but, like every other policy here, never checked status -- replaced
-- with `my_orgs('ORGANIZATION_ADMIN')`, the same optional-role-filter
-- shape `TASK-0159` built the function for in the first place. The
-- self/guardian branch (20260923000046) is untouched -- it has no
-- membership/role check to replace at all.

drop policy teams_select on public.teams;

create policy teams_select on public.teams
  for select
  using (
    (organization_id is not null and organization_id = any (public.my_orgs()))
    or (organization_id is null and created_by = auth.uid())
  );

drop policy players_select on public.players;

create policy players_select on public.players
  for select
  using (
    (organization_id is not null and organization_id = any (public.my_orgs()))
    or (organization_id is null and created_by = auth.uid())
  );

drop policy squad_members_select on public.squad_members;

create policy squad_members_select on public.squad_members
  for select
  using (
    exists (
      select 1 from public.teams t
      where t.id = squad_members.team_id
        and (
          (t.organization_id is not null and t.organization_id = any (public.my_orgs()))
          or (t.organization_id is null and t.created_by = auth.uid())
        )
    )
  );

-- players_public: CREATE OR REPLACE keeps the EXACT same column
-- list/order as 20260923000046's own latest version (verified by
-- reading that file directly, not reconstructed from memory) -- only
-- the org-admin CASE branch's own inline exists() subquery is
-- replaced by a my_orgs('ORGANIZATION_ADMIN') call; the self/own-
-- account and guardian branches are copied verbatim, untouched.
create or replace view public.players_public as
select
  id,
  organization_id,
  name,
  case
    when created_by = auth.uid()
      or players.user_id = auth.uid()
      or exists (
        select 1 from public.users u
        where u.id = players.user_id and u.guardian_user_id = auth.uid()
      )
      or (organization_id is not null and organization_id = any (public.my_orgs('ORGANIZATION_ADMIN')))
    then dob
    else null
  end as dob,
  case
    when created_by = auth.uid()
      or players.user_id = auth.uid()
      or exists (
        select 1 from public.users u
        where u.id = players.user_id and u.guardian_user_id = auth.uid()
      )
      or (organization_id is not null and organization_id = any (public.my_orgs('ORGANIZATION_ADMIN')))
    then photo_ref
    else null
  end as photo_ref,
  status,
  merged_into_player_id,
  row_version,
  created_at, created_by, updated_at, updated_by
from public.players;
