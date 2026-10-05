-- data-specification.md §10.5/§10.6 -- added by RCR, 2026-10-05
-- (TASK-0157). accountDataLifecycle.ts's own TASK-0104 doc comment
-- already flagged this gap: §11.9's own text says personal-data
-- export "reuses the same export-job mechanism as a match scorecard
-- export," but true code-level table reuse would mean generalising
-- export_jobs' own matchId-specific shape into a subject-agnostic
-- one -- deliberately not done, a parallel, intentionally-duplicated
-- state machine instead (same reasoning that module's own doc
-- comment already gives for not touching a previously-merged task's
-- contract uninvited). These two tables are the storage half of that
-- already-decided design, never built until now.
--
-- §11.9's own Authz line is "the user themselves only" -- unlike
-- every prior Edge-Function-backing table this session (disputes/
-- organizations/memberships/invitations/divergences, all found with
-- NO write grant at all), these two are correctly granted INSERT/
-- SELECT to authenticated from the start, gated by user_id = auth.uid()
-- -- there is no app-level admin/scorer check to enforce here, so no
-- RLS-policy gap to retrofit around.

create table public.personal_data_exports (
  export_id        uuid primary key,
  user_id          uuid not null references public.users (id),
  status           text not null default 'QUEUED'
                      check (status in ('QUEUED', 'PROCESSING', 'READY', 'FAILED')),
  download_url     text null,
  expires_at       timestamptz null,
  failure_reason   text null,
  requested_at     timestamptz not null default now()
);

create index personal_data_exports_user_id_ix on public.personal_data_exports (user_id);

alter table public.personal_data_exports enable row level security;

-- A user may see and create only their own export requests. UPDATE
-- (status transitions) has no client-facing grant at all -- written
-- only by the command handler and a future rendering worker, never
-- by a client directly, the identical "no client UPDATE grant"
-- convention export_jobs (TASK-0150) already uses for its own
-- worker-side transitions.
grant select, insert on public.personal_data_exports to authenticated;

create policy personal_data_exports_select_own on public.personal_data_exports
  for select
  using (user_id = auth.uid());

create policy personal_data_exports_insert_own on public.personal_data_exports
  for insert
  with check (user_id = auth.uid());

create table public.account_deletion_requests (
  -- PK is user_id itself, not a separate id -- §11.9's own text
  -- models at most one deletion request per account (a repeat
  -- request against an already-PROCESSING/COMPLETED row is a safe
  -- no-op, accountDataLifecycle.ts's own requestAccountDeletion
  -- logic), never multiple concurrent requests for the same user.
  user_id        uuid primary key references public.users (id),
  status         text not null default 'PROCESSING'
                    check (status in ('PROCESSING', 'COMPLETED')),
  requested_at   timestamptz not null default now(),
  completed_at   timestamptz null
);

alter table public.account_deletion_requests enable row level security;

-- Same self-service shape as personal_data_exports above. UPDATE
-- (the PROCESSING -> COMPLETED worker-side transition,
-- markAccountDeletionCompleted) has no client-facing grant -- §11.9's
-- own text says completion is communicated by email, never polled by
-- the client, so there is no client-facing read-after-write need for
-- this table's own status column to update from the client's own
-- session either, though SELECT is still granted for the narrow
-- "does a request already exist" idempotency check this module's own
-- logic performs.
grant select, insert on public.account_deletion_requests to authenticated;

create policy account_deletion_requests_select_own on public.account_deletion_requests
  for select
  using (user_id = auth.uid());

create policy account_deletion_requests_insert_own on public.account_deletion_requests
  for insert
  with check (user_id = auth.uid());
