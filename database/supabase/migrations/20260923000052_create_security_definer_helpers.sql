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

create or replace function public.my_orgs(required_role text default null)
returns setof uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select m.organization_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.status = 'ACTIVE'
    and (required_role is null or required_role = any (m.roles))
$$;

comment on function public.my_orgs(text) is
  'SR-B10: the organization_ids the calling user holds an ACTIVE membership in, optionally filtered to only those where they also hold required_role. Replaces the inline exists(select 1 from memberships ...) subquery every pre-TASK-0159 policy writes by hand.';

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
