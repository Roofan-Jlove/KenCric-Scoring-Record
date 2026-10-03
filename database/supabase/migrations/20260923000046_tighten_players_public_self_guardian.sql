-- Resolves implementation-task-backlog.md §8's own open item `ITQ-3`,
-- the RLS half: now that `players.user_id` exists (20260923000045),
-- SR-B09's own "minor's own account, their guardian" visibility clause
-- can finally be expressed. Builds on 20260923000042's own
-- ORGANIZATION_ADMIN branch (TASK-0141), adding two more: the player's
-- own linked account, and that account's own guardian (resolved through
-- `users.guardian_user_id`, not a second copy of the same fact on
-- `players` itself -- see 20260923000045's own note).
--
-- `CREATE OR REPLACE VIEW` is valid here because the column list/order
-- is still unchanged -- only the two CASE conditions gain two more `or`
-- branches each.

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
      or players.user_id = auth.uid()
      or exists (
        select 1 from public.users u
        where u.id = players.user_id and u.guardian_user_id = auth.uid()
      )
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
