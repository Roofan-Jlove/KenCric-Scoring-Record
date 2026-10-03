-- Resolves implementation-task-backlog.md §8's own open item `ITQ-4`:
-- "the canonical org-admin role token is unconfirmed anywhere reachable
-- from a migration -- memberships.roles is deliberately an unconstrained
-- text[], and product-foundation.md only names the role conceptually
-- ('Organization Admin'), not its stored token."
--
-- Resolution: the canonical 12-role token list already exists and is
-- already enforced at the APPLICATION layer -- backend/src/commands/
-- memberships.ts's own VALID_ROLES constant (TASK-0095), itself a
-- direct, verified mapping from product-foundation.md §4's own role
-- table (read again here to confirm, not assumed):
--
--   Platform Admin                      -> PLATFORM_ADMIN
--   Organization Admin                  -> ORGANIZATION_ADMIN
--   Competition / Tournament Organizer  -> COMPETITION_ORGANIZER
--   Team Manager / Captain              -> TEAM_MANAGER
--   Head Scorer (Match Owner)           -> HEAD_SCORER
--   Assistant / Co-Scorer               -> ASSISTANT_SCORER
--   Umpire                              -> UMPIRE
--   Commentator                         -> COMMENTATOR
--   Statistician / Analyst              -> STATISTICIAN
--   Player                              -> PLAYER
--   Viewer / Spectator                  -> VIEWER
--   Guest (anonymous)                   -> GUEST
--
-- This migration promotes that already-decided application-layer list
-- to a real DB-level CHECK, on both tables that store it
-- (memberships.roles, §3.3; invitations.roles, §3.4) -- nothing new is
-- invented, the token list itself was already settled by TASK-0095.
--
-- NOT done here, flagged as a real follow-up opportunity, not bundled
-- into this task to keep it narrowly scoped: several already-merged RLS
-- policies deliberately UNDER-GRANT (visible to any org member, not
-- just ORGANIZATION_ADMIN) specifically because this token was
-- previously unconfirmed at the migration layer --
-- 20260923000008_teams_players_squads_rls.sql (players_public access),
-- 20260923000031_create_invitations.sql (invitations_select), and
-- 20260923000033_create_disputes.sql (disputes_select) each say so
-- explicitly in their own comments. Now that the token is confirmed,
-- tightening those three policies to check for ORGANIZATION_ADMIN
-- specifically is a real, bounded follow-up task -- not done here,
-- since it means re-verifying three already-merged, already-tested
-- migrations' own RLS behavior, a separate change in kind from adding
-- a new CHECK constraint.

alter table public.memberships
  add constraint memberships_roles_valid check (
    roles <@ array[
      'PLATFORM_ADMIN', 'ORGANIZATION_ADMIN', 'COMPETITION_ORGANIZER', 'TEAM_MANAGER',
      'HEAD_SCORER', 'ASSISTANT_SCORER', 'UMPIRE', 'COMMENTATOR',
      'STATISTICIAN', 'PLAYER', 'VIEWER', 'GUEST'
    ]::text[]
  );

alter table public.invitations
  add constraint invitations_roles_valid check (
    roles <@ array[
      'PLATFORM_ADMIN', 'ORGANIZATION_ADMIN', 'COMPETITION_ORGANIZER', 'TEAM_MANAGER',
      'HEAD_SCORER', 'ASSISTANT_SCORER', 'UMPIRE', 'COMMENTATOR',
      'STATISTICIAN', 'PLAYER', 'VIEWER', 'GUEST'
    ]::text[]
  );
