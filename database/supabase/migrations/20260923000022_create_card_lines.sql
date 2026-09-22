-- data-specification.md §7.7-7.8 `batter_card_lines`, `bowler_card_lines`
-- One row per batter/bowler, per innings -- the batting/bowling-figure
-- read model. Numeric-rate fields (economy, strike rate, average) are
-- deliberately NOT stored here -- computed at read time from these
-- integer figures, per §7's closing note, so a derived rate can never
-- silently drift from its source integers.

create table public.batter_card_lines (
  id                  uuid primary key,
  innings_id          uuid not null references public.innings (id),
  player_id           uuid not null references public.players (id),
  batting_position    integer null,
  runs                integer not null default 0,
  balls_faced         integer not null default 0,
  fours               integer not null default 0,
  sixes               integer not null default 0,
  status              text not null default 'NOT_OUT'
                         check (status in ('NOT_OUT', 'OUT', 'RETIRED_NOT_OUT', 'RETIRED_OUT', 'ABSENT')),
  wicket_id           uuid null references public.wickets (id)
);

-- §7.7: "wicket_id ... set iff status ∈ {OUT, RETIRED_OUT}" -- biconditional.
alter table public.batter_card_lines
  add constraint batter_card_lines_wicket_biconditional
  check (
    (wicket_id is not null and status in ('OUT', 'RETIRED_OUT'))
    or (wicket_id is null and status not in ('OUT', 'RETIRED_OUT'))
  );

alter table public.batter_card_lines
  add constraint batter_card_lines_innings_player_uq unique (innings_id, player_id);

create index batter_card_lines_innings_id_ix on public.batter_card_lines (innings_id);

create table public.bowler_card_lines (
  id                     uuid primary key,
  innings_id             uuid not null references public.innings (id),
  player_id              uuid not null references public.players (id),
  legal_balls_bowled     integer not null default 0,
  maidens                integer not null default 0,
  runs_charged           integer not null default 0,
  wickets                integer not null default 0,
  wides_bowled           integer not null default 0,
  no_balls_bowled        integer not null default 0
);

alter table public.bowler_card_lines
  add constraint bowler_card_lines_innings_player_uq unique (innings_id, player_id);

create index bowler_card_lines_innings_id_ix on public.bowler_card_lines (innings_id);

grant select on public.batter_card_lines to authenticated;
grant select on public.bowler_card_lines to authenticated;
alter table public.batter_card_lines enable row level security;
alter table public.bowler_card_lines enable row level security;
