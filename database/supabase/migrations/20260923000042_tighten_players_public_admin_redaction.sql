-- Tightens 20260923000008_teams_players_squads_rls.sql's own explicitly-
-- flagged under-grant, now that TASK-0140 confirms the canonical
-- org-admin token (ORGANIZATION_ADMIN) at the DB layer. That file's own
-- comment said: "the exact org-admin role string is not confirmed
-- anywhere reachable from this migration... this under-grants (an
-- org-admin sees the same redacted view as anyone else) rather than
-- risks over-granting on a wrong guess." The guess is no longer a guess.
--
-- SR-B09/SR-J05's own text: minor-data fields shall be visible to "the
-- minor's own account, their guardian, and roles with an explicit
-- organizational need (org-admin)." This migration adds the org-admin
-- case; "their guardian" remains correctly unresolved -- players still
-- has no players->users linkage at all (ITQ-3, still open, a separate
-- gap this migration does not touch).
--
-- `CREATE OR REPLACE VIEW` is valid here because the column list/order
-- is unchanged -- only the two CASE conditions gain an additional
-- `or` branch.

create or replace view public.players_public as
select
  id,
  organization_id,
  name,
  case
    when created_by = auth.uid()
      or exists (
        select 1 from public.memberships m
        where m.organization_id = players.organization_id
          and m.user_id = auth.uid()
          and 'ORGANIZATION_ADMIN' = any(m.roles)
      )
    then dob
    else null
  end as dob,
  case
    when created_by = auth.uid()
      or exists (
        select 1 from public.memberships m
        where m.organization_id = players.organization_id
          and m.user_id = auth.uid()
          and 'ORGANIZATION_ADMIN' = any(m.roles)
      )
    then photo_ref
    else null
  end as photo_ref,
  status,
  merged_into_player_id,
  row_version,
  created_at, created_by, updated_at, updated_by
from public.players;
