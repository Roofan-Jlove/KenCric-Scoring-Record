-- data-specification.md §10.1 `audit_log`
-- The cross-cutting, append-only, hash-chained audit trail.
--
-- Grants (§10.1's own words): "INSERT only, and only via a SECURITY
-- DEFINER helper -- no application role has direct INSERT, UPDATE, or
-- DELETE privilege on this table." Stricter than match_events
-- (TASK-0007), which granted INSERT directly to authenticated -- this
-- table grants no direct DML to any application role at all.

create table public.audit_log (
  id                       uuid primary key,
  category                 text not null
                              check (category in ('AUTH', 'MEMBERSHIP', 'IMPERSONATION', 'OVERRIDE', 'EXPORT', 'SHARE_LINK', 'ADMIN', 'RETENTION', 'DISPUTE', 'PLAYER_MERGE')),
  actor_ref                uuid not null references public.users (id),
  impersonated_actor_ref   uuid null references public.users (id),
  target_ref               uuid null,
  action                   text not null,
  detail                   jsonb not null,
  -- reason: required by application logic for category IN
  -- (OVERRIDE, ADMIN, DISPUTE, PLAYER_MERGE), but explicitly NOT
  -- DB-enforced here -- §10.1's own note says the requirement is
  -- category-conditional and "enforced at the write path," unlike every
  -- other biconditional this session has implemented as a CHECK. Followed
  -- literally: no constraint added.
  reason                   text null,
  prev_hash                text not null,
  hash                     text not null,
  created_at               timestamptz not null default now()
);

create index audit_log_actor_ref_ix on public.audit_log (actor_ref);
create index audit_log_category_ix on public.audit_log (category);
create index audit_log_created_at_ix on public.audit_log (created_at);

-- No direct grants to any application role -- writes happen only through
-- the SECURITY DEFINER helper below.
create or replace function public.audit_log_write(
  p_id uuid,
  p_category text,
  p_actor_ref uuid,
  p_impersonated_actor_ref uuid,
  p_target_ref uuid,
  p_action text,
  p_detail jsonb,
  p_reason text,
  p_prev_hash text,
  p_hash text
) returns uuid
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (
    id, category, actor_ref, impersonated_actor_ref, target_ref,
    action, detail, reason, prev_hash, hash
  ) values (
    p_id, p_category, p_actor_ref, p_impersonated_actor_ref, p_target_ref,
    p_action, p_detail, p_reason, p_prev_hash, p_hash
  );
  return p_id;
end;
$$ language plpgsql;

-- No EXECUTE grant to authenticated: §10.1's sync model states this
-- table is "server-only... a device never holds or writes this table
-- directly," so this helper is called from backend/service_role code
-- responding to a synced event or API call, not invoked directly by an
-- authenticated client session. If a genuine client-triggered audit path
-- is needed later, that EXECUTE grant is an explicit future addition,
-- not assumed here.

-- Append-only enforcement, same pattern as match_events/sign_offs: a
-- trigger hard-blocks UPDATE/DELETE for every role including the owner.
create or replace function public.audit_log_block_mutation()
returns trigger as $$
begin
  raise exception 'audit_log is append-only: % is not permitted (data-specification.md §10.1)', tg_op;
end;
$$ language plpgsql;

create trigger audit_log_block_update
  before update on public.audit_log
  for each row
  execute function public.audit_log_block_mutation();

create trigger audit_log_block_delete
  before delete on public.audit_log
  for each row
  execute function public.audit_log_block_mutation();

alter table public.audit_log enable row level security;

-- FLAGGED, deliberately not implemented: TASK-0012's own Expected
-- Behavior says audit_log follows "the same discipline as match_events
-- (TASK-0007)," which included a hash-chain verification trigger.
-- match_events' chain has a documented ordering key (event_ordinal
-- within scorer_stream_id, itself flagged as this project's best
-- reading, not a certainty). audit_log has no equivalent stated ordering
-- key at all -- it is a single cross-cutting log, not scoped to a
-- stream, and using created_at or insertion order risks a race under
-- concurrent inserts that a wrongly-implemented trigger could get wrong
-- in a way that's worse than not implementing it (a silently-accepted
-- broken chain). Append-only enforcement (the unambiguous half of "same
-- discipline") is implemented above; hash-chain verification is not,
-- pending a stated ordering key for this specific table.
