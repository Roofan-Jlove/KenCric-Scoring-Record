-- Schema-conformance test for TASK-0006 (match_events).
-- Verifies structure against data-specification.md §6.1 field-for-field.
-- Scope: schema shape only. Grant/append-only and hash-chain-verification
-- behavior are TASK-0007's job, not tested here.

begin;
select plan(10);

select has_table('public', 'match_events', 'match_events table exists');
select col_is_pk('public', 'match_events', 'event_id', 'match_events.event_id is the primary key');
select col_is_fk('public', 'match_events', 'match_id', 'match_events.match_id is a foreign key');
select col_is_null('public', 'match_events', 'supersedes', 'match_events.supersedes is nullable (set only on a correction)');
select col_is_null('public', 'match_events', 'voids', 'match_events.voids is nullable (set only on an undo)');
select col_is_null('public', 'match_events', 'server_received_at', 'match_events.server_received_at is nullable (null until synced)');
select col_not_null('public', 'match_events', 'prev_hash', 'match_events.prev_hash is not null');
select col_not_null('public', 'match_events', 'hash', 'match_events.hash is not null');
select col_is_unique('public', 'match_events', array['scorer_stream_id', 'device_id', 'device_seq'],
  'match_events (scorer_stream_id, device_id, device_seq) is unique');
select has_index('public', 'match_events', 'match_events_canonical_order_ix', 'canonical read-order index exists');

select * from finish();
rollback;
