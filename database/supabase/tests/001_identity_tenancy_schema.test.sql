-- Schema-conformance test for TASK-0001 (users, organizations, memberships).
-- Verifies structure against data-specification.md §3.1–3.3 field-for-field.
-- Scope: schema shape only. RLS policy assertions belong to TASK-0002/0015, not here.

begin;
select plan(24);

-- users
select has_table('public', 'users', 'users table exists');
select has_column('public', 'users', 'id', 'users.id exists');
select col_is_pk('public', 'users', 'id', 'users.id is the primary key');
select col_not_null('public', 'users', 'email', 'users.email is not null');
select col_not_null('public', 'users', 'is_minor', 'users.is_minor is not null');
select col_default_is('public', 'users', 'is_minor', 'false', 'users.is_minor defaults to false');
select col_is_null('public', 'users', 'guardian_user_id', 'users.guardian_user_id is nullable');
select col_is_null('public', 'users', 'anonymized_at', 'users.anonymized_at is nullable');
select col_default_is('public', 'users', 'row_version', '1', 'users.row_version defaults to 1');

-- organizations
select has_table('public', 'organizations', 'organizations table exists');
select col_is_pk('public', 'organizations', 'id', 'organizations.id is the primary key');
select col_not_null('public', 'organizations', 'name', 'organizations.name is not null');
select col_is_null('public', 'organizations', 'branding', 'organizations.branding is nullable');
select hasnt_column('public', 'organizations', 'deleted_at',
  'organizations has no soft-deletion column (§3.2: not defined this iteration)');
select hasnt_column('public', 'organizations', 'status',
  'organizations has no status/soft-deletion column (§3.2: not defined this iteration)');

-- memberships
select has_table('public', 'memberships', 'memberships table exists');
select col_is_pk('public', 'memberships', 'id', 'memberships.id is the primary key');
select col_is_fk('public', 'memberships', 'user_id', 'memberships.user_id is a foreign key');
select col_is_fk('public', 'memberships', 'organization_id', 'memberships.organization_id is a foreign key');
select col_default_is('public', 'memberships', 'status', 'ACTIVE', 'memberships.status defaults to ACTIVE');
select col_default_is('public', 'memberships', 'roles', '{}', 'memberships.roles defaults to empty array');
select col_has_check('public', 'memberships', 'status', 'memberships.status has a check constraint');

-- uniqueness/indexes
select has_index('public', 'users', 'users_email_uq', 'users has a partial-unique email index');
select has_index('public', 'memberships', 'memberships_organization_id_ix', 'memberships.organization_id is indexed');
select col_is_unique('public', 'memberships', array['user_id', 'organization_id'],
  'memberships (user_id, organization_id) is unique');

select * from finish();
rollback;
