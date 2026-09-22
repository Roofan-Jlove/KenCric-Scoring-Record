-- Schema-conformance test for TASK-0005 (matches, officials, match_officials,
-- reference_data). Verifies structure against data-specification.md §5.1–5.4
-- field-for-field. Scope: schema shape only.

begin;
select plan(16);

-- reference_data
select has_table('public', 'reference_data', 'reference_data table exists');
select col_is_pk('public', 'reference_data', 'kind', 'reference_data.kind is part of the composite primary key');
select col_is_pk('public', 'reference_data', 'version', 'reference_data.version is part of the composite primary key');
select col_not_null('public', 'reference_data', 'published_by', 'reference_data.published_by is not null');

-- matches
select has_table('public', 'matches', 'matches table exists');
select col_is_pk('public', 'matches', 'id', 'matches.id is the primary key');
select col_is_null('public', 'matches', 'organization_id', 'matches.organization_id is nullable (guest match)');
select col_default_is('public', 'matches', 'claim_status', 'GUEST', 'matches.claim_status defaults to GUEST');
select col_default_is('public', 'matches', 'state', 'SCHEDULED', 'matches.state defaults to SCHEDULED');
select col_default_is('public', 'matches', 'rain_method', 'NONE', 'matches.rain_method defaults to NONE (A-06/A-19 until SPK-01 clears)');
select col_has_check('public', 'matches', 'state', 'matches.state has a check constraint');

-- officials
select has_table('public', 'officials', 'officials table exists');
select col_is_null('public', 'officials', 'user_id', 'officials.user_id is nullable (not necessarily a users account holder)');

-- match_officials
select has_table('public', 'match_officials', 'match_officials table exists');
select col_is_pk('public', 'match_officials', 'match_id', 'match_officials.match_id is part of the composite primary key');
select col_is_pk('public', 'match_officials', 'role', 'match_officials.role is part of the composite primary key');
select hasnt_column('public', 'match_officials', 'updated_at',
  'match_officials has no updated_at (§5.3: reassignment is a remove+add)');

select * from finish();
rollback;
