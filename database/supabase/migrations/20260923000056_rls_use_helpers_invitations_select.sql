-- TASK-0160: rewrites 20260923000043_tighten_invitations_select.sql's
-- own invitations_select (itself already a DROP/CREATE tightening of
-- 20260923000031's original) to call my_orgs('ORGANIZATION_ADMIN')
-- instead of its own inline subquery. Neither prior migration is
-- retroactively edited.
--
-- **The same deliberate ACTIVE-only tightening every migration in
-- this task applies, for the identical reason:** 20260923000043's own
-- condition never checked `memberships.status` either -- a
-- DEACTIVATED org-admin currently still sees every pending invitation
-- row for their former organization. `my_orgs()` always filters to
-- ACTIVE; confirmed once with the user for this whole retrofit.

drop policy invitations_select on public.invitations;

create policy invitations_select on public.invitations
  for select
  using (invitations.organization_id = any (public.my_orgs('ORGANIZATION_ADMIN')));
