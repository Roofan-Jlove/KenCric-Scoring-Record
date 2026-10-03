-- Tightens 20260923000031_create_invitations.sql's own explicitly-
-- flagged under-grant, now that TASK-0140 confirms the canonical
-- org-admin token at the DB layer. That file's own comment said: "the
-- exact org-admin role token is still unconfirmed anywhere reachable
-- from a migration... this under-grants to 'any org member' rather
-- than risking a wrong guess." The guess is no longer a guess.
--
-- api-specification.md §11.5's own Authz line for *send* is
-- "org-admin" -- the only role that should ever see a pending
-- invitation row (including its own `token`, delivered "out-of-band
-- by email, not returned to any caller other than the inviter").
-- Visibility to "any org member" was always broader than the spec's
-- own contract; this migration corrects it.

drop policy invitations_select on public.invitations;

create policy invitations_select on public.invitations
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.organization_id = invitations.organization_id
        and m.user_id = auth.uid()
        and 'ORGANIZATION_ADMIN' = any(m.roles)
    )
  );
