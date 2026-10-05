-- TASK-0160: rewrites 20260923000035_create_divergences.sql's own
-- divergences_select to call my_orgs() instead of its own inline
-- matches/memberships join. The original migration is never
-- retroactively edited. The `m.organization_id is not null` boundary
-- is preserved exactly, same as the disputes_select rewrite in this
-- task.
--
-- Deliberately NO role filter here -- unlike disputes_select,
-- divergences_select was never tightened to org-admin-only by any
-- later migration (TASK-0141 left it at "any member", and that is not
-- a decision this task re-opens). my_orgs() with no argument matches
-- that "any member" shape exactly; the only change is the identical
-- ACTIVE-only tightening every migration in this task applies, for
-- the identical reason: the original condition never checked
-- `memberships.status` -- a DEACTIVATED member currently still sees
-- every divergence row for their former organization's matches.
-- my_orgs() always filters to ACTIVE; confirmed once with the user
-- for this whole retrofit.

drop policy divergences_select on public.divergences;

create policy divergences_select on public.divergences
  for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = divergences.match_id
        and m.organization_id is not null
        and m.organization_id = any (public.my_orgs())
    )
  );
