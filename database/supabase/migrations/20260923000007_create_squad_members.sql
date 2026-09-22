-- data-specification.md §4.3 `squad_members`
-- CRUD-entity table (§1.4). Composite PK (team_id, player_id) -- an
-- add/remove join, not an edited entity, hence no updated_at/updated_by
-- (§4.3's own note). Ordinary hard delete on removal: the historical fact
-- of having played a match is carried by batter_card_lines/bowler_card_lines
-- (§7.7-7.8), not by squad membership, so this never orphans a historical
-- reference.

create table public.squad_members (
  team_id     uuid not null references public.teams (id),
  player_id   uuid not null references public.players (id),
  role_hint   text null,
  created_at  timestamptz not null default now(),
  created_by  uuid null,
  primary key (team_id, player_id)
);

create index squad_members_team_id_ix on public.squad_members (team_id);
