-- data-specification.md §8.1 `sign_offs`
-- One row per sign-off/counter-signature/post-Final re-sign-off.
-- "Immutability: every row is permanent once created -- never updated,
-- never deleted, even by a later correction (BR-006)."

create table public.sign_offs (
  id                     uuid primary key,
  match_id               uuid not null references public.matches (id),
  version                integer not null,
  signed_by              uuid not null references public.users (id),
  counter_signatures     jsonb null,
  reconciliation_state   text not null
                            check (reconciliation_state in ('PASS', 'OVERRIDE')),
  override_reason        text null,
  signed_at              timestamptz not null,
  supersedes_version     integer null
);

alter table public.sign_offs
  add constraint sign_offs_match_version_uq unique (match_id, version);

-- §8.1: "supersedes_version ... Self-referential via (match_id, version)".
-- Unlike reference_data's version FK (TASK-0005's flagged gap), this one
-- IS validly expressible: both columns live on this same table, and the
-- target (match_id, version) pair already has the unique constraint above.
alter table public.sign_offs
  add constraint sign_offs_supersedes_fk
  foreign key (match_id, supersedes_version) references public.sign_offs (match_id, version);

-- §8.1: "override_reason ... Set iff reconciliation_state = OVERRIDE" (BR-007).
alter table public.sign_offs
  add constraint sign_offs_override_reason_biconditional
  check (
    (override_reason is not null and reconciliation_state = 'OVERRIDE')
    or (override_reason is null and reconciliation_state <> 'OVERRIDE')
  );

create index sign_offs_match_id_ix on public.sign_offs (match_id);

-- Append-only enforcement, same reasoning and pattern as TASK-0007's
-- match_events: GRANT restricts ordinary roles to INSERT-only; a trigger
-- hard-blocks UPDATE/DELETE for every role including the table owner,
-- since GRANT/REVOKE alone cannot bind it.
grant select, insert on public.sign_offs to authenticated;

create or replace function public.sign_offs_block_mutation()
returns trigger as $$
begin
  raise exception 'sign_offs is append-only: % is not permitted (data-specification.md §8.1, BR-006)', tg_op;
end;
$$ language plpgsql;

create trigger sign_offs_block_update
  before update on public.sign_offs
  for each row
  execute function public.sign_offs_block_mutation();

create trigger sign_offs_block_delete
  before delete on public.sign_offs
  for each row
  execute function public.sign_offs_block_mutation();

alter table public.sign_offs enable row level security;
