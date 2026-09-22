-- Reference-data pin immutability. ADR-11 (reference data versioned and
-- pinned per match at creation); data-specification.md §5.1: conditions_profile
-- and conditions_profile_version are "frozen at first ball" (MINV-05,
-- BR-017); dls_table_version pinned identically.
--
-- CORRECTION from the task backlog: implementation-task-backlog.md's
-- TASK-0008 entry names the target column "matches.reference_data_id" --
-- no such column exists. The actual schema (data-specification.md §5.1,
-- transcribed in TASK-0005) has conditions_profile_version and
-- dls_table_version instead. Implemented against the real columns; the
-- backlog entry should be corrected to match (done in the same change
-- that reviews this task).
--
-- Scope: protects conditions_profile, conditions_profile_version, and
-- dls_table_version together -- all three are the same "frozen at first
-- ball" concept per §5.1's own notes, not three separate rules.

create or replace function public.matches_enforce_conditions_freeze()
returns trigger as $$
begin
  if (
    new.conditions_profile is distinct from old.conditions_profile
    or new.conditions_profile_version is distinct from old.conditions_profile_version
    or new.dls_table_version is distinct from old.dls_table_version
  ) and exists (
    select 1 from public.match_events where match_id = old.id
  ) then
    raise exception 'matches.% is frozen after the first delivery (data-specification.md §5.1, ADR-11, MINV-05, BR-017)',
      'conditions_profile/conditions_profile_version/dls_table_version';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger matches_conditions_freeze_trigger
  before update on public.matches
  for each row
  execute function public.matches_enforce_conditions_freeze();
