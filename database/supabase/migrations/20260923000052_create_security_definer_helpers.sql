-- security-specification.md §4, SR-B10 -- "Functions that run with
-- elevated database privilege to support RLS (my_orgs(),
-- has_match_role(), the audit-insert helper) shall be limited to
-- exactly the checks they need, kept in one reviewed location, and
-- covered by their own test cases distinct from the general policy
-- matrix." Confirmed by direct search before writing this migration:
-- neither helper has ever been built anywhere in this schema's prior
-- 51 migrations -- every existing policy inlines its own
-- `exists(select 1 from memberships ...)`/`... join match_officials
-- ...` subquery instead. This migration builds exactly the two named
-- helpers, nothing more -- "the audit-insert helper" SR-B10 also
-- names is a separate concern (audit_log's own INSERT path,
-- TASK-0146), not RLS-read/write matching, and is not built here.
--
-- Deliberately NOT retrofitting any of the ~15 already-merged
-- policies that could now use these helpers (organizations_update,
-- disputes_select, memberships-adjacent checks, etc.) -- that is a
-- real, separate, larger refactor, flagged again here as out of this
-- task's own scope. `matches`' own policies (TASK-0158) are the first
-- real consumer, rewritten in the companion migration
-- `20260923000053_matches_rls_use_helpers.sql` immediately following
-- this one -- the original TASK-0158 migration is never retroactively
-- edited, the same forward-only convention `TASK-0141` already used
-- for tightening `disputes_select`/`invitations_select`.
--
-- `search_path` is pinned on both functions -- a standard Postgres
-- hardening practice for `SECURITY DEFINER` functions specifically
-- (an unpinned search_path lets a caller shadow `public` with a
-- same-named object in a schema earlier in their own search_path,
-- redirecting what the function actually queries while it runs with
-- elevated privilege). Marked `stable`, not `volatile` -- both read
-- only, never write, and their result depends only on the current
-- row/argument values plus `auth.uid()` within one statement.
--
-- **`my_orgs()` returns `uuid[]` (a plain array), not `setof uuid` --
-- edited in place, a deliberate, flagged exception to this backlog's
-- own forward-only migration convention.** Found only by actually
-- executing this migration set for the very first time against a
-- real local Postgres instance (every migration in this schema had
-- previously only ever been "reviewed by hand, never executed"):
-- Postgres flatly rejects a set-returning function call inside ANY
-- RLS policy expression ("set-returning functions are not allowed in
-- policy expressions", SQLSTATE 0A000) -- the very next migration
-- (`20260923000053`) fails the instant it tries to `create policy ...
-- using (... any (public.my_orgs()) ...)`. A forward-patching
-- migration appended after the fact (tried first, then abandoned)
-- cannot fix this: migrations apply strictly in sequence, and
-- `20260923000053` fails and halts the whole run long before any
-- later migration could ever execute, so the fix MUST land at the
-- function's own original definition, not after it. This is treated
-- as a safe exception, not a precedent for routinely rewriting
-- history: as of this fix, this schema had NEVER been successfully
-- deployed anywhere, so no real database has ever applied the broken
-- `setof uuid` version -- there is no live deployment this edit could
-- retroactively corrupt. `any(array)` has none of `setof`'s
-- restrictions anywhere in Postgres (policies, views, anywhere) --
-- every call site (`any (public.my_orgs())`,
-- `any (public.my_orgs('ORGANIZATION_ADMIN'))`) across
-- `20260923000053`-`20260923000058` is byte-for-byte unchanged, since
-- `any()` over an array and `any()` over a set use identical call
-- syntax; only this function's own return type and body change. The
-- empty-membership case now correctly yields `array[]::uuid[]` (an
-- empty array, `any()` over it is always false) rather than a
-- zero-row set (`any()` over which was ALSO always false) --
-- behaviourally identical either way.

create or replace function public.my_orgs(required_role text default null)
returns uuid[]
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(m.organization_id), array[]::uuid[])
  from public.memberships m
  where m.user_id = auth.uid()
    and m.status = 'ACTIVE'
    and (required_role is null or required_role = any (m.roles))
$$;

comment on function public.my_orgs(text) is
  'SR-B10: the organization_ids the calling user holds an ACTIVE membership in, optionally filtered to only those where they also hold required_role. Returns a plain array (not setof) -- a setof-returning function cannot appear in an RLS policy expression (SQLSTATE 0A000), found only by actually executing this schema for the first time. Replaces the inline exists(select 1 from memberships ...) subquery every pre-TASK-0159 policy writes by hand.';

grant execute on function public.my_orgs(text) to authenticated;

create or replace function public.has_match_role(p_match_id uuid, p_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.officials o
    join public.match_officials mo on mo.official_id = o.id
    where o.user_id = auth.uid()
      and mo.match_id = p_match_id
      and mo.role = any (p_roles)
  )
$$;

comment on function public.has_match_role(uuid, text[]) is
  'SR-B10/SR-B02: whether the calling user holds any of p_roles via match_officials on p_match_id specifically -- never org-wide. Replaces the inline officials/match_officials join subquery pushEvents.ts''s own isAuthorizedScorerOnMatch, and every RLS policy needing the identical check, each currently writes by hand.';

grant execute on function public.has_match_role(uuid, text[]) to authenticated;
