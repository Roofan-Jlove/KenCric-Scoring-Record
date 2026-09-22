-- data-specification.md §5.4 `reference_data`
-- Pull-only from the client's perspective; versioned, centrally-published
-- condition-profile/DLS reference content. A published (kind, version) row
-- is never updated in place -- a change is a new version (BR-045). No
-- soft-deletion: every historical version must stay resolvable for as
-- long as any match still pins it.

create table public.reference_data (
  kind          text not null
                  check (kind in ('CONDITIONS_PROFILE', 'DLS_TABLE', 'APP_CONFIG')),
  version       integer not null,
  payload       jsonb not null,
  published_at  timestamptz not null default now(),
  published_by  uuid not null references public.users (id),
  primary key (kind, version)
);

create index reference_data_kind_ix on public.reference_data (kind);

-- Immutability (BR-045: never updated in place) is a write-grant/trigger
-- concern, not a schema-shape one -- deferred to the RLS/grants task for
-- this table family, consistent with how TASK-0001's append-only grants
-- were handled separately from TASK-0002's RLS.
