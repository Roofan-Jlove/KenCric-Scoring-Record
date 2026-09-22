-- RLS policies for identity & tenancy: users, organizations, memberships.
-- security-specification.md §4: SR-B01 (RLS is the enforcement boundary),
-- SR-B05 (cross-tenant isolation). data-specification.md §1.8: tenant
-- isolation via organization_id and role checks for writes.
--
-- Scope note (deliberate, not an oversight): RLS here enforces coarse
-- tenant isolation only -- who may touch a tenant's data at all. Fine-
-- grained role permission checks (which role within a tenant may do what)
-- are SVC-AUTHORIZER's job per the three-layer model (master-specification.md
-- §5.4: client-advisory -> SVC-AUTHORIZER -> RLS), and SVC-AUTHORIZER does
-- not exist yet (TASK-0014). Anything that would need a role check beyond
-- "is an active member of this org" is deliberately left ungranted below
-- rather than approximated -- a missing policy defaults to deny, which is
-- the safe direction to err in.

alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

-- users: a person sees their own row, and any other user's row if they
-- share at least one organization via memberships (so org-mates' names
-- are visible for e.g. squad/scorer selection).
create policy users_select on public.users
  for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.memberships m1
      join public.memberships m2 on m1.organization_id = m2.organization_id
      where m1.user_id = auth.uid() and m2.user_id = users.id
    )
  );

-- users: self-update only. No INSERT/DELETE policy -- identity/auth writes
-- are server-only regardless (data-specification.md §3.1, A-12); a user
-- row is created via the auth-linked server path, not a client INSERT.
create policy users_update_self on public.users
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- organizations: visible only to its members (SR-B05: no cross-org
-- visibility by default).
create policy organizations_select on public.organizations
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.organization_id = organizations.id and m.user_id = auth.uid()
    )
  );

-- organizations: any active member may update org-level fields (name,
-- branding). This is intentionally coarse -- "should only an org admin
-- rename the org" is a real question this migration does not answer,
-- deferred to SVC-AUTHORIZER (TASK-0014) rather than guessed here.
create policy organizations_update on public.organizations
  for update
  using (
    exists (
      select 1 from public.memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    )
  );

-- organizations: no INSERT policy yet. §3.2 states an org is
-- "client-generatable... created from an onboarding flow," but creating
-- an org row with no accompanying membership would produce an org its
-- creator can't even see (SELECT requires membership) -- and granting
-- both org-INSERT and self-membership-INSERT together is exactly the kind
-- of bootstrap-privilege operation that needs a SECURITY DEFINER function
-- or backend command handler to do safely, not two independent RLS
-- policies that could be exploited separately. Deferred, not implemented
-- unsafely to appear complete.

-- memberships: a person sees their own membership rows, and other
-- members' rows within any organization they themselves belong to.
create policy memberships_select on public.memberships
  for select
  using (
    user_id = auth.uid()
    or organization_id in (
      select organization_id from public.memberships where user_id = auth.uid()
    )
  );

-- memberships: deliberately no INSERT/UPDATE/DELETE policy in this
-- migration. Membership creation and role changes are exactly the
-- privilege-escalation-risky operations SR-B04 (least-privilege default
-- for new members) and SR-B08 (impersonation requires stored consent)
-- exist to govern -- a client-writable RLS policy here (e.g. "a user can
-- insert their own membership") would let a user grant themselves
-- arbitrary roles. Left as default-deny; membership writes go through a
-- backend command handler once one exists, not this migration.
