-- Resolves implementation-task-backlog.md §8's own open item `ITQ-3`:
-- "players has no linkage to users at all -- SR-B09's 'minor's own
-- account, their guardian' visibility clause cannot be enforced by RLS
-- until one exists."
--
-- Resolution: a single nullable `players.user_id -> users.id` column --
-- "the real account this player registry entry corresponds to, if the
-- player has one and it has been linked." Deliberately NOT a second,
-- duplicate guardian column on `players` itself: `users` already has
-- `is_minor`/`guardian_user_id` (20260923000001_create_users.sql) --
-- once a player is linked to a users row, that row's own guardian
-- status resolves through the existing users table, not a second copy
-- of the same fact.
--
-- NOT invented here: a command that actually SETS this link. No
-- self-registration flow or appearance-claim-approval flow exists
-- anywhere in this backlog yet (appearance-claims, §11.8, is V2,
-- already correctly deferred) -- the column exists for a future such
-- command to populate; this migration only adds the schema half, the
-- same "structurally absent until the dedicated command exists" shape
-- players.ts's own createPlayer/updatePlayer already use for
-- status/merged_into_player_id.

alter table public.players
  add column user_id uuid null references public.users (id);

create index players_user_id_ix on public.players (user_id);
