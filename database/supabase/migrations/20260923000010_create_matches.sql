-- data-specification.md §5.1 `matches`
-- The match header -- setup, lineups, toss, lifecycle state. The
-- ball-by-ball facts themselves live in match_events (§6)/the read model,
-- not here. Client-generated id -- a match is always created offline-first
-- (FR-001/016/017).
--
-- KNOWN GAP, flagged not silently worked around: conditions_profile_version
-- and dls_table_version are specified as "FK -> reference_data.version
-- (kind = X)", but reference_data's primary key is the COMPOSITE
-- (kind, version) -- the same version number can legitimately exist under
-- different kinds ("monotonically increasing per kind"). A plain
-- single-column FK to reference_data.version is not valid against that
-- composite key without either a generated companion "kind" column not
-- listed in §5.1's field table, or a trigger-based check. Neither is
-- implemented here -- the columns exist exactly as specified, but
-- referential integrity for these two fields is not yet database-enforced.
-- Needs a decision: add the (undocumented) companion column, or a trigger.

create table public.matches (
  id                            uuid primary key,
  organization_id               uuid null references public.organizations (id),
  origin_device_id              uuid not null,
  claim_status                  text not null default 'GUEST'
                                   check (claim_status in ('GUEST', 'CLAIMED')),
  home_team_id                  uuid not null references public.teams (id),
  away_team_id                  uuid not null references public.teams (id),
  home_xi                       jsonb null,
  away_xi                       jsonb null,
  officials_summary             jsonb null,
  format                        text not null
                                   check (format in ('T20', 'ODI', 'T10', 'THE_HUNDRED', 'CUSTOM', 'FIRST_CLASS')),
  overs_allotted                integer null,
  conditions_profile            jsonb not null,
  conditions_profile_version    integer not null,
  dls_table_version             integer null,
  rain_method                   text not null default 'NONE'
                                   check (rain_method in ('DLS_STANDARD', 'NONE')),
  toss_winner_team_id           uuid null references public.teams (id),
  toss_decision                 text null
                                   check (toss_decision is null or toss_decision in ('BAT', 'BOWL')),
  venue                         text null,
  scheduled_start                timestamptz null,
  match_timezone                text not null,
  min_overs_for_result           integer null,
  state                          text not null default 'SCHEDULED'
                                   check (state in ('SCHEDULED', 'READY', 'IN_PROGRESS', 'INNINGS_BREAK', 'PAUSED', 'COMPLETE', 'ABANDONED')),
  result                         jsonb null,
  row_version                    integer not null default 1,
  created_at                     timestamptz not null default now(),
  created_by                     uuid null,
  updated_at                     timestamptz not null default now(),
  updated_by                     uuid null
);

alter table public.matches
  add constraint matches_distinct_teams check (home_team_id <> away_team_id);

create index matches_organization_id_ix on public.matches (organization_id);
create index matches_state_ix on public.matches (state);
create index matches_home_away_team_ix on public.matches (home_team_id, away_team_id);
create index matches_scheduled_start_ix on public.matches (scheduled_start);
