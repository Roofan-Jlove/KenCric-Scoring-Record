-- Addendum to TASK-0009's deliveries table. data-specification.md §7.3
-- specifies dead_ball_reason "Set iff legality = DEAD_BALL" -- an explicit
-- biconditional that was missed when deliveries was first created
-- (20260923000018_create_deliveries.sql). Caught while implementing
-- TASK-0010's wickets table, whose own similarly-worded constraints
-- prompted a re-check of the sibling table. Forward-only migration, per
-- this repository's convention -- not an edit to the original file.

alter table public.deliveries
  add constraint deliveries_dead_ball_reason_biconditional
  check (
    (dead_ball_reason is not null and legality = 'DEAD_BALL')
    or (dead_ball_reason is null and legality <> 'DEAD_BALL')
  );
