-- A real, blocking gap found while wiring Match Summary's sign-off to
-- the real `signoff` Edge Function for the first time ever -- the
-- IDENTICAL shape `match_events` had before `20260923000061`:
-- `20260923000024_create_sign_offs.sql`'s own final line enables RLS
-- with ZERO policies defined. The `grant select, insert ... to
-- authenticated` two lines above it is necessary but not sufficient --
-- Postgres RLS defaults to deny-all for every role (including ones
-- with a table-level GRANT) once RLS is enabled and no policy exists.
-- Confirmed directly via the real edge-runtime log, not guessed:
-- `persistSignOff: sign_offs insert failed: new row violates row-level
-- security policy for table "sign_offs"` -- `signoff/index.ts` uses a
-- SINGLE user-scoped client (confirmed by reading it directly, same
-- as `sync-events`), so the real app-level actor-role check
-- (`resolveActorRole`, requiring `HEAD_SCORER`) passing is irrelevant
-- without a matching RLS policy to let that same client's own INSERT
-- through.
--
-- Mirrors `match_events_select`/`match_events_insert`
-- (`20260923000061`) in shape exactly, reusing `has_match_role()`
-- rather than inventing a new check -- a HEAD_SCORER/ASSISTANT_SCORER
-- assigned to this specific match for an org-scoped match, or the
-- creator/claimant for a personal one.

create policy sign_offs_select on public.sign_offs
  for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = sign_offs.match_id
        and (
          (m.organization_id is not null and (
            m.organization_id = any (public.my_orgs('ORGANIZATION_ADMIN'))
            or public.has_match_role(m.id, array['HEAD_SCORER', 'ASSISTANT_SCORER'])
          ))
          or (m.organization_id is null and (m.created_by = auth.uid() or m.updated_by = auth.uid()))
        )
    )
  );

create policy sign_offs_insert on public.sign_offs
  for insert
  with check (
    exists (
      select 1 from public.matches m
      where m.id = sign_offs.match_id
        and (
          (m.organization_id is not null and public.has_match_role(m.id, array['HEAD_SCORER', 'ASSISTANT_SCORER']))
          or (m.organization_id is null and (m.created_by = auth.uid() or m.updated_by = auth.uid()))
        )
    )
  );
