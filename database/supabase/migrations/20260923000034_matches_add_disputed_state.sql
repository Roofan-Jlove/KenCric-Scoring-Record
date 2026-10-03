-- data-specification.md §5.1 `matches.state` -- RCR, 2026-10-04
-- (TASK-0122). Adds the `DISPUTED` value api-specification.md §11.4's
-- own contract assumed already existed. Postgres has no `ALTER CHECK`
-- -- the existing constraint (20260923000010_create_matches.sql) must
-- be dropped and recreated with the widened value list.

alter table public.matches
  drop constraint matches_state_check;

alter table public.matches
  add constraint matches_state_check
    check (state in ('SCHEDULED', 'READY', 'IN_PROGRESS', 'INNINGS_BREAK', 'PAUSED', 'COMPLETE', 'ABANDONED', 'DISPUTED'));
