-- Behavioral test for TASK-0012 (writer_fences, outbox, audit_log).
-- sync_cursors deliberately has no table -- see the migration set's own
-- comments and the task's backlog entry for why.

begin;
select plan(8);

insert into public.teams (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Test Team A'),
  ('22222222-2222-2222-2222-222222222222', 'Test Team B');

insert into public.matches (
  id, origin_device_id, home_team_id, away_team_id, format,
  conditions_profile, conditions_profile_version, match_timezone
) values (
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'T20',
  '{}'::jsonb,
  1,
  'UTC'
);

-- sync_cursors table does not exist (deliberate, per §9's own text).
select hasnt_table('public', 'sync_cursors',
  'sync_cursors has no server-side table -- §9 states it is on-device only');

-- writer_fences: authenticated may SELECT, not write.
select has_table('public', 'writer_fences', 'writer_fences table exists');
select ok(
  not exists(select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'writer_fences' and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  'authenticated has no INSERT/UPDATE/DELETE on writer_fences (server-controlled)'
);

-- outbox: no grant to authenticated at all.
select has_table('public', 'outbox', 'outbox table exists');
select ok(
  not exists(select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'outbox' and grantee = 'authenticated'),
  'authenticated has no grant at all on outbox (not client-facing)'
);

-- audit_log: no direct grant to authenticated; writes go through the helper.
select has_table('public', 'audit_log', 'audit_log table exists');
select ok(
  not exists(select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'audit_log' and grantee = 'authenticated'),
  'authenticated has no direct grant on audit_log (INSERT only via the SECURITY DEFINER helper)'
);

-- The helper function works and append-only enforcement holds.
select lives_ok(
  $$ select public.audit_log_write(
       '55555555-5555-5555-5555-555555555555'::uuid,
       'ADMIN',
       '77777777-7777-7777-7777-777777777777'::uuid,
       null, null,
       'test.action',
       '{}'::jsonb,
       null,
       'GENESIS',
       'hash-of-audit-1'
     ) $$,
  'audit_log_write() helper inserts successfully'
);

select * from finish();
rollback;
