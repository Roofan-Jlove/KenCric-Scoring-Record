/**
 * Real wiring for UX-25's fence-conflict half -- `writer_fences` was
 * confirmed, before writing anything, to be NEVER written to anywhere
 * in this real backend (`syncEventsPersistence.js` only ever SELECTs
 * it), meaning `STALE_FENCE` could never fire regardless of any
 * client change. This module is the missing grant-on-first-push step
 * `checkWriterFence`'s own real design always assumed would exist.
 *
 * Deliberately minimal: a brand-new stream (no existing row) grants
 * itself the lease on its own first successful push -- this is the
 * ONLY grant path; `ingestPushBatchWithFenceCheck` (already correct,
 * unchanged) rejects any push whose asserted fence doesn't match an
 * EXISTING row before this function is ever reached, so by the time
 * this runs post-success, an existing row's `current_lease_value`
 * always already equals the asserted fence -- nothing to update in
 * that case. A real, explicit "take over" (a different fence value
 * entirely) is a SEPARATE action (`apps/web/src/App.tsx`'s own
 * `takeOverRealFence`), a direct authorized client write, not routed
 * through this module or `sync-events` at all.
 */

export async function grantFenceIfNew(client, matchId, scorerStreamId, deviceId, fenceValue, nowIso) {
  const { data: existing, error: selectError } = await client
    .from("writer_fences")
    .select("scorer_stream_id")
    .eq("scorer_stream_id", scorerStreamId)
    .maybeSingle();
  if (selectError) throw new Error(`grantFenceIfNew: writer_fences select failed: ${selectError.message}`);
  if (existing) return;

  const { error: insertError } = await client.from("writer_fences").insert({
    scorer_stream_id: scorerStreamId,
    match_id: matchId,
    current_lease_value: fenceValue,
    held_by_device_id: deviceId,
    granted_at: nowIso,
  });
  if (insertError) throw new Error(`grantFenceIfNew: writer_fences insert failed: ${insertError.message}`);
}
