-- RLS-policy test for TASK-0002 (users, organizations, memberships).
-- Scope: confirms RLS is enabled and the expected policies exist, and that
-- the deliberately-omitted write policies (memberships INSERT/UPDATE/DELETE,
-- organizations INSERT) are in fact absent, not silently present.
-- The full 14-actor x 20-capability matrix generator is TASK-0015, not here.

begin;
select plan(11);

-- RLS enabled
select ok(
  (select relrowsecurity from pg_class where relname = 'users' and relnamespace = 'public'::regnamespace),
  'RLS is enabled on users'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'organizations' and relnamespace = 'public'::regnamespace),
  'RLS is enabled on organizations'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'memberships' and relnamespace = 'public'::regnamespace),
  'RLS is enabled on memberships'
);

-- Expected policies exist
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_select'),
  'users_select policy exists'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_update_self'),
  'users_update_self policy exists'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations' and policyname = 'organizations_select'),
  'organizations_select policy exists'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations' and policyname = 'organizations_update'),
  'organizations_update policy exists'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'memberships' and policyname = 'memberships_select'),
  'memberships_select policy exists'
);

-- Deliberately-omitted write policies are in fact absent (not silently granted)
select ok(
  not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations' and cmd = 'INSERT'),
  'organizations has no INSERT policy (deferred to a backend command handler)'
);
select ok(
  not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'memberships' and cmd in ('INSERT', 'UPDATE', 'DELETE')),
  'memberships has no INSERT/UPDATE/DELETE policy (deferred, privilege-escalation risk)'
);
select ok(
  not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and cmd in ('INSERT', 'DELETE')),
  'users has no INSERT/DELETE policy (identity writes are server-only)'
);

select * from finish();
rollback;
