-- data-specification.md §10.4 `export_jobs` -- added by RCR, 2026-10-05
-- (TASK-0150). `TASK-0103`'s own doc comment already found this gap:
-- no export_jobs-style table exists anywhere in this schema's own
-- catalogue, only a generic EXPORT category inside audit_log.category's
-- enum (which records that an export happened, not a queryable job
-- record). api-specification.md §15.1/§15.2's own request/response
-- contracts already give the complete field shape -- this table is a
-- direct transcription of that already-fully-specified API contract,
-- the same "not an invention" finding TASK-0103 already made for
-- backend/src/commands/exportJobs.ts's own ExportJobRow, which this
-- migration mirrors field-for-field.

create table public.export_jobs (
  export_id          uuid primary key,
  match_id           uuid not null references public.matches (id),
  format             text not null
                        check (format in ('PDF', 'CSV', 'CRICSHEET')),
  include_branding   boolean not null default false,
  status             text not null default 'QUEUED'
                        check (status in ('QUEUED', 'PROCESSING', 'READY', 'FAILED')),
  download_url       text null,
  expires_at         timestamptz null,
  failure_reason     text null,
  requested_by       uuid not null references public.users (id),
  queued_at          timestamptz not null default now()
);

create index export_jobs_match_id_ix on public.export_jobs (match_id);
create index export_jobs_requested_by_ix on public.export_jobs (requested_by);

-- A requester can see their own export jobs (status/download link);
-- only the command handler (service role, via the Edge Function) and
-- a future rendering worker ever write status transitions -- no
-- client-writable UPDATE policy, matching exportJobs.ts's own
-- "worker-side transition" framing (markExportProcessing/Ready/Failed
-- are never client-callable).
alter table public.export_jobs enable row level security;

create policy export_jobs_select_own on public.export_jobs
  for select
  using (requested_by = auth.uid());
