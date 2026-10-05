-- TASK-0160: rewrites 20260923000004_create_rls_policies.sql's own
-- organizations_select/organizations_update/memberships_select to
-- call SR-B10's my_orgs() helper (20260923000052) instead of their
-- own inline subqueries -- continuing TASK-0159's own "matches was
-- the first consumer, the rest is a separate, larger refactor" note.
-- The original 000004 migration is never retroactively edited.
--
-- **A real, deliberate behaviour change, not a pure refactor, flagged
-- explicitly:** organizations_select's own original condition never
-- checked memberships.status at all -- a DEACTIVATED member currently
-- keeps read access to every org-level field. my_orgs() always
-- filters to ACTIVE. Presented to the user directly (AskUserQuestion)
-- before writing this: is "deactivated members keep reading" a real
-- oversight, or a deliberate design choice this migration would
-- wrongly override? The user confirmed it reads as an oversight, not
-- a stated design choice anywhere in this corpus, and asked for the
-- tightening. organizations_update was ALREADY ACTIVE-only (no
-- behaviour change there, a pure refactor). memberships_select's own
-- "other members' rows" branch gets the identical treatment -- a
-- deactivated member's own row stays visible to themselves
-- (`user_id = auth.uid()`, untouched, status-independent by design:
-- seeing your own deactivated status is not a privilege leak), but
-- they no longer see OTHER members' rows in orgs where they themselves
-- are no longer active.

drop policy organizations_select on public.organizations;

create policy organizations_select on public.organizations
  for select
  using (organizations.id = any (public.my_orgs()));

drop policy organizations_update on public.organizations;

create policy organizations_update on public.organizations
  for update
  using (organizations.id = any (public.my_orgs()));

drop policy memberships_select on public.memberships;

create policy memberships_select on public.memberships
  for select
  using (
    user_id = auth.uid()
    or organization_id = any (public.my_orgs())
  );
