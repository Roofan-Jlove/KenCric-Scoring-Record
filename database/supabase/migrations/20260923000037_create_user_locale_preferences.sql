-- data-specification.md §3.6 `user_locale_preferences` -- added by RCR,
-- 2026-10-04 (TASK-0131), a deliberate storage-only slice of FR-157:
-- stores a user's chosen interface language, delivers no actual i18n
-- rendering (no string-externalization infrastructure exists anywhere
-- in this codebase). See §3.6's own note for the full reasoning.

create table public.user_locale_preferences (
  user_id     uuid primary key references public.users (id),
  locale      text not null default 'en',
  updated_at  timestamptz not null default now()
);

alter table public.user_locale_preferences enable row level security;

-- A user's own locale preference is visible/writable only to that user,
-- the same shape 20260923000036's own notification_preferences policies
-- already established.
create policy user_locale_preferences_select on public.user_locale_preferences
  for select
  using (user_id = auth.uid());

create policy user_locale_preferences_upsert on public.user_locale_preferences
  for insert
  with check (user_id = auth.uid());

create policy user_locale_preferences_update on public.user_locale_preferences
  for update
  using (user_id = auth.uid());
