-- TASK-0015: RLS policy matrix pgTAP suite bootstrap.
-- security-specification.md §4.2's 14-actor x 20-capability matrix.
--
-- HONEST SCOPE NOTE, not silently overstated: §4.2's matrix distinguishes
-- 14 actors by ROLE (Head Scorer vs. Umpire vs. Analyst, etc.) and 20
-- fine-grained CAPABILITIES. TASK-0002's actual policies (the only
-- RLS this repository has) check coarse tenant membership only -- "does
-- this user have ANY membership in this organization" -- they do not
-- inspect memberships.roles at all (TASK-0002's own verification report
-- flagged this explicitly: role-specific checks are deferred to
-- SVC-AUTHORIZER, not built into RLS yet). So this suite cannot yet
-- exercise the role dimension of §4.2's matrix -- there is nothing in
-- the database to distinguish a Head Scorer from an Umpire.
--
-- What this task actually delivers: a genuinely reusable, parameterized
-- GENERATOR (test_rls_select below) that the matrix's cells are asserted
-- through, rather than one hand-written test per cell -- proven correct
-- against what's real today (self / co-tenant / cross-tenant-stranger /
-- anonymous visibility on the three tables TASK-0002 covers). As later
-- tasks add role-specific RLS policies or finer capabilities, they add
-- rows to this same matrix by calling the same generator, not by writing
-- a new bespoke test file each time.

begin;
select plan(9);

-- The generator: simulates being a specific (or no) authenticated user,
-- runs a row-visibility check against a table, and asserts the result.
-- Supabase's own auth.uid() reads request.jwt.claims -> 'sub', which is
-- exactly what SET LOCAL below fakes for the duration of one test.
create or replace function test_rls_select(
  p_table text,
  p_as_user uuid,      -- null simulates an anonymous/unauthenticated caller
  p_row_id uuid,
  p_expect_visible boolean,
  p_description text
) returns text as $$
declare
  v_visible boolean;
begin
  if p_as_user is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', p_as_user)::text, true);
    perform set_config('role', 'authenticated', true);
  else
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'anon', true);
  end if;

  execute format('select exists(select 1 from public.%I where id = %L)', p_table, p_row_id)
    into v_visible;

  perform set_config('role', 'postgres', true);

  return is(v_visible, p_expect_visible, p_description);
end;
$$ language plpgsql;

-- Fixture: two organizations, a member of each, and a stranger to both.
insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000003')
on conflict do nothing;

insert into public.users (id, email, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'member-a@test', 'Member A'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'member-b@test', 'Member B'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'stranger@test', 'Stranger');

insert into public.organizations (id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Org One');

insert into public.memberships (id, user_id, organization_id, roles) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '{}'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', '{}');

-- Matrix cells, generated through the same function -- not hand-duplicated
-- per case.
select test_rls_select('organizations', 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid, true,
  'org member sees their own organization');
select test_rls_select('organizations', 'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid, false,
  'a stranger to the org does not see it (SR-B05: no cross-org visibility)');
select test_rls_select('organizations', null,
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid, false,
  'an anonymous caller does not see the organization');

select test_rls_select('users', 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, true,
  'a user sees their own row');
select test_rls_select('users', 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'aaaaaaaa-0000-0000-0000-000000000002'::uuid, true,
  'a user sees a co-tenant''s row (shared org membership)');
select test_rls_select('users', 'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, false,
  'a stranger (no shared org) does not see another user''s row');

select test_rls_select('memberships', 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'cccccccc-0000-0000-0000-000000000001'::uuid, true,
  'a member sees their own membership row');
select test_rls_select('memberships', 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'cccccccc-0000-0000-0000-000000000002'::uuid, true,
  'a member sees a co-tenant''s membership row (same org)');
select test_rls_select('memberships', 'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
  'cccccccc-0000-0000-0000-000000000001'::uuid, false,
  'a stranger does not see another org''s membership row');

select * from finish();
rollback;
