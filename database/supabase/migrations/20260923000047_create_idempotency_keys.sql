-- data-specification.md §9.4 `idempotency_keys` -- added by RCR, 2026-10-05
-- (TASK-0149). api-specification.md §8.1/§8.2 fully specifies the
-- Idempotency-Key mechanism every command/RPC endpoint with a side
-- effect uses (§11, exports, share-links) -- a client-generated opaque
-- string, scoped per-endpoint, retained 24h [DEFAULT]. No backing table
-- for it has existed anywhere in this schema until now; every command
-- built so far (signOffMatch, deactivateMember, mergePlayers, ...) has
-- only ever had an in-memory IdempotencyStore test double.
--
-- Only SUCCESSFUL outcomes are ever stored here -- §8.2's own text: "A
-- request presenting a key that previously failed is processed fresh
-- (a failed attempt never 'poisons' the key)." This matches every
-- already-built IdempotencyStore interface's own naming exactly
-- (`getPriorSuccess`/`recordSuccess` -- never `recordFailure`).

create table public.idempotency_keys (
  endpoint          text not null,
  idempotency_key   text not null,
  result            jsonb not null,
  created_at        timestamptz not null default now(),
  primary key (endpoint, idempotency_key)
);

-- Backs the (not-yet-built) 24h-TTL cleanup job -- §8.1's own
-- `[DEFAULT]` retention window is an application-level policy, not a
-- DB-enforced expiry; a periodic DELETE WHERE created_at < now() -
-- interval '24 hours' job is a real, bounded follow-up, not built here.
create index idempotency_keys_created_at_ix on public.idempotency_keys (created_at);

-- A client never reads another client's idempotency cache entry
-- directly -- it only ever learns the result via the command endpoint's
-- own response. INSERT/SELECT only; no UPDATE (a recorded success is
-- never modified) and no client-facing DELETE (expiry is a service-role
-- job, not a user action).
grant select, insert on public.idempotency_keys to authenticated;
alter table public.idempotency_keys enable row level security;

-- Platform-internal bookkeeping, not tenant data -- there is no
-- organization_id to scope by, and the (endpoint, idempotency_key)
-- composite key is itself only ever known to the client that minted it
-- (an opaque client-generated string), so a permissive read policy
-- leaks nothing a possessor of the key didn't already supply themselves.
create policy idempotency_keys_select on public.idempotency_keys
  for select
  using (true);

create policy idempotency_keys_insert on public.idempotency_keys
  for insert
  with check (true);
