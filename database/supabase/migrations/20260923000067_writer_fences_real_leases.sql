-- A real, deeper blocker found while wiring UX-25's fence-conflict
-- half to real data -- confirmed before writing anything: the pure
-- core (`writerFence.ts`'s own `checkWriterFence(streamId, assertedFence:
-- string, ...)`) and this app's own real client (`eventChain.ts`'s own
-- `fenceValue: string`, minted via `crypto.randomUUID()`) both treat a
-- fence value as an opaque STRING everywhere -- but
-- `20260923000027_create_writer_fences.sql`'s own `current_lease_value`
-- column is `bigint not null`, which can never hold a real uuid fence
-- value at all. This is a genuine pre-existing schema/application
-- mismatch, not something this fix invents -- nothing has ever written
-- to this table (confirmed earlier this session: `syncEventsPersistence.js`
-- only ever SELECTs it), so there is no real data to migrate.
--
-- A SECOND real gap in the same original migration, also never
-- exercised until now: RLS is enabled with a `grant select` but NO
-- select policy at all -- the identical "grant without a policy is
-- still deny-all" shape this session has already found and fixed
-- repeatedly (match_events, sign_offs, divergences). The real
-- `writer_fences` SELECT inside `hydrateSyncEventsDeps` has therefore
-- always silently returned empty, regardless of any real row, which
-- is WHY `currentFence()` always resolved null for every real stream
-- -- a different, additional cause from the "nothing ever writes"
-- gap this fix also closes.
--
-- `writer_fences` also has no write policy at all, by the original
-- migration's own stated design ("fence issuance/take-over is
-- server-controlled sync-protocol logic, not a raw client write").
-- `sync-events/index.ts` is a single user-scoped client BY DELIBERATE
-- DESIGN (confirmed and respected again here, same reasoning already
-- used for `divergences`) -- so this fix adds the missing INSERT/
-- UPDATE policies instead of adding a second service-role client,
-- scoped exactly like `match_events_insert`'s own shape: an assigned
-- scorer on an org-scoped match, or the creator/updater of a personal
-- one. This is what lets (a) a brand-new stream's first successful
-- push genuinely grant itself the lease, and (b) a real "take over"
-- action overwrite an existing lease to a new fence/device.

alter table public.writer_fences
  alter column current_lease_value type text using current_lease_value::text;

create policy writer_fences_select on public.writer_fences
  for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = writer_fences.match_id
        and (
          (m.organization_id is not null and public.has_match_role(m.id, array['HEAD_SCORER', 'ASSISTANT_SCORER']))
          or (m.organization_id is null and (m.created_by = auth.uid() or m.updated_by = auth.uid()))
        )
    )
  );

grant insert, update on public.writer_fences to authenticated;

create policy writer_fences_insert on public.writer_fences
  for insert
  with check (
    exists (
      select 1 from public.matches m
      where m.id = writer_fences.match_id
        and (
          (m.organization_id is not null and public.has_match_role(m.id, array['HEAD_SCORER', 'ASSISTANT_SCORER']))
          or (m.organization_id is null and (m.created_by = auth.uid() or m.updated_by = auth.uid()))
        )
    )
  );

create policy writer_fences_update on public.writer_fences
  for update
  using (
    exists (
      select 1 from public.matches m
      where m.id = writer_fences.match_id
        and (
          (m.organization_id is not null and public.has_match_role(m.id, array['HEAD_SCORER', 'ASSISTANT_SCORER']))
          or (m.organization_id is null and (m.created_by = auth.uid() or m.updated_by = auth.uid()))
        )
    )
  )
  with check (
    exists (
      select 1 from public.matches m
      where m.id = writer_fences.match_id
        and (
          (m.organization_id is not null and public.has_match_role(m.id, array['HEAD_SCORER', 'ASSISTANT_SCORER']))
          or (m.organization_id is null and (m.created_by = auth.uid() or m.updated_by = auth.uid()))
        )
    )
  );
