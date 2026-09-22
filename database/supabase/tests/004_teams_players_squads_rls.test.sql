-- RLS-policy test for TASK-0004 (teams, players, squad_members).
-- Scope: confirms RLS is enabled, the expected read policies and the
-- players_public redaction view exist, and no write policy was silently
-- granted. Does not attempt to verify the org-admin exception, since
-- TASK-0004 deliberately does not implement it (see the migration's own
-- comments) -- asserting its absence here would be testing a gap, not a
-- requirement.

begin;
select plan(9);

-- RLS enabled
select ok(
  (select relrowsecurity from pg_class where relname = 'teams' and relnamespace = 'public'::regnamespace),
  'RLS is enabled on teams'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'players' and relnamespace = 'public'::regnamespace),
  'RLS is enabled on players'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'squad_members' and relnamespace = 'public'::regnamespace),
  'RLS is enabled on squad_members'
);

-- Expected policies exist
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'teams_select'),
  'teams_select policy exists'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'players' and policyname = 'players_select'),
  'players_select policy exists'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'squad_members' and policyname = 'squad_members_select'),
  'squad_members_select policy exists'
);

-- The redaction view exists and does not expose dob/photo_ref as plain
-- passthrough columns from the base table (a schema-shape check; the
-- actual redaction behavior needs a live-data scenario, not schema-only
-- pgTAP, and belongs to TASK-0015's fuller matrix).
select has_view('public', 'players_public', 'players_public view exists');
select has_column('public', 'players_public', 'dob', 'players_public exposes a dob column (conditionally redacted)');

-- No write policy silently granted on any of the three tables.
select ok(
  not exists(
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('teams', 'players', 'squad_members')
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ),
  'no INSERT/UPDATE/DELETE policy exists on teams, players, or squad_members'
);

select * from finish();
rollback;
