-- A real, confirmed backend gap, found while wiring apps/web's Playing
-- XI (UX-06/UX-07) to real data for the first time ever: `players`
-- (20260923000006_create_players.sql) has RLS enabled
-- (20260923000008_teams_players_squads_rls.sql) with only a
-- `players_select` policy -- no INSERT grant, no INSERT policy,
-- anywhere in this schema. That migration's own trailing comment
-- explicitly deferred this: "creating/modifying a team, player, or
-- squad entry is exactly the kind of operation that should go through
-- a backend command handler... once one exists, not a raw
-- client-writable RLS policy." A real command handler now DOES exist
-- (`backend/src/commands/players.ts`, `createPlayer`, `TASK-0096`) --
-- but confirmed via a direct list of all real Edge Functions: no
-- `players` endpoint was ever built to expose it over HTTP. The
-- identical "written but never wired" shape this session has already
-- found and closed twice this same round (divergence detection,
-- `TASK-0161`; the real `BattingContext`, this session's own V8 fix).
--
-- Same shape, same reasoning, same precedent as `teams_insert`
-- (`20260923000060`): an ad-hoc player created during match setup has
-- no authz check beyond "is logged in" (`FR-033`'s own "ad-hoc players
-- created offline routinely" framing) -- not a privileged,
-- command-handler-gated action in the real sense `createPlayer`'s own
-- module exists for (that module's own additional concerns --
-- `dob`/`photoRef` minors'-data handling, the merge command's own
-- `status`/`mergedIntoPlayerId` exclusivity -- are schema-shape
-- concerns this RLS policy doesn't need to re-implement; this is the
-- identical "a direct-PostgREST-write candidate, not a command-handler-
-- gated one" reasoning `teams_insert`'s own migration already used).
-- Org-scoped player creation is deliberately NOT given its own
-- membership-checked branch here, for the identical reason
-- `teams_insert` left org-scoped team creation unaddressed: no screen
-- or command anywhere in this backlog creates an org-scoped player yet.

grant insert on public.players to authenticated;

create policy players_insert on public.players
  for insert
  with check (created_by = auth.uid());
