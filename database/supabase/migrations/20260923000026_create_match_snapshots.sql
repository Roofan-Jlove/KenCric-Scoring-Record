-- data-specification.md §8.3 `match_snapshots`
-- The full, immutable projection captured at each sign-off version.
-- "Immutability: a snapshot_version > 0 row (tied to a real sign-off) is
-- never updated once written -- permanent, per AUD-008." snapshot_version
-- = 0 is explicitly reserved for a periodic in-progress display cache,
-- which is NOT claimed to be immutable -- so the freeze below is
-- conditional, not a blanket append-only rule like sign_offs/
-- reconciliation_reports.

create table public.match_snapshots (
  id                    uuid primary key,
  match_id              uuid not null references public.matches (id),
  snapshot_version      integer not null,
  as_of_event_ordinal   numeric(20,10) not null,
  projection            jsonb not null,
  created_at            timestamptz not null default now()
);

-- §8.3: "UQ: (match_id, snapshot_version) where snapshot_version > 0" --
-- a partial unique index, since snapshot_version = 0 (the in-progress
-- cache) is explicitly excluded from that uniqueness requirement.
create unique index match_snapshots_match_version_uq
  on public.match_snapshots (match_id, snapshot_version)
  where snapshot_version > 0;

create index match_snapshots_match_id_ix on public.match_snapshots (match_id);

grant select, insert on public.match_snapshots to authenticated;

-- Conditional freeze: only snapshot_version > 0 rows are immutable.
-- snapshot_version = 0 rows may be updated/replaced freely (the
-- in-progress cache's whole purpose is to be refreshed).
create or replace function public.match_snapshots_enforce_freeze()
returns trigger as $$
begin
  if old.snapshot_version > 0 then
    raise exception 'match_snapshots row % is a permanent sign-off snapshot (snapshot_version > 0) and cannot be %, per data-specification.md §8.3, AUD-008',
      old.id, tg_op;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger match_snapshots_block_update
  before update on public.match_snapshots
  for each row
  execute function public.match_snapshots_enforce_freeze();

create trigger match_snapshots_block_delete
  before delete on public.match_snapshots
  for each row
  execute function public.match_snapshots_enforce_freeze();

alter table public.match_snapshots enable row level security;
