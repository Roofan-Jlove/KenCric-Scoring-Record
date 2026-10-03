-- data-specification.md §8.5 `divergences` -- a real pre-existing gap
-- found and filled by TASK-0125: this table was already fully specified
-- in §8.5 since early this session (TASK-0038's own SVC-DIVERGENCE-DETECTOR
-- task), but no migration file for it was ever written. Transcribed
-- directly from the already-complete spec, nothing invented here.

create table public.divergences (
  id                uuid primary key,
  match_id          uuid not null references public.matches (id),
  over_ball         text not null,
  field             text not null,
  -- Logical reference, not a physical FK -- streams are identified
  -- within match_events, not their own table (§8.5's own note).
  stream_a_id       uuid not null,
  stream_b_id       uuid not null,
  value_a           jsonb not null,
  value_b           jsonb not null,
  -- Implemented as a CHECK, not a native Postgres enum type, matching
  -- every other status/state column's own convention in this migration set.
  status            text not null default 'OPEN'
                       check (status in ('OPEN', 'PROPOSED', 'RESOLVED')),
  proposed_value    jsonb null,
  proposed_by       uuid null references public.users (id),
  confirmed_by      uuid null references public.users (id),
  resolved_event_id uuid null references public.match_events (event_id)
);

alter table public.divergences
  add constraint divergences_distinct_confirmer check (confirmed_by is distinct from proposed_by);

create index divergences_match_id_ix on public.divergences (match_id);
create index divergences_status_ix on public.divergences (status);

alter table public.divergences enable row level security;

-- Visible to org members of the match's own organization, same pattern
-- 20260923000008's own file already established.
create policy divergences_select on public.divergences
  for select
  using (
    exists (
      select 1 from public.matches m
      join public.memberships mem on mem.organization_id = m.organization_id
      where m.id = divergences.match_id
        and m.organization_id is not null
        and mem.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies -- detection/propose/confirm all go
-- through backend command handlers (divergenceDetector.ts,
-- divergenceResolution.ts, TASK-0125), same default-deny-writes
-- convention every other command-backed table in this migration set uses.
