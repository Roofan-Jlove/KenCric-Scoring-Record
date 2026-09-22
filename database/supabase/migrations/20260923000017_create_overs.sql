-- data-specification.md §7.2 `overs`
-- Explicitly derived (live-scoring.md §16.1: over-completion is never an
-- independently emitted fact) -- one row per over, per innings.

create table public.overs (
  id                    uuid primary key,
  innings_id            uuid not null references public.innings (id),
  over_number           integer not null,
  bowler_id             uuid not null references public.players (id),
  legal_ball_count      integer not null default 0,
  runs_conceded         integer not null default 0,
  is_maiden             boolean null,
  as_of_event_ordinal   numeric(20,10) not null
);

alter table public.overs
  add constraint overs_innings_number_uq unique (innings_id, over_number);

create index overs_innings_id_ix on public.overs (innings_id);
create index overs_bowler_id_ix on public.overs (bowler_id);

grant select on public.overs to authenticated;
alter table public.overs enable row level security;
