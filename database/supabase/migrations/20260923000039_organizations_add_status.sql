-- data-specification.md §3.2 `organizations` -- RCR, 2026-10-04
-- (TASK-0133), resolving §13's own open item DSQ-2 (whether
-- organizations needs a soft-delete/decommission path). Mirrors
-- domain-model.md's own ENT-ORGANIZATION Lifecycle (Created -> Active
-- <-> Suspended -> Deleted) -- the same policy-2 soft-deactivate shape
-- memberships (20260923000003) already uses.

alter table public.organizations
  add column status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'SUSPENDED', 'DELETED'));
