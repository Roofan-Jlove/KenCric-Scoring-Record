-- data-specification.md §5.1 `matches` -- the MAJOR unresolved gap
-- flagged repeatedly from TASK-0154 onward: this table has NEVER had
-- RLS enabled or an explicit GRANT statement anywhere in this
-- schema's prior 50 migrations (confirmed by direct search before
-- writing this one). This migration closes it, grounded directly in
-- security-specification.md §4's own role/permission matrix and
-- SR-B01…B10 -- not invented from nothing.
--
-- **`SR-B10`'s own named `SECURITY DEFINER` helpers (`my_orgs()`,
-- `has_match_role()`) have never been built anywhere in this schema**
-- (confirmed by direct search) -- every existing policy
-- (`organizations_update`, `disputes_select`, `divergences_select`,
-- etc.) inlines its own `exists(select 1 from memberships ...)`
-- subquery instead. This migration follows that SAME established
-- convention rather than introducing a new shared-helper pattern as a
-- side effect of this task -- `SR-B10`'s own gap is flagged here, not
-- silently fixed; building the helpers (and migrating every existing
-- policy to use them) is a real, separate, larger refactor.
--
-- **A real, genuinely ambiguous design question found and resolved
-- with an explicit, flagged default, not silently guessed:**
-- `offline-first-specification.md §2.2` says a guest match "has NO
-- server-side existence at all until claimed" -- but `matches.claim_
-- status`'s own `CHECK` constraint still allows a `'GUEST'` value to
-- exist as a real row (e.g. created directly via the already-built
-- `PUT /matches/{id}` `createMatch` path, TASK-0039, an authenticated-
-- online creation distinct from the fully-offline-device scenario
-- `offline-first-specification.md` describes). The default adopted
-- here: a `GUEST`-status row, if one exists server-side at all, is
-- visible to its own creator (`created_by = auth.uid()`) -- never to
-- anyone else, matching `SR-A07`/`SR-B06`'s own "not found for any
-- OTHER credential" intent -- rather than invisible even to its own
-- creator, which would make the already-built `PUT /matches/{id}`
-- create path unable to ever read back what it just created. Revisit
-- if a real Supabase project ever confirms the fully-offline guest
-- flow genuinely never touches this table before claim (in which case
-- this branch is simply dead code, never a liability either way).
--
-- **A real, separate finding surfaced, not fixed here:** `claimMatch.ts`'s
-- own pure logic (`TASK-0102`) treats "no existing row" as a `404`,
-- never creating one -- in apparent tension with the fully-offline
-- scenario `offline-first-specification.md §2.2` describes (a device
-- that never touched the server until the claim call itself). Whether
-- the real claim flow needs to create-or-update rather than update-
-- only is a question about `claimMatch.ts`'s own command-layer
-- completeness, not this migration's RLS policies -- flagged for a
-- future task, not addressed here.

grant select, insert, update on public.matches to authenticated;

alter table public.matches enable row level security;

-- Read visibility: an org-scoped, CLAIMED match is visible to any
-- ACTIVE member of that organization -- every role in security-
-- specification.md §4.2's own matrix needs at least this much ("Read
-- live/final scorecard": Y for every org-scoped role), with finer
-- write-gating handled by matches_update below, the identical
-- "any member may read, writes are the gated part" shape every other
-- org-scoped table in this schema already uses (disputes_select,
-- divergences_select, invitations_select). A personal (org-less)
-- match -- GUEST or CLAIMED -- is visible only to whoever created or
-- claimed it; `updated_by` is checked too since claiming (TASK-0102)
-- sets it to the claimant, who may be a different account than the
-- original creator (§11.7's own "claiming from a different device"
-- note).
create policy matches_select on public.matches
  for select
  using (
    (
      organization_id is not null
      and claim_status = 'CLAIMED'
      and exists (
        select 1 from public.memberships m
        where m.organization_id = matches.organization_id
          and m.user_id = auth.uid()
          and m.status = 'ACTIVE'
      )
    )
    or (
      organization_id is null
      and (created_by = auth.uid() or updated_by = auth.uid())
    )
  );

-- Create: any authenticated caller may insert a new match row,
-- attributed to themselves -- matches.id is client-generated
-- (data-specification.md §5.1's own "a match is always created
-- offline-first" note), the same client-supplied-id convention this
-- schema already uses throughout; WITH CHECK enforces the row can
-- only ever be attributed to its own real creator, never spoofed.
create policy matches_insert on public.matches
  for insert
  with check (created_by = auth.uid());

-- Write: an org-scoped match's header may be updated by an
-- ORGANIZATION_ADMIN of its own organization, or by a Head/Assistant
-- Scorer explicitly assigned to THIS match (match_officials,
-- data-specification.md §5.3) -- security-specification.md SR-B02's
-- own rule, "match-scoped roles are distinct from organization-wide
-- roles... that requires an explicit assignment on that match
-- specifically," applied here exactly as it already is for
-- match_events writes (pushEvents.ts's own isAuthorizedScorerOnMatch).
-- A personal (org-less) match may be updated only by its own
-- creator/claimant -- no scorer-assignment or org-admin concept
-- applies without an organization.
create policy matches_update on public.matches
  for update
  using (
    (
      organization_id is not null
      and (
        exists (
          select 1 from public.memberships m
          where m.organization_id = matches.organization_id
            and m.user_id = auth.uid()
            and m.status = 'ACTIVE'
            and 'ORGANIZATION_ADMIN' = any (m.roles)
        )
        or exists (
          select 1 from public.officials o
          join public.match_officials mo on mo.official_id = o.id
          where o.user_id = auth.uid()
            and mo.match_id = matches.id
            and mo.role in ('HEAD_SCORER', 'ASSISTANT_SCORER')
        )
      )
    )
    or (
      organization_id is null
      and (created_by = auth.uid() or updated_by = auth.uid())
    )
  );

-- No DELETE policy -- matches.ts has never built a delete command for
-- this resource (confirmed directly); none is invented here either.
