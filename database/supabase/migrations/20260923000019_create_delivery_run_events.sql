-- data-specification.md §7.4 `delivery_run_events`
-- The normalised Runs and Extras table -- one row per RunEvent
-- (live-scoring.md §7.1), child of deliveries. Zero, one, or several rows
-- per delivery.

create table public.delivery_run_events (
  id                   uuid primary key,
  delivery_id          uuid not null references public.deliveries (id),
  sequence             integer not null,
  origin               text not null
                          check (origin in ('OFF_BAT', 'BYE', 'LEG_BYE', 'WIDE', 'NO_BALL_PENALTY', 'NO_BALL_BAT', 'NO_BALL_BYE', 'NO_BALL_LEG_BYE', 'PENALTY')),
  value                integer not null check (value >= 0),
  method               text not null
                          check (method in ('RUN', 'BOUNDARY', 'OVERTHROW', 'AUTOMATIC')),
  awarded_to_team_id   uuid null references public.teams (id)
);

-- §7.4: "awarded_to_team_id IS NOT NULL ⇔ origin = 'PENALTY'".
alter table public.delivery_run_events
  add constraint delivery_run_events_penalty_biconditional
  check (
    (awarded_to_team_id is not null and origin = 'PENALTY')
    or (awarded_to_team_id is null and origin <> 'PENALTY')
  );

alter table public.delivery_run_events
  add constraint delivery_run_events_delivery_sequence_uq unique (delivery_id, sequence);

create index delivery_run_events_delivery_id_ix on public.delivery_run_events (delivery_id);

grant select on public.delivery_run_events to authenticated;
alter table public.delivery_run_events enable row level security;
