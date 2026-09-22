-- Schema-conformance test for TASK-0010 (wickets, partnerships,
-- batter_card_lines, bowler_card_lines), plus the deliveries addendum.
-- Verifies structure against data-specification.md §7.3/§7.5–7.8.

begin;
select plan(12);

-- wickets
select has_table('public', 'wickets', 'wickets table exists');
select col_is_null('public', 'wickets', 'delivery_id', 'wickets.delivery_id is nullable (null for TIMED_OUT/RETIRED_OUT)');
select col_has_check('public', 'wickets', 'mode', 'wickets.mode has a check constraint');
select col_type_is('public', 'wickets', 'fielder_ids', 'uuid[]', 'wickets.fielder_ids is a uuid array');

-- partnerships
select has_table('public', 'partnerships', 'partnerships table exists');
select col_default_is('public', 'partnerships', 'is_unbroken', 'false', 'partnerships.is_unbroken defaults to false');

-- batter_card_lines
select has_table('public', 'batter_card_lines', 'batter_card_lines table exists');
select col_default_is('public', 'batter_card_lines', 'status', 'NOT_OUT', 'batter_card_lines.status defaults to NOT_OUT');
select hasnt_column('public', 'batter_card_lines', 'strike_rate',
  'batter_card_lines has no stored strike_rate (computed at read time, per §7 closing note)');

-- bowler_card_lines
select has_table('public', 'bowler_card_lines', 'bowler_card_lines table exists');
select hasnt_column('public', 'bowler_card_lines', 'economy',
  'bowler_card_lines has no stored economy (computed at read time)');

-- Grants: SELECT only, same pattern as TASK-0009.
select ok(
  not exists(select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'wickets' and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  'authenticated has no INSERT/UPDATE/DELETE on wickets (projector-only writes)'
);

-- Addendum: deliveries' dead_ball_reason biconditional now exists.
select ok(
  exists(select 1 from pg_constraint where conname = 'deliveries_dead_ball_reason_biconditional'),
  'deliveries has the dead_ball_reason biconditional check (addendum to TASK-0009)'
);

select * from finish();
rollback;
