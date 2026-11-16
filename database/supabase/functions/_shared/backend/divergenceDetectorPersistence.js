/**
 * TASK-0161: wires the already-built-but-never-called
 * `detectAndRecordDivergences` (`divergenceDetector.js`, `TASK-0038`)
 * into the real `sync-events` pipeline for the first time ever --
 * confirmed via grep before writing anything: no Edge Function
 * anywhere called it, meaning `divergences` rows could NEVER be
 * created by real usage despite the detection logic itself being
 * fully built and tested since `TASK-0038`.
 *
 * Same "pure core + IO shell" pattern `syncEventsPersistence.js`
 * (`TASK-0148`) already established: fetch a real snapshot (every
 * OTHER stream's own active deliveries for this match, plus this
 * match's existing `divergences` rows) into a plain in-memory seed,
 * run the EXISTING, UNCHANGED, already-tested `detectAndRecordDivergences`
 * synchronously against it, then persist only the newly-detected rows.
 *
 * `overBall` is a deliberately simplified key: the stream-local,
 * zero-indexed position of each active delivery (by `event_ordinal`),
 * not true "over.ball" notation -- `divergenceDetector.ts`'s own
 * `StreamDeliveryRecord.overBall` is an opaque alignment key the
 * detector itself never parses or formats, so a position index is
 * sufficient and flagged rather than invented beyond what's needed.
 * `fields` compares only `runs` (the delivery's total runs) and
 * `wicketMode` (null or the dismissal mode) -- the two most basic,
 * genuinely comparable scoring facts, not the full payload -- a
 * deliberately minimal comparison set, the same "flag the boundary,
 * don't over-build" discipline this session has used throughout.
 *
 * A failure in THIS module never fails the push itself -- the event
 * was already genuinely accepted and persisted by the time this runs;
 * divergence detection is a best-effort secondary pass, not part of
 * `sync-events`' own primary contract.
 */

import { detectAndRecordDivergences } from "./divergenceDetector.js";

function activeDeliveryRows(rows) {
  const voidedIds = new Set(rows.filter((r) => r.voids).map((r) => r.voids));
  return rows.filter((r) => r.type === "DELIVERY_RECORDED" && !voidedIds.has(r.event_id));
}

function toStreamRecords(rows) {
  const active = activeDeliveryRows(rows).sort((a, b) => a.event_ordinal - b.event_ordinal);
  return active.map((row, index) => {
    const payload = row.payload ?? {};
    const runEvents = payload.runEvents ?? [];
    const runs = runEvents.reduce((sum, e) => sum + (e.value ?? 0), 0);
    const wicketMode = payload.wicket?.mode ?? null;
    return { overBall: String(index), fields: { runs, wicketMode } };
  });
}

/** Seeds from the real, already-persisted rows; collects only newly-detected ones for a real INSERT afterward. */
class PostgresDivergenceStore {
  constructor(existingRows) {
    this.existing = existingRows;
    this.newlyInserted = [];
  }

  hasUnresolved(matchId, overBall, field) {
    const inExisting = this.existing.some(
      (r) => r.match_id === matchId && r.over_ball === overBall && r.field === field && r.status !== "RESOLVED",
    );
    const inNew = this.newlyInserted.some(
      (r) => r.matchId === matchId && r.overBall === overBall && r.field === field && r.status !== "RESOLVED",
    );
    return inExisting || inNew;
  }

  insert(record) {
    if (record.id === undefined) record.id = crypto.randomUUID();
    this.newlyInserted.push(record);
  }

  // Not needed for detection-only use here -- propose/confirm have their
  // own real Postgres-backed get/update, in divergenceResolutionPersistence.js.
  get() {
    return null;
  }

  update() {}
}

export async function detectAndPersistRealDivergences(client, matchId, justPushedStreamId) {
  const { data: allRows, error } = await client
    .from("match_events")
    .select("event_id, scorer_stream_id, type, payload, voids, event_ordinal")
    .eq("match_id", matchId);
  if (error) throw new Error(`detectAndPersistRealDivergences: match_events query failed: ${error.message}`);

  const byStream = new Map();
  for (const row of allRows ?? []) {
    if (!byStream.has(row.scorer_stream_id)) byStream.set(row.scorer_stream_id, []);
    byStream.get(row.scorer_stream_id).push(row);
  }
  const otherStreamIds = [...byStream.keys()].filter((id) => id !== justPushedStreamId);
  if (otherStreamIds.length === 0) return [];

  const { data: existingDivergences, error: divError } = await client
    .from("divergences")
    .select("match_id, over_ball, field, status")
    .eq("match_id", matchId);
  if (divError) throw new Error(`detectAndPersistRealDivergences: divergences query failed: ${divError.message}`);

  const store = new PostgresDivergenceStore(existingDivergences ?? []);
  const streamARecords = toStreamRecords(byStream.get(justPushedStreamId) ?? []);
  const allNewlyRecorded = [];
  for (const otherStreamId of otherStreamIds) {
    const streamBRecords = toStreamRecords(byStream.get(otherStreamId) ?? []);
    const newlyRecorded = detectAndRecordDivergences(matchId, justPushedStreamId, streamARecords, otherStreamId, streamBRecords, store);
    allNewlyRecorded.push(...newlyRecorded);
  }
  if (allNewlyRecorded.length === 0) return [];

  const rows = allNewlyRecorded.map((d) => ({
    id: d.id,
    match_id: d.matchId,
    over_ball: d.overBall,
    field: d.field,
    stream_a_id: d.streamAId,
    stream_b_id: d.streamBId,
    value_a: d.valueA,
    value_b: d.valueB,
    status: d.status,
  }));
  const { error: insertError } = await client.from("divergences").insert(rows);
  if (insertError) throw new Error(`detectAndPersistRealDivergences: divergences insert failed: ${insertError.message}`);
  return allNewlyRecorded;
}
