-- data-specification.md §6.1 `match_events`
-- The single source of truth for everything that happened in a match;
-- every other scoring table (§7-§8) is derived from this one by folding
-- it through the shared scoring core.
--
-- KNOWN GAP #1: §6.1 states partitioning is "hash of match_id (or
-- monthly -- AQ-2, still open)" -- the spec itself has not decided
-- between the two. Committing to one now would bake a structural choice
-- into the schema that's explicitly still open, and native Postgres
-- partitioning is expensive to change after data exists. Implemented
-- here as a plain, unpartitioned table; partitioning is deferred to a
-- follow-up migration once AQ-2 resolves.
--
-- KNOWN GAP #2: actor_ref's notes say "FK -> users.id, or a device-local
-- guest placeholder" -- the same guest-placeholder case that meant no
-- hard FK on users.created_by/updated_by (TASK-0001). No FK constraint
-- on actor_ref here for the same reason: a strict FK would reject
-- legitimate guest placeholder values.
--
-- OUT OF SCOPE, not an oversight: grants (INSERT-only, no UPDATE/DELETE
-- for any role, ever) and hash-chain verification are TASK-0007's job.
-- This migration is schema shape only -- as created, every default
-- Postgres role with table access could still UPDATE/DELETE this table.

create table public.match_events (
  event_id            uuid primary key,
  match_id            uuid not null references public.matches (id),
  scorer_stream_id    uuid not null,
  device_id           uuid not null,
  device_seq          bigint not null,
  hlc                 text not null,
  event_ordinal       numeric(20,10) not null,
  type                text not null,
  event_version       integer not null,
  payload             jsonb not null,
  supersedes          uuid null references public.match_events (event_id),
  voids               uuid null references public.match_events (event_id),
  actor_ref           uuid not null,
  provenance          jsonb not null,
  recorded_at         timestamptz not null,
  server_received_at  timestamptz null,
  -- No default for prev_hash: the caller always supplies it explicitly
  -- (a genesis constant when starting a new stream, the actual prior
  -- event's hash otherwise). A DEFAULT here could silently mask a caller
  -- that forgot to supply it; not-null-no-default fails loudly instead.
  -- The genesis constant's exact value is an application-level
  -- convention, not decided by this migration.
  prev_hash           text not null,
  hash                text not null
);

alter table public.match_events
  add constraint match_events_stream_seq_uq unique (scorer_stream_id, device_id, device_seq);

create index match_events_canonical_order_ix on public.match_events (match_id, scorer_stream_id, event_ordinal);
create index match_events_sync_watermark_ix on public.match_events (match_id, device_id, device_seq);
create index match_events_payload_gin_ix on public.match_events using gin (payload);
