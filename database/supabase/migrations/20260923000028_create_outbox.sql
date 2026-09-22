-- data-specification.md §9.3 `outbox` -- server-side only.
-- The transactional outbox for downstream integration events (ADR-09).
-- Distinct from a client device's local push queue (which is simply the
-- unacknowledged tail of its own match_events, not a separate table).
-- "Not client-facing at all" -- no grant to authenticated or anon.

create table public.outbox (
  id                        uuid primary key,
  integration_event_type    text not null,
  payload                    jsonb not null,
  created_at                 timestamptz not null default now(),
  dispatched_at               timestamptz null,
  attempts                    integer not null default 0
);

-- Partial index for the drainer's polling query (§9.3's own note).
create index outbox_undispatched_ix on public.outbox (dispatched_at) where dispatched_at is null;

alter table public.outbox enable row level security;
-- No grants to authenticated/anon at all -- only service_role (implicit,
-- no explicit grant needed) reads/writes this table.
