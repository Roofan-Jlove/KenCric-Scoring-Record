-- data-specification.md §8.6 `disputes` -- added by RCR, 2026-10-04
-- (TASK-0122), backing api-specification.md §11.4's dispute lock +
-- adjudicate pair. Follows §11.4's own match-scoped contract, not
-- domain-model.md's competition-scoped ENT-DISPUTE (CTX-COMPETITION is
-- unbuilt) -- see §8.6's own note for the full reasoning.

create table public.disputes (
  id                      uuid primary key,
  match_id                uuid not null references public.matches (id),
  -- Implemented as a CHECK, not a native Postgres enum type, matching
  -- every other status/state column's own convention in this migration
  -- set (memberships, invitations, matches.state itself).
  status                  text not null default 'OPEN'
                             check (status in ('OPEN', 'ADJUDICATED')),
  reason                  text not null,
  locked_from_state       text not null,
  locked_by               uuid not null,
  locked_at               timestamptz not null default now(),
  ruling                  text null,
  resulting_corrections   uuid[] null,
  adjudicated_by          uuid null,
  adjudicated_at          timestamptz null,
  row_version             integer not null default 1
);

create index disputes_match_id_ix on public.disputes (match_id);
create index disputes_status_ix on public.disputes (status);

alter table public.disputes enable row level security;

-- Visible to org members of the disputed match's own organization, same
-- org-membership-or-creator pattern 20260923000008's own file already
-- established (guest/org-less matches have no org-admin console to
-- gate this on in the first place, so this policy only covers the
-- organization_id IS NOT NULL case -- an org-less match's disputes are
-- not exposed via this policy at all, a deliberate under-grant).
create policy disputes_select on public.disputes
  for select
  using (
    exists (
      select 1 from public.matches m
      join public.memberships mem on mem.organization_id = m.organization_id
      where m.id = disputes.match_id
        and m.organization_id is not null
        and mem.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies -- locking/adjudicating a dispute goes
-- through TASK-0123's own command handler, same default-deny-writes
-- convention every other command-backed table in this migration set uses.
