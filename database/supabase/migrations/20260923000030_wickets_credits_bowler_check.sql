-- Addendum to TASK-0010's wickets table. live-scoring.md §9.4 gives the
-- exact, confirmed mode -> creditsBowler mapping that TASK-0010 flagged
-- as unavailable at the time (a wrong CHECK there would have silently
-- rejected valid inserts, so none was added). Confirmed while
-- implementing TASK-0021, closing that gap now with the real mapping.
-- Forward-only migration, per this repository's convention.

alter table public.wickets
  add constraint wickets_credits_bowler_biconditional
  check (
    (credits_bowler and mode in ('BOWLED', 'CAUGHT', 'LBW', 'STUMPED', 'HIT_WICKET'))
    or (not credits_bowler and mode in ('RUN_OUT', 'OBSTRUCTING_THE_FIELD', 'HIT_BALL_TWICE', 'TIMED_OUT', 'RETIRED_OUT'))
  );
