-- data-specification.md §3.5 `notification_preferences` -- added by RCR,
-- 2026-10-04 (TASK-0130), a deliberate storage-only slice: stores a
-- user's preference per (channel, event_type) pair, delivers nothing
-- (FR-141 push delivery is itself unbuilt). See §3.5's own note for the
-- full reasoning, including why channel/event_type are plain text, not
-- CHECK-constrained enums -- no canonical value list exists for either
-- anywhere in this corpus.

create table public.notification_preferences (
  user_id     uuid not null references public.users (id),
  channel     text not null,
  event_type  text not null,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (user_id, channel, event_type)
);

create index notification_preferences_user_id_ix on public.notification_preferences (user_id);

alter table public.notification_preferences enable row level security;

-- A user's own notification preferences are visible/writable only to
-- that user -- no org-membership dimension at all, unlike every other
-- table this migration set gates on organization_id.
create policy notification_preferences_select on public.notification_preferences
  for select
  using (user_id = auth.uid());

-- Unlike every other command-backed table in this migration set (which
-- leaves writes to a backend command handler, default-deny), this
-- resource's own idempotent-upsert shape (TASK-0130's own
-- setNotificationPreference) is simple and low-stakes enough -- a user
-- toggling their own preference -- that a direct client-writable RLS
-- policy is reasonable, the same "low-stakes, owner-only" reasoning
-- squad_members.role_hint already used, scaled down to a real INSERT/
-- UPDATE policy this time since there is no cross-cutting business rule
-- to enforce server-side (unlike every §6.1/§11 command module above).
create policy notification_preferences_upsert on public.notification_preferences
  for insert
  with check (user_id = auth.uid());

create policy notification_preferences_update on public.notification_preferences
  for update
  using (user_id = auth.uid());
