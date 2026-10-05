-- TASK-0160: rewrites 20260923000044_tighten_disputes_select.sql's own
-- disputes_select (itself already a DROP/CREATE tightening of
-- 20260923000033's original "any member" policy to org-admin-only) to
-- call my_orgs('ORGANIZATION_ADMIN') instead of its own inline
-- matches/memberships join. Neither prior migration is retroactively
-- edited. The `m.organization_id is not null` boundary (an org-less
-- match's disputes are never exposed via this policy) is preserved
-- exactly, expressed as an `is not null` guard before the my_orgs()
-- check since my_orgs() has nothing to say about a null org id.
--
-- Same deliberate ACTIVE-only tightening as every other migration in
-- this task, for the identical reason: 20260923000044's own condition
-- never checked `memberships.status` -- a DEACTIVATED org-admin
-- currently still sees every dispute trail for their former
-- organization's matches. my_orgs() always filters to ACTIVE;
-- confirmed once with the user for this whole retrofit.

drop policy disputes_select on public.disputes;

create policy disputes_select on public.disputes
  for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = disputes.match_id
        and m.organization_id is not null
        and m.organization_id = any (public.my_orgs('ORGANIZATION_ADMIN'))
    )
  );
