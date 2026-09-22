-- data-specification.md §7.5 `wickets`
-- One row per dismissal, including the non-delivery-attached modes
-- (TIMED_OUT/RETIRED_OUT), hence delivery_id is nullable. mode's 10 values
-- match live-scoring.md §9.1's validity matrix exactly (independently
-- confirmed against adversarial-verification-report.md AVF-SE-01, which
-- found exactly 10 dismissal modes defined anywhere in the corpus, never
-- 11).

create table public.wickets (
  id                          uuid primary key,
  innings_id                  uuid not null references public.innings (id),
  delivery_id                 uuid null references public.deliveries (id),
  event_id                    uuid not null references public.match_events (event_id),
  mode                        text not null
                                 check (mode in ('BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET', 'OBSTRUCTING_THE_FIELD', 'HIT_BALL_TWICE', 'TIMED_OUT', 'RETIRED_OUT')),
  out_batter_id                uuid not null references public.players (id),
  -- Not FK-enforced as an array (§7.5's own note): validated at write time
  -- by the projector, not by the database.
  fielder_ids                  uuid[] null,
  bowler_id                    uuid null references public.players (id),
  -- credits_bowler is specified as "a pure function of mode, never
  -- independently set" (§7.5, live-scoring.md §9.4) -- but the exact
  -- mode -> credits mapping isn't in this migration's confirmed context,
  -- so no CHECK constraint ties the two together here. Storing it
  -- uncorrelated to mode is a known, flagged gap: a future migration
  -- should add `check (credits_bowler = <the §9.4 function of mode>)`
  -- once that mapping is confirmed against the source, rather than risk
  -- a wrong constraint that silently rejects valid inserts.
  credits_bowler                boolean not null,
  end_vacated                   text not null
                                   check (end_vacated in ('STRIKER', 'NON_STRIKER')),
  crossed_before_dismissal       boolean null,
  incoming_batter_id             uuid null references public.players (id),
  team_score_at_fall             integer not null,
  over_ball_at_fall               text null
);

-- §7.5: "crossed_before_dismissal ... Set only for RUN_OUT" -- one
-- directional: may be set for RUN_OUT, must be null otherwise.
alter table public.wickets
  add constraint wickets_crossed_only_for_run_out
  check (crossed_before_dismissal is null or mode = 'RUN_OUT');

create index wickets_innings_id_ix on public.wickets (innings_id);
create index wickets_bowler_id_ix on public.wickets (bowler_id);
create index wickets_out_batter_id_ix on public.wickets (out_batter_id);

grant select on public.wickets to authenticated;
alter table public.wickets enable row level security;
