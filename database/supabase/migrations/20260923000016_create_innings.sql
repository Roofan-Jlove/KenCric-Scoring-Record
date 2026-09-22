-- data-specification.md §7.1 `innings`
-- Derived, not directly inserted (§1.1/§7 intro) -- populated only by the
-- projector folding match_events, never by a client command directly.
-- No created_by/updated_by: "who caused this row's current value" is
-- answered by the underlying match_events.actor_ref, not a separate audit
-- trail here (MBR-01, "no side channel").

create table public.innings (
  id                    uuid primary key,
  match_id              uuid not null references public.matches (id),
  innings_number        integer not null,
  batting_team_id       uuid not null references public.teams (id),
  bowling_team_id       uuid not null references public.teams (id),
  overs_allotted        integer null,
  total_runs            integer not null default 0,
  extras_byes           integer not null default 0,
  extras_leg_byes       integer not null default 0,
  extras_wides          integer not null default 0,
  extras_no_balls       integer not null default 0,
  extras_penalty        integer not null default 0,
  wickets_lost          integer not null default 0,
  legal_balls_bowled    integer not null default 0,
  target                integer null,
  free_hit_pending      boolean not null default false,
  state                 text not null default 'NOT_STARTED'
                           check (state in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE')),
  end_reason            text null
                           check (end_reason is null or end_reason in ('ALL_OUT', 'OVERS_COMPLETE', 'TARGET_REACHED', 'DECLARATION', 'FORFEITURE')),
  as_of_event_ordinal   numeric(20,10) not null
);

alter table public.innings
  add constraint innings_match_number_uq unique (match_id, innings_number);

create index innings_match_id_ix on public.innings (match_id);

-- Grants: read-only for ordinary application roles. This table is
-- populated only by the projector (backend/src/projection, running under
-- service_role, which bypasses grants/RLS by default in Supabase and
-- needs no explicit grant here) -- never by a client command directly.
grant select on public.innings to authenticated;

-- Safety addition, same reasoning as TASK-0007: RLS enabled with zero
-- policies yet (deny-all default) -- match-scoped read authorization
-- isn't designed by this task, and granting SELECT without RLS would let
-- any authenticated user read every match's innings, not just ones
-- they're entitled to.
alter table public.innings enable row level security;
