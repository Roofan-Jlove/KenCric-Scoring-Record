-- data-specification.md §3.3 `memberships` -- RCR, 2026-10-03 (TASK-0119).
-- Adds `invited_at`/`accepted_at`, resolving a gap where domain-model.md's
-- own ENT-MEMBERSHIP attribute list already named these two attributes
-- (`invitedAt?`, `acceptedAt?`) but this table had no columns for them.
-- Populated at accept time by TASK-0120's own command, copied from the
-- new `invitations` table (20260923000031_create_invitations.sql).

alter table public.memberships
  add column invited_at timestamptz null,
  add column accepted_at timestamptz null;
