-- data-specification.md §10.2 `feature_flags` -- added by RCR, 2026-10-04
-- (TASK-0132), a deliberate storage-only slice of FR-160: stores each
-- flag's current on/off state. The one UX-28 admin-console piece that
-- already has a built UI shell (AdministrationScreen.tsx's own
-- FEATURE_FLAGS section, TASK-0091) with no backend behind it -- this
-- migration is that backend. Does NOT wire actual flag-gating logic into
-- any other endpoint; that remains each future gated feature's own job
-- to check, same as every other storage-only slice this round.

create table public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid null
);

alter table public.feature_flags enable row level security;

-- Platform-wide config, not tenant-scoped -- visible to every
-- authenticated user (a client needs to read a flag's state to know
-- whether to render the gated feature), writable only through the
-- backend command handler (TASK-0132's own setFeatureFlag), never a
-- raw client-writable RLS policy -- the usual default-deny-writes
-- convention every command-backed table in this migration set uses.
create policy feature_flags_select on public.feature_flags
  for select
  using (true);
