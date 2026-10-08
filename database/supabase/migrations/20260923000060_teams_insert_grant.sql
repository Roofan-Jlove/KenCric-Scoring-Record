-- A real, confirmed backend gap, found while wiring apps/web to the real
-- local Supabase stack: `teams` (20260923000005_create_teams.sql) has
-- RLS enabled (20260923000008_teams_players_squads_rls.sql) with only a
-- `teams_select` policy -- no INSERT grant, no INSERT policy, anywhere in
-- this schema's 59 prior migrations. `matches.home_team_id`/`away_team_id`
-- are NOT NULL foreign keys to `teams`, so a real match genuinely cannot
-- be created by anyone, through any path, until this exists -- not a
-- design choice flagged anywhere in this corpus, a plain omission. No
-- Edge Function creates teams either (confirmed: none of the 16 Edge
-- Functions built across TASK-0148-0157 touch `teams` at all) -- team
-- creation is a direct-PostgREST-write candidate exactly like
-- `matches_insert` already is, not a privileged/command-handler-gated
-- action (creating a team has no authz check beyond "is logged in," the
-- same shape `matches_insert`/`CreateMatchScreen`'s own `§11.7`-style
-- "claiming establishes the role" reasoning already uses for matches).
--
-- Same shape, same reasoning, same precedent as `matches_insert`
-- (20260923000051) and the already-established "found a missing INSERT
-- grant, fixed it directly via a new migration" pattern (TASK-0151's own
-- `export_jobs` fix, `20260923000049`): any authenticated user may insert
-- a team row, attributed to themselves; `organization_id` is left exactly
-- as `teams_select`'s own existing policy already treats it (null =
-- personal/ad-hoc, non-null = org-scoped) -- this migration does not add
-- an org-membership check for org-scoped team creation, since no screen
-- or command anywhere in this backlog creates an org-scoped team yet
-- (that would be a real, separate, larger feature -- team creation
-- *within* an organization presumably needs at least membership, maybe a
-- role check -- not invented here, flagged for whoever builds that flow).

grant insert on public.teams to authenticated;

create policy teams_insert on public.teams
  for insert
  with check (created_by = auth.uid());
