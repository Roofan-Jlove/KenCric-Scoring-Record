-- Tightens 20260923000033_create_disputes.sql's own explicitly-flagged
-- under-grant, now that TASK-0140 confirms the canonical org-admin
-- token at the DB layer. api-specification.md §11.4's own Authz line
-- for both lock and adjudicate is "Org-admin"; `FR-159`'s own "view
-- dispute trails" text (TASK-0124) is itself part of the org-admin
-- console specifically, not a general-member capability. Visibility to
-- "any org member" was always broader than the spec's own contract;
-- this migration corrects it.
--
-- The `organization_id IS NOT NULL` boundary (an org-less/guest match's
-- disputes are not exposed via this policy at all) is unchanged --
-- that was never the flagged gap, only the role check was.

drop policy disputes_select on public.disputes;

create policy disputes_select on public.disputes
  for select
  using (
    exists (
      select 1 from public.matches m
      join public.memberships mem on mem.organization_id = m.organization_id
      where m.id = disputes.match_id
        and m.organization_id is not null
        and mem.user_id = auth.uid()
        and 'ORGANIZATION_ADMIN' = any(mem.roles)
    )
  );
