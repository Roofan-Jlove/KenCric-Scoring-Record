-- data-specification.md §4.2 `players`
-- CRUD-entity table (§1.4), client-generated id -- ad-hoc players created
-- offline routinely (FR-033). Soft deletion is policy 2: merge
-- (status = MERGED + merged_into_player_id), never a hard delete -- the
-- losing row must stay resolvable forever for every historical FK pointing
-- at it (BR-044).

create table public.players (
  id                     uuid primary key,
  organization_id        uuid null references public.organizations (id),
  name                   text not null,
  dob                    date null,
  photo_ref              text null,
  status                 text not null default 'ACTIVE'
                            check (status in ('ACTIVE', 'MERGED')),
  merged_into_player_id  uuid null references public.players (id),
  row_version            integer not null default 1,
  created_at             timestamptz not null default now(),
  created_by             uuid null,
  updated_at             timestamptz not null default now(),
  updated_by             uuid null
);

-- data-specification.md §4.2: "merged_into_player_id IS NOT NULL ⇔ status = MERGED".
alter table public.players
  add constraint players_merge_biconditional
  check (
    (merged_into_player_id is not null and status = 'MERGED')
    or (merged_into_player_id is null and status <> 'MERGED')
  );

create index players_organization_id_ix on public.players (organization_id);
create index players_name_trgm_ix on public.players using gin (name gin_trgm_ops);
create index players_merged_into_player_id_ix on public.players (merged_into_player_id);
