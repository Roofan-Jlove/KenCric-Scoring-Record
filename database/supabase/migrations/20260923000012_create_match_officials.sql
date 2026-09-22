-- data-specification.md §5.3 `match_officials`
-- Which official served which role on which match. Composite PK
-- (match_id, official_id, role) -- the same official can hold more than
-- one role only via distinct rows. No update column: reassignment is a
-- remove+add (§5.3's own note), same pattern as squad_members.

create table public.match_officials (
  match_id     uuid not null references public.matches (id),
  official_id  uuid not null references public.officials (id),
  role         text not null
                 check (role in ('UMPIRE', 'THIRD_UMPIRE', 'REFEREE', 'HEAD_SCORER', 'ASSISTANT_SCORER')),
  created_at   timestamptz not null default now(),
  created_by   uuid null,
  primary key (match_id, official_id, role)
);

create index match_officials_match_id_ix on public.match_officials (match_id);
