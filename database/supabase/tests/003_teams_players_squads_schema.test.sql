-- Schema-conformance test for TASK-0003 (teams, players, squad_members).
-- Verifies structure against data-specification.md §4.1–4.3 field-for-field.
-- Scope: schema shape only. RLS/constraint refinement belongs to TASK-0004.

begin;
select plan(15);

-- teams
select has_table('public', 'teams', 'teams table exists');
select col_is_pk('public', 'teams', 'id', 'teams.id is the primary key');
select col_is_null('public', 'teams', 'organization_id', 'teams.organization_id is nullable (guest/ad-hoc teams)');
select col_not_null('public', 'teams', 'name', 'teams.name is not null');
select col_is_null('public', 'teams', 'canonical_ref', 'teams.canonical_ref is nullable');

-- players
select has_table('public', 'players', 'players table exists');
select col_is_pk('public', 'players', 'id', 'players.id is the primary key');
select col_is_null('public', 'players', 'organization_id', 'players.organization_id is nullable (ad-hoc players)');
select col_default_is('public', 'players', 'status', 'ACTIVE', 'players.status defaults to ACTIVE');
select col_has_check('public', 'players', 'status', 'players.status has a check constraint');
select col_is_null('public', 'players', 'dob', 'players.dob is nullable');

-- squad_members
select has_table('public', 'squad_members', 'squad_members table exists');
select col_is_pk('public', 'squad_members', 'team_id', 'squad_members.team_id is part of the composite primary key');
select col_is_pk('public', 'squad_members', 'player_id', 'squad_members.player_id is part of the composite primary key');
select hasnt_column('public', 'squad_members', 'updated_at',
  'squad_members has no updated_at (§4.3: an add/remove join, not an edited entity)');
select hasnt_column('public', 'squad_members', 'row_version',
  'squad_members has no row_version (not an edited entity)');

select * from finish();
rollback;
