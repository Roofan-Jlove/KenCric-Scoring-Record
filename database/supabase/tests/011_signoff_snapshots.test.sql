-- Behavioral test for TASK-0011 (sign_offs, reconciliation_reports,
-- match_snapshots). Confirms append-only enforcement on the first two,
-- and match_snapshots' conditional freeze (version = 0 updatable,
-- version > 0 permanently frozen).

begin;
select plan(6);

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

-- sign_offs is append-only.
insert into public.sign_offs (
  id, match_id, version, signed_by, reconciliation_state, signed_at
) values (
  '55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333',
  1,
  '77777777-7777-7777-7777-777777777777',
  'PASS',
  now()
);

select throws_ok(
  $$ update public.sign_offs set reconciliation_state = 'OVERRIDE' where id = '55555555-5555-5555-5555-555555555555' $$,
  null, 'sign_offs is append-only%',
  'UPDATE on sign_offs is rejected'
);
select throws_ok(
  $$ delete from public.sign_offs where id = '55555555-5555-5555-5555-555555555555' $$,
  null, 'sign_offs is append-only%',
  'DELETE on sign_offs is rejected'
);

-- reconciliation_reports is append-only.
insert into public.reconciliation_reports (
  id, match_id, checkpoint, results, as_of_event_ordinal
) values (
  '88888888-8888-8888-8888-888888888888',
  '33333333-3333-3333-3333-333333333333',
  'INTERVAL',
  '[]'::jsonb,
  1.0
);

select throws_ok(
  $$ update public.reconciliation_reports set checkpoint = 'SIGN_OFF' where id = '88888888-8888-8888-8888-888888888888' $$,
  null, 'reconciliation_reports is append-only%',
  'UPDATE on reconciliation_reports is rejected'
);

-- match_snapshots: version = 0 is freely updatable.
insert into public.match_snapshots (
  id, match_id, snapshot_version, as_of_event_ordinal, projection
) values (
  '99999999-9999-9999-9999-999999999999',
  '33333333-3333-3333-3333-333333333333',
  0,
  1.0,
  '{}'::jsonb
);

select lives_ok(
  $$ update public.match_snapshots set projection = '{"updated": true}'::jsonb
     where id = '99999999-9999-9999-9999-999999999999' $$,
  'match_snapshots version = 0 (in-progress cache) may be updated freely'
);

-- match_snapshots: version > 0 is permanently frozen.
insert into public.match_snapshots (
  id, match_id, snapshot_version, as_of_event_ordinal, projection
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333',
  1,
  1.0,
  '{}'::jsonb
);

select throws_ok(
  $$ update public.match_snapshots set projection = '{"tampered": true}'::jsonb
     where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  null, 'match_snapshots row % is a permanent sign-off snapshot%',
  'match_snapshots version > 0 is permanently frozen'
);

select * from finish();
rollback;
