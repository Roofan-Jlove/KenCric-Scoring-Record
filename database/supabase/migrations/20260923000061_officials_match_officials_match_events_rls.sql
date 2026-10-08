-- THREE real, blocking gaps found while wiring apps/web's Live Scoring
-- hub to the real `POST /sync/events` pipeline for the first time ever
-- (the same "never actually executed" shape every other gap this
-- session found shares):
--
-- 1. `officials` (20260923000011) and `match_officials` (20260923000012)
--    have NO RLS enabled and NO grants anywhere -- completely
--    inaccessible via PostgREST, the identical "no write grant" shape
--    `teams` had before `20260923000060`.
-- 2. `match_events` (20260923000013/20260923000014) DOES grant
--    SELECT/INSERT to authenticated, but `20260923000014`'s own
--    trailing comment explicitly flags enabling RLS with ZERO
--    policies as a deliberate "safety addition beyond this task's
--    literal scope... actual match-scoped read policies are a future
--    task, not implemented here." That future task is this one.
--    Without this, `pushEvents.ts`'s own app-level scorer-authz check
--    passing is irrelevant -- the INSERT itself would still be denied
--    by RLS before ever reaching `sync-events`' own real Postgres
--    write, since that Edge Function uses a single user-scoped client
--    (confirmed directly: `sync-events/index.ts` creates exactly one
--    `createClient(...)` call, never a second service-role client).
--
-- `officials`/`match_officials` use the same self-attribution pattern
-- `teams_insert` (20260923000060) already established -- a user may
-- create their own official record, and may assign THEMSELVES
-- (via an official row they own) to a match THEY created. This is
-- deliberately narrow, not a general "invite a scorer" flow (none
-- exists anywhere in this backlog) -- it exists to let a match's own
-- creator become its own Head Scorer, the minimum real-scoring
-- pathway, not to let any user assign roles on any match.
--
-- `match_events`'s own select/insert conditions mirror `matches_update`
-- (20260923000053) byte-for-byte in shape -- an assigned scorer for an
-- org-scoped match, or the creator/claimant for a personal one --
-- reusing `has_match_role()` (`SR-B10`, `20260923000052`) rather than
-- inventing a new check. `pushEvents.ts`'s own `isAuthorizedScorerOnMatch`
-- is the REAL, mandatory gate regardless (it has no personal-match-
-- creator bypass at all) -- this RLS policy is a backstop matching the
-- established shape, not the actual authorization decision.

alter table public.officials enable row level security;

create policy officials_select on public.officials
  for select
  using (
    created_by = auth.uid()
    or user_id = auth.uid()
    or (organization_id is not null and organization_id = any (public.my_orgs()))
  );

create policy officials_insert on public.officials
  for insert
  with check (created_by = auth.uid());

alter table public.match_officials enable row level security;

create policy match_officials_select on public.match_officials
  for select
  using (
    exists (select 1 from public.officials o where o.id = match_officials.official_id and o.user_id = auth.uid())
    or exists (
      select 1 from public.matches m
      where m.id = match_officials.match_id
        and (
          (m.organization_id is not null and m.organization_id = any (public.my_orgs()))
          or (m.organization_id is null and (m.created_by = auth.uid() or m.updated_by = auth.uid()))
        )
    )
  );

-- Self-assignment only, only onto a match the caller themselves
-- created -- "claiming establishes the role," the same shape
-- matches_insert (20260923000051) already uses.
create policy match_officials_insert on public.match_officials
  for insert
  with check (
    exists (select 1 from public.officials o where o.id = match_officials.official_id and o.user_id = auth.uid())
    and exists (select 1 from public.matches m where m.id = match_officials.match_id and m.created_by = auth.uid())
  );

create policy match_events_select on public.match_events
  for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_events.match_id
        and (
          (m.organization_id is not null and (
            m.organization_id = any (public.my_orgs('ORGANIZATION_ADMIN'))
            or public.has_match_role(m.id, array['HEAD_SCORER', 'ASSISTANT_SCORER'])
          ))
          or (m.organization_id is null and (m.created_by = auth.uid() or m.updated_by = auth.uid()))
        )
    )
  );

create policy match_events_insert on public.match_events
  for insert
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_events.match_id
        and (
          (m.organization_id is not null and public.has_match_role(m.id, array['HEAD_SCORER', 'ASSISTANT_SCORER']))
          or (m.organization_id is null and (m.created_by = auth.uid() or m.updated_by = auth.uid()))
        )
    )
  );
