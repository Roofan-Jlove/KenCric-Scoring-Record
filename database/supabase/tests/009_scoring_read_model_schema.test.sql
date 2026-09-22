-- Schema-conformance test for TASK-0009 (innings, overs, deliveries,
-- delivery_run_events). Verifies structure against data-specification.md
-- §7.1–7.4 field-for-field, plus the "enforced by grants" requirement.

begin;
select plan(14);

-- innings
select has_table('public', 'innings', 'innings table exists');
select col_default_is('public', 'innings', 'state', 'NOT_STARTED', 'innings.state defaults to NOT_STARTED');
select hasnt_column('public', 'innings', 'created_by',
  'innings has no created_by (MBR-01: no side channel, attribution lives on match_events)');

-- overs
select has_table('public', 'overs', 'overs table exists');
select col_is_null('public', 'overs', 'is_maiden', 'overs.is_maiden is nullable (null until over is complete)');

-- deliveries
select has_table('public', 'deliveries', 'deliveries table exists');
select col_is_fk('public', 'deliveries', 'superseded_by_event_id', 'deliveries.superseded_by_event_id is a foreign key');
select col_is_null('public', 'deliveries', 'superseded_by_event_id', 'deliveries.superseded_by_event_id is nullable');

-- delivery_run_events
select has_table('public', 'delivery_run_events', 'delivery_run_events table exists');
select col_has_check('public', 'delivery_run_events', 'origin', 'delivery_run_events.origin has a check constraint');

-- Grants: SELECT only for authenticated, on all four tables.
select ok(
  exists(select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'innings' and grantee = 'authenticated' and privilege_type = 'SELECT'),
  'authenticated has SELECT on innings'
);
select ok(
  not exists(select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'deliveries' and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  'authenticated has no INSERT/UPDATE/DELETE on deliveries (projector-only writes)'
);

-- RLS enabled (deny-all by default) on all four, same safety pattern as TASK-0007.
select ok(
  (select relrowsecurity from pg_class where relname = 'innings' and relnamespace = 'public'::regnamespace),
  'RLS is enabled on innings'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'overs' and relnamespace = 'public'::regnamespace),
  'RLS is enabled on overs'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'deliveries' and relnamespace = 'public'::regnamespace),
  'RLS is enabled on deliveries'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'delivery_run_events' and relnamespace = 'public'::regnamespace),
  'RLS is enabled on delivery_run_events'
);

select * from finish();
rollback;
