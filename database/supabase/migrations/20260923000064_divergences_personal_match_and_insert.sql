-- TASK-0161: two real gaps found while wiring `detectAndRecordDivergences`
-- (TASK-0038) into the real `sync-events` pipeline for the first time ever
-- -- the identical "never actually reachable" shape every other gap this
-- session has found shares.
--
-- 1. `divergences_select` (20260923000035, rewritten by 20260923000058 to
--    use `my_orgs()`) only ever had an `organization_id is not null`
--    branch -- a personal match (organization_id IS NULL, what every real
--    match this app's own UX-04..09 flow has ever created actually is)
--    has NO select branch at all. The realistic reachable scenario for
--    THIS app is the SAME creator running two devices/tabs against their
--    own personal match (two distinct scorerStreamIds, no multi-user
--    invite flow exists anywhere in this backlog) -- that creator could
--    never see their own match's divergence rows without this fix.
--
-- 2. `divergences` has NO write policy at all (20260923000035's own
--    comment assumed a service-role backend-handler write, the same
--    two-client shape `propose-divergence-resolution`/`confirm-divergence-
--    resolution` use) -- but `sync-events/index.ts` is a SINGLE user-scoped
--    client BY DELIBERATE DESIGN (its own doc comment: "never the service
--    role... so RLS applies"), confirmed directly before writing this.
--    Switching that file to a second service-role client would reopen an
--    already-decided architectural boundary; adding the missing INSERT
--    policy instead matches every other "add the policy, don't change the
--    architecture" fix this session has made (match_events, sign_offs,
--    officials, teams). Mirrors `match_events_insert`'s own shape exactly.

create policy divergences_select_personal on public.divergences
  for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = divergences.match_id
        and m.organization_id is null
        and (m.created_by = auth.uid() or m.updated_by = auth.uid())
    )
  );

create policy divergences_insert on public.divergences
  for insert
  with check (
    exists (
      select 1 from public.matches m
      where m.id = divergences.match_id
        and (
          (m.organization_id is not null and public.has_match_role(m.id, array['HEAD_SCORER', 'ASSISTANT_SCORER']))
          or (m.organization_id is null and (m.created_by = auth.uid() or m.updated_by = auth.uid()))
        )
    )
  );
