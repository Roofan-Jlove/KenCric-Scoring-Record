-- data-specification.md §9.2 `writer_fences` -- SERVER COPY ONLY.
-- The current valid writer lease per scorer stream (P1 single-writer
-- handoff). Server-authoritative -- a device caches its last-known value
-- locally (a different table, in the client's own local store, not
-- created by this migration), but the server's copy is the one that
-- decides a push's fate.

create table public.writer_fences (
  scorer_stream_id      uuid primary key,
  match_id              uuid not null references public.matches (id),
  current_lease_value   bigint not null,
  held_by_device_id     uuid not null,
  granted_at            timestamptz not null
);

create index writer_fences_match_id_ix on public.writer_fences (match_id);

-- Clients may read the current fence state (to know whether they hold it),
-- but fence issuance/take-over is server-controlled sync-protocol logic,
-- not a raw client write -- no INSERT/UPDATE/DELETE grant to authenticated.
grant select on public.writer_fences to authenticated;
alter table public.writer_fences enable row level security;
