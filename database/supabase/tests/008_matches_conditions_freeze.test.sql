-- Behavioral test for TASK-0008 (reference-data pin/conditions freeze).
-- Per the task's own stated verification procedure: attempting the
-- forbidden update after a delivery exists, asserting rejection; and
-- confirming the same update succeeds freely before any delivery exists.

begin;
select plan(3);

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
  '{"overs": 20}'::jsonb,
  1,
  'UTC'
);

-- Before any delivery exists, changing the pinned profile is unrestricted.
select lives_ok(
  $$ update public.matches set conditions_profile_version = 2
     where id = '33333333-3333-3333-3333-333333333333' $$,
  'conditions_profile_version may change freely before any delivery is recorded'
);

-- Record a delivery (a match_events row).
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
  'EVT-DELIVERY-RECORDED',
  1,
  '{}'::jsonb,
  '77777777-7777-7777-7777-777777777777',
  '{}'::jsonb,
  now(),
  'GENESIS',
  'hash-of-event-1'
);

-- After a delivery exists, changing the pinned profile is rejected.
select throws_ok(
  $$ update public.matches set conditions_profile_version = 3
     where id = '33333333-3333-3333-3333-333333333333' $$,
  null, 'matches.% is frozen after the first delivery%',
  'conditions_profile_version is frozen once a delivery has been recorded'
);

-- An unrelated field (venue) may still be updated after a delivery exists
-- -- the freeze is scoped to the conditions/reference-data fields only.
select lives_ok(
  $$ update public.matches set venue = 'Updated Venue'
     where id = '33333333-3333-3333-3333-333333333333' $$,
  'unrelated fields remain updatable after a delivery is recorded'
);

select * from finish();
rollback;
