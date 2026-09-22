-- Behavioral test for TASK-0007 (append-only enforcement + hash-chain
-- verification). Per the task's own stated verification procedure:
-- attempting UPDATE/DELETE and a broken-chain INSERT, all asserted
-- rejected; a correctly-chained INSERT asserted to succeed.

begin;
select plan(5);

-- Fixture: minimal valid rows to satisfy match_events' FK chain.
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

-- First event in the stream: no prior row, any prev_hash accepted.
insert into public.match_events (
  event_id, match_id, scorer_stream_id, device_id, device_seq, hlc,
  event_ordinal, type, event_version, payload, actor_ref, provenance,
  recorded_at, prev_hash, hash
) values (
  '55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333',
  '66666666-6666-6666-6666-666666666666',
  '44444444-4444-4444-4444-444444444444',
  1,
  'hlc-1',
  1.0,
  'EVT-TEST',
  1,
  '{}'::jsonb,
  '77777777-7777-7777-7777-777777777777',
  '{}'::jsonb,
  now(),
  'GENESIS',
  'hash-of-event-1'
);

-- 1. UPDATE is rejected.
select throws_ok(
  $$ update public.match_events set type = 'EVT-TAMPERED' where event_id = '55555555-5555-5555-5555-555555555555' $$,
  null, 'match_events is append-only: UPDATE is not permitted%',
  'UPDATE on match_events is rejected'
);

-- 2. DELETE is rejected.
select throws_ok(
  $$ delete from public.match_events where event_id = '55555555-5555-5555-5555-555555555555' $$,
  null, 'match_events is append-only: DELETE is not permitted%',
  'DELETE on match_events is rejected'
);

-- 3. A correctly-chained INSERT succeeds.
select lives_ok(
  $$ insert into public.match_events (
       event_id, match_id, scorer_stream_id, device_id, device_seq, hlc,
       event_ordinal, type, event_version, payload, actor_ref, provenance,
       recorded_at, prev_hash, hash
     ) values (
       '88888888-8888-8888-8888-888888888888',
       '33333333-3333-3333-3333-333333333333',
       '66666666-6666-6666-6666-666666666666',
       '44444444-4444-4444-4444-444444444444',
       2,
       'hlc-2',
       2.0,
       'EVT-TEST',
       1,
       '{}'::jsonb,
       '77777777-7777-7777-7777-777777777777',
       '{}'::jsonb,
       now(),
       'hash-of-event-1',
       'hash-of-event-2'
     ) $$,
  'A correctly-chained INSERT (matching prev_hash) succeeds'
);

-- 4. A broken-chain INSERT (wrong prev_hash) is rejected.
select throws_ok(
  $$ insert into public.match_events (
       event_id, match_id, scorer_stream_id, device_id, device_seq, hlc,
       event_ordinal, type, event_version, payload, actor_ref, provenance,
       recorded_at, prev_hash, hash
     ) values (
       '99999999-9999-9999-9999-999999999999',
       '33333333-3333-3333-3333-333333333333',
       '66666666-6666-6666-6666-666666666666',
       '44444444-4444-4444-4444-444444444444',
       3,
       'hlc-3',
       3.0,
       'EVT-TEST',
       1,
       '{}'::jsonb,
       '77777777-7777-7777-7777-777777777777',
       '{}'::jsonb,
       now(),
       'WRONG-PREV-HASH',
       'hash-of-event-3'
     ) $$,
  null, 'match_events hash chain broken%',
  'A broken-chain INSERT (wrong prev_hash) is rejected'
);

-- 5. RLS is enabled (deny-all-by-default until match-scoped policies exist).
select ok(
  (select relrowsecurity from pg_class where relname = 'match_events' and relnamespace = 'public'::regnamespace),
  'RLS is enabled on match_events (deny-all until match-scoped policies are added)'
);

select * from finish();
rollback;
