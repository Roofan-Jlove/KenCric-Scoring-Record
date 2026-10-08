-- A real, foundational gap, found only by actually trying to insert an
-- `officials` row for a real signed-up user: `public.users.id`
-- (20260923000001) correctly references `auth.users(id)`, but no
-- trigger anywhere in this schema's 61 prior migrations ever
-- populates `public.users` when someone signs up through GoTrue.
-- `created_by`/`updated_by` on most tables (`teams`, `matches`, etc.)
-- have NO FK to `public.users` at all (`§1.5`'s own "a device-local
-- placeholder for a not-yet-claimed guest match" note, confirmed
-- directly in each table's own migration comment), so this gap was
-- invisible until a table that DOES FK strictly to `public.users`
-- (`officials.user_id`) was actually exercised for the first time.
-- Every real signed-up user, this entire session, has only ever
-- existed in `auth.users` -- never in `public.users` at all.
--
-- The standard, well-established Supabase pattern: a trigger on
-- `auth.users` that inserts the corresponding `public.users` row on
-- signup. `display_name` is NOT NULL with no sensible default in
-- `§3.1`'s own spec (no signup/profile-setup screen collects one
-- anywhere in this backlog's 25 UX screens either) -- falls back to
-- the email's own local part, flagged as a stand-in, not a designed
-- default.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- Backfill: any user who signed up before this trigger existed (every
-- real test account created earlier this session) gets their missing
-- public.users row created now, not left permanently orphaned.
insert into public.users (id, email, display_name)
select id, email, split_part(email, '@', 1)
from auth.users
on conflict (id) do nothing;
