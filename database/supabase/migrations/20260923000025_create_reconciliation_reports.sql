-- data-specification.md §8.2 `reconciliation_reports`
-- One row per reconciliation checkpoint. "Soft deletion: none -- permanent
-- historical record" -- same append-only treatment as sign_offs.

create table public.reconciliation_reports (
  id                     uuid primary key,
  match_id               uuid not null references public.matches (id),
  checkpoint             text not null
                            check (checkpoint in ('INTERVAL', 'SIGN_OFF')),
  sign_off_id            uuid null references public.sign_offs (id),
  results                jsonb not null,
  as_of_event_ordinal    numeric(20,10) not null,
  created_at             timestamptz not null default now()
);

-- §8.2: "sign_off_id ... set iff checkpoint = SIGN_OFF".
alter table public.reconciliation_reports
  add constraint reconciliation_reports_sign_off_biconditional
  check (
    (sign_off_id is not null and checkpoint = 'SIGN_OFF')
    or (sign_off_id is null and checkpoint <> 'SIGN_OFF')
  );

create index reconciliation_reports_match_id_ix on public.reconciliation_reports (match_id);
create index reconciliation_reports_sign_off_id_ix on public.reconciliation_reports (sign_off_id);

grant select, insert on public.reconciliation_reports to authenticated;

create or replace function public.reconciliation_reports_block_mutation()
returns trigger as $$
begin
  raise exception 'reconciliation_reports is append-only: % is not permitted (data-specification.md §8.2)', tg_op;
end;
$$ language plpgsql;

create trigger reconciliation_reports_block_update
  before update on public.reconciliation_reports
  for each row
  execute function public.reconciliation_reports_block_mutation();

create trigger reconciliation_reports_block_delete
  before delete on public.reconciliation_reports
  for each row
  execute function public.reconciliation_reports_block_mutation();

alter table public.reconciliation_reports enable row level security;
