-- data-specification.md §7.6 `partnerships`
-- One row per partnership segment (INV-007's basis).

create table public.partnerships (
  id                       uuid primary key,
  innings_id               uuid not null references public.innings (id),
  wicket_number            integer not null,
  batter_a_id              uuid not null references public.players (id),
  batter_b_id              uuid not null references public.players (id),
  runs                     integer not null default 0,
  balls                    integer not null default 0,
  batter_a_contribution    integer not null default 0,
  batter_b_contribution    integer not null default 0,
  is_unbroken              boolean not null default false
);

alter table public.partnerships
  add constraint partnerships_innings_wicket_uq unique (innings_id, wicket_number);

create index partnerships_innings_id_ix on public.partnerships (innings_id);

grant select on public.partnerships to authenticated;
alter table public.partnerships enable row level security;
