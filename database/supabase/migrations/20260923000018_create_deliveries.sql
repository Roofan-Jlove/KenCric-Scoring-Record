-- data-specification.md §7.3 `deliveries`
-- The typed read-model twin of the delivery-shaped subset of match_events
-- -- what scorecard/ball-by-ball rendering actually reads from, rather
-- than replaying raw events on every screen paint. The ONE read-model
-- table where "update in place" is correct (§7.3's own note): a corrected
-- delivery's row is updated to reflect the current active fold, since
-- this is a disposable cache of the *current* derivation, not a
-- historical log -- the full history lives in match_events.

create table public.deliveries (
  id                        uuid primary key,
  event_id                  uuid not null references public.match_events (event_id),
  innings_id                uuid not null references public.innings (id),
  over_id                   uuid not null references public.overs (id),
  ball_in_over              integer not null,
  event_ordinal             numeric(20,10) not null,
  legality                  text not null
                               check (legality in ('LEGAL', 'WIDE', 'NO_BALL', 'DEAD_BALL')),
  striker_id                uuid not null references public.players (id),
  non_striker_id            uuid not null references public.players (id),
  bowler_id                 uuid not null references public.players (id),
  is_free_hit               boolean not null default false,
  total_runs                integer not null default 0,
  batter_runs                integer not null default 0,
  short_runs                 integer not null default 0,
  dead_ball_reason           text null,
  commentary                 text null,
  override_reason            text null,
  superseded_by_event_id     uuid null references public.match_events (event_id)
);

alter table public.deliveries
  add constraint deliveries_innings_ordinal_uq unique (innings_id, event_ordinal);

create index deliveries_innings_id_ix on public.deliveries (innings_id);
create index deliveries_over_id_ix on public.deliveries (over_id);
create index deliveries_bowler_id_ix on public.deliveries (bowler_id);
create index deliveries_striker_id_ix on public.deliveries (striker_id);

grant select on public.deliveries to authenticated;
alter table public.deliveries enable row level security;
