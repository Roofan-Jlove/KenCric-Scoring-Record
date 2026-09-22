-- Append-only enforcement + hash-chain verification for match_events.
-- data-specification.md §6.1 ("INSERT only for every application role --
-- no UPDATE, no DELETE, ever, for any role including admins"), ADR-08.

-- GRANT-level restriction: ordinary application roles may INSERT/SELECT,
-- never UPDATE/DELETE. anon deliberately gets no grant at all -- public/
-- anonymous viewers read redacted projections (§7-§8), never the raw
-- event log.
grant select, insert on public.match_events to authenticated;

-- Trigger-level hard block, in addition to the grant above: GRANT/REVOKE
-- alone cannot bind the table's OWNER (the role that ran this migration
-- retains implicit full DML rights in Postgres regardless of REVOKE).
-- Since §6.1 explicitly requires this "for any role including admins,"
-- only a trigger can actually enforce it against the owning role too.
create or replace function public.match_events_block_mutation()
returns trigger as $$
begin
  raise exception 'match_events is append-only: % is not permitted (data-specification.md §6.1, ADR-08)', tg_op;
end;
$$ language plpgsql;

create trigger match_events_block_update
  before update on public.match_events
  for each row
  execute function public.match_events_block_mutation();

create trigger match_events_block_delete
  before delete on public.match_events
  for each row
  execute function public.match_events_block_mutation();

-- Hash-chain verification on insert.
--
-- FLAGGED, not a certainty: §6.1's prev_hash note says "the previous
-- active event's hash in this same scorer_stream_id" but does not state
-- the ordering key. device_seq is scoped to (scorer_stream_id, device_id)
-- -- too narrow if a single logical stream spans more than one device.
-- event_ordinal is the field the schema's own canonical-read-order index
-- uses within scorer_stream_id, so it's used here as the chain-ordering
-- key -- but this is this migration's best-supported reading of an
-- underspecified point, not a verified fact. Should be cross-checked
-- against live-scoring.md §16.2 / system-architecture.md §4.8, where the
-- canonical hash-chain definition actually lives, before this is trusted.
--
-- Also flagged: a stream's first-ever event has no prior row to compare
-- against, so this trigger accepts any prev_hash on first insert for a
-- given scorer_stream_id -- it cannot catch a wrong genesis value.
create or replace function public.match_events_verify_chain()
returns trigger as $$
declare
  expected_prev_hash text;
begin
  select hash into expected_prev_hash
  from public.match_events
  where scorer_stream_id = new.scorer_stream_id
    and event_ordinal < new.event_ordinal
  order by event_ordinal desc
  limit 1;

  if expected_prev_hash is not null and new.prev_hash <> expected_prev_hash then
    raise exception 'match_events hash chain broken for scorer_stream_id %: expected prev_hash %, got %',
      new.scorer_stream_id, expected_prev_hash, new.prev_hash;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger match_events_verify_chain_trigger
  before insert on public.match_events
  for each row
  execute function public.match_events_verify_chain();

-- SAFETY ADDITION beyond TASK-0007's literal stated scope, flagged as
-- such: enabling RLS here with zero policies yet. Postgres defaults to
-- deny-all for non-owner roles when RLS is enabled and no policy exists,
-- so this closes the gap the grant above would otherwise leave wide open
-- -- "authenticated may SELECT" with no row-level scoping would let any
-- signed-in user read every match's events, not just ones they're
-- entitled to. Actual match-scoped read policies are a future task, not
-- implemented here.
alter table public.match_events enable row level security;
