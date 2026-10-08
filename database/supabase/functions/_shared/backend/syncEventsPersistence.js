/**
 * TASK-0148: the real Postgres I/O layer for the `sync-events` Edge
 * Function (`database/supabase/functions/sync-events/index.ts`) --
 * picked after "build the real HTTP server and wire it to Postgres."
 *
 * **A real architectural contradiction found before writing anything:**
 * `technology-stack.md`'s own `ADR-T04`/`ADR-T07` and `system-
 * architecture.md`'s own `C-8` all explicitly reject a hand-rolled
 * server + framework ("no bespoke server fleet in v1"; "Self-managed
 * Postgres + a framework (NestJS/…): more control, far more ops" is
 * the named REJECTED alternative). The real decision: **PostgREST**
 * serves reads directly off the schema + RLS (no hand-written read
 * endpoints at all), and **Supabase Edge Functions (Deno/TypeScript)**
 * serve commands. Presented this to the user via `AskUserQuestion`
 * before building a single line; the user picked the
 * architecture-faithful path, not a generic Express/`pg` server.
 *
 * **The pure/IO split already established in this codebase is reused
 * directly, not reinvented:** `backend/src/authz/roleContext.ts`
 * (`computeRoleContext` pure / `fetchRoleContext` IO) and
 * `session.ts`'s `resolveUserId` are the precedent -- a `SupabaseClient`
 * is always passed in, never constructed here; `.from(table).select()`
 * is the query shape; every IO function carries the same "NOT
 * integration-tested -- no Supabase project exists anywhere in this
 * repository" disclaimer those two already use (confirmed still true:
 * `which psql`/`docker ps` both fail in this environment; the user
 * explicitly chose to proceed without Docker rather than wait on it).
 *
 * **A real, structural finding that shapes this whole module:** every
 * `*Store` interface in `backend/src/commands/`/`backend/src/sync/`
 * (`OfficialStore`, `MatchEventStore`, etc.) is SYNCHRONOUS -- `get(id):
 * X | null`, never `Promise<X | null>`. A real Postgres-backed class
 * cannot implement these interfaces directly (network IO is
 * irreducibly async). Retrofitting every Store interface to `Promise`
 * would force every one of the 147 already-built, already-tested
 * command modules to become `async` too -- a sweeping, destabilising
 * change to code this session has spent 147 tasks getting right, and
 * not what was asked. Instead, this module follows the SAME "pure core
 * + IO shell" shape `roleContext.ts` already uses, one level up: fetch
 * everything one `pushEvents()` call needs into a plain, pre-seeded
 * in-memory snapshot (via real async Supabase queries), run the
 * EXISTING, UNCHANGED, already-tested `pushEvents()` against that
 * snapshot synchronously, then persist the result (also real async
 * Supabase calls). Every one of `pushEvents.ts`'s own 419 tests keeps
 * passing, completely untouched.
 *
 * **A real pre-existing documentation/implementation mismatch found
 * while building this, flagged rather than silently worked around:**
 * `ingestPushBatch.ts`'s own `TASK-0036` doc comment claims
 * `event_ordinal` is "server-assigned at insert time, never
 * client-supplied." Checked `system-architecture.md §3.7` directly (the
 * section that very comment cites) and found the opposite: the Push
 * flow's own text lists "ordinal sanity" as one of the SERVER'S
 * validation checks on an already-supplied value, not a value the
 * server generates -- and `api-specification.md §12.1`'s own per-event
 * wire shape (confirmed against `live-scoring.md §16.2` too) lists
 * `eventOrdinal` as a field the CLIENT sends, consistent with an
 * offline-first client needing to assign its own dense ordinal locally,
 * immediately, without a server round-trip. **This module stores the
 * client's own `eventOrdinal` verbatim**, per the real spec text --
 * `InMemoryMatchEventStore`'s own counter-based `nextOrdinal` remains
 * exactly as it was (it backs `GET /sync/changes`'s own pull-side
 * pagination only, a separate concern `ingestPushBatch`/`ingestPushBatchWithFenceCheck`'s
 * accept/reject logic never reads at all) -- fixing that comment/class
 * is a real, bounded follow-up, explicitly NOT done here to keep this
 * task's own diff to the new persistence layer only.
 *
 * **Deliberately NOT wired: `BattingContextDeps` (`TASK-0147`).** No
 * `batting_state` table exists anywhere in `data-specification.md` --
 * that module's own design is intentionally ephemeral/caller-seeded,
 * with no persisted backing at all. Omitting it here means `V8`
 * validates against `EMPTY_BATTING_CONTEXT` for every real request,
 * identical to `TASK-0144`'s own original behavior -- not a regression,
 * the same fallback every omitted-optional-parameter case already uses.
 */
import { InMemoryOfficialStore } from "./officials.js";
import { InMemoryMatchOfficialStore } from "./matchOfficials.js";
import { InMemoryFeatureFlagStore } from "./featureFlags.js";
import { InMemoryWriterFenceStore } from "./writerFence.js";
import { DELIVERY_DOMAIN_VALIDATION_BYPASS_FLAG_KEY } from "./pushEvents.js";
// ---------------------------------------------------------------------------
// Pure row <-> type mapping. Unit-tested directly (no Supabase client
// needed) -- the async query shells below are the only part that can't
// be exercised without a real project.
// ---------------------------------------------------------------------------
export function mapOfficialRowFromDb(row) {
    return {
        id: row.id,
        organizationId: row.organization_id ?? null,
        userId: row.user_id ?? null,
        name: row.name,
        rowVersion: row.row_version,
        createdAt: row.created_at,
        createdBy: row.created_by,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
    };
}
export function mapMatchOfficialRowFromDb(row) {
    return {
        matchId: row.match_id,
        officialId: row.official_id,
        role: row.role,
        createdAt: row.created_at,
        createdBy: row.created_by,
    };
}
export function mapFeatureFlagRowFromDb(row) {
    return {
        key: row.key,
        enabled: row.enabled,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
    };
}
export function mapMatchEventRowFromDb(row) {
    return {
        eventId: row.event_id,
        streamId: row.scorer_stream_id,
        deviceId: row.device_id,
        deviceSeq: row.device_seq,
        prevHash: row.prev_hash,
        hash: row.hash,
        payload: row.payload,
        type: row.type ?? undefined,
        eventVersion: row.event_version ?? undefined,
        hlc: row.hlc ?? undefined,
        eventOrdinal: row.event_ordinal ?? undefined,
        actorRef: row.actor_ref ?? undefined,
        provenance: row.provenance,
        recordedAt: row.recorded_at ?? undefined,
        supersedes: row.supersedes ?? null,
        voids: row.voids ?? null,
    };
}
function assertPresent(value, fieldName, eventId) {
    if (value === undefined || value === null) {
        throw new Error(`mapIncomingPushEventToInsertRow: event ${eventId} is missing required field "${fieldName}" -- cannot persist to match_events`);
    }
    return value;
}
/**
 * `event.hlc`/`eventOrdinal`/`actorRef`/`provenance`/`recordedAt` are
 * optional on `IncomingPushEvent` only so this module's own widening
 * (`TASK-0148`) doesn't break any pre-existing test construction site --
 * on the real wire (`api-specification.md §12.1`), every one of them is
 * required, and the `match_events` schema itself (`data-specification.md
 * §6.1`) enforces this with `NOT NULL`. Missing one here is a genuine
 * malformed request, not something to silently null out -- that would
 * trade a clear application error for a cryptic Postgres constraint
 * violation.
 */
export function mapIncomingPushEventToInsertRow(event, matchId, serverReceivedAtIso) {
    return {
        event_id: event.eventId,
        match_id: matchId,
        scorer_stream_id: event.streamId,
        device_id: event.deviceId,
        device_seq: event.deviceSeq,
        hlc: assertPresent(event.hlc, "hlc", event.eventId),
        event_ordinal: assertPresent(event.eventOrdinal, "eventOrdinal", event.eventId),
        type: assertPresent(event.type, "type", event.eventId),
        event_version: assertPresent(event.eventVersion, "eventVersion", event.eventId),
        payload: event.payload,
        supersedes: event.supersedes ?? null,
        voids: event.voids ?? null,
        actor_ref: assertPresent(event.actorRef, "actorRef", event.eventId),
        provenance: assertPresent(event.provenance, "provenance", event.eventId),
        recorded_at: assertPresent(event.recordedAt, "recordedAt", event.eventId),
        server_received_at: serverReceivedAtIso,
        prev_hash: event.prevHash,
        hash: event.hash,
    };
}
// ---------------------------------------------------------------------------
// The hydrated MatchEventStore -- see this module's own doc comment for
// why a bespoke implementation, not InMemoryMatchEventStore, is used:
// "known event ids" (idempotent-replay detection) and "the stream's
// current head" (sequence/hash-chain continuity) must be seeded as two
// independent facts, since real historical rows arrive from Postgres in
// no particular order and InMemoryMatchEventStore's own insert() would
// let a later seed silently overwrite an earlier, correct head.
// ---------------------------------------------------------------------------
export class HydratedMatchEventStore {
    knownEventIds = new Set();
    lastSeqByStream = new Map();
    lastHashByStream = new Map();
    newlyInserted = [];
    /** §9.1 idempotency: this eventId was already durably accepted before THIS call, regardless of its own device_seq relative to the stream's current head. */
    seedKnownEventId(eventId) {
        this.knownEventIds.add(eventId);
    }
    /** The stream's true latest accepted device_seq/hash, independent of which event ids happen to overlap this batch's own submission. */
    seedStreamHead(streamId, deviceSeq, hash) {
        this.lastSeqByStream.set(streamId, deviceSeq);
        this.lastHashByStream.set(streamId, hash);
    }
    has(eventId) {
        return this.knownEventIds.has(eventId);
    }
    insert(event) {
        this.knownEventIds.add(event.eventId);
        this.lastSeqByStream.set(event.streamId, event.deviceSeq);
        this.lastHashByStream.set(event.streamId, event.hash);
        this.newlyInserted.push(event);
    }
    lastConfirmedDeviceSeq(streamId) {
        return this.lastSeqByStream.get(streamId) ?? null;
    }
    lastHash(streamId) {
        return this.lastHashByStream.get(streamId) ?? null;
    }
    /** `ingestPushBatch`'s own `has()`-short-circuit (§9.1) means `insert()` only ever fires for genuinely new events -- a replay never reaches here. This is exactly the set `persistAcceptedEvents` needs to write. */
    getNewlyInserted() {
        return this.newlyInserted;
    }
}
/**
 * Fetches exactly what ONE `pushEvents()` call needs -- never the whole
 * table. `NOT integration-tested: no Supabase project exists anywhere in
 * this repository to run this against` (the same disclaimer `roleContext.ts`/
 * `session.ts` already carry).
 */
export async function hydrateSyncEventsDeps(client, request, userId) {
    const matchId = request.matchId;
    const scorerStreamId = request.scorerStreamId;
    const incomingEventIds = (request.events ?? []).map((e) => e.eventId);
    const eventStore = new HydratedMatchEventStore();
    const fenceStore = new InMemoryWriterFenceStore();
    const officialStore = new InMemoryOfficialStore();
    const matchOfficialStore = new InMemoryMatchOfficialStore();
    const featureFlagStore = new InMemoryFeatureFlagStore();
    const { data: officialRows, error: officialsError } = await client
        .from("officials")
        .select("id, organization_id, user_id, name, row_version, created_at, created_by, updated_at, updated_by")
        .eq("user_id", userId);
    if (officialsError)
        throw new Error(`hydrateSyncEventsDeps: officials query failed: ${officialsError.message}`);
    const officialIds = [];
    for (const row of officialRows ?? []) {
        const mapped = mapOfficialRowFromDb(row);
        officialStore.insert(mapped);
        officialIds.push(mapped.id);
    }
    if (officialIds.length > 0) {
        const { data: moRows, error: moError } = await client
            .from("match_officials")
            .select("match_id, official_id, role, created_at, created_by")
            .eq("match_id", matchId)
            .in("official_id", officialIds);
        if (moError)
            throw new Error(`hydrateSyncEventsDeps: match_officials query failed: ${moError.message}`);
        for (const row of moRows ?? [])
            matchOfficialStore.upsert(mapMatchOfficialRowFromDb(row));
    }
    const { data: flagRow, error: flagError } = await client
        .from("feature_flags")
        .select("key, enabled, updated_at, updated_by")
        .eq("key", DELIVERY_DOMAIN_VALIDATION_BYPASS_FLAG_KEY)
        .maybeSingle();
    if (flagError)
        throw new Error(`hydrateSyncEventsDeps: feature_flags query failed: ${flagError.message}`);
    if (flagRow)
        featureFlagStore.upsert(mapFeatureFlagRowFromDb(flagRow));
    const { data: fenceRow, error: fenceError } = await client.from("writer_fences").select("current_lease_value").eq("scorer_stream_id", scorerStreamId).maybeSingle();
    if (fenceError)
        throw new Error(`hydrateSyncEventsDeps: writer_fences query failed: ${fenceError.message}`);
    if (fenceRow)
        fenceStore.setFence(scorerStreamId, String(fenceRow.current_lease_value));
    const { data: headRows, error: headError } = await client
        .from("match_events")
        .select("device_seq, hash")
        .eq("scorer_stream_id", scorerStreamId)
        .order("device_seq", { ascending: false })
        .limit(1);
    if (headError)
        throw new Error(`hydrateSyncEventsDeps: match_events head query failed: ${headError.message}`);
    if (headRows && headRows.length > 0) {
        const head = headRows[0];
        eventStore.seedStreamHead(scorerStreamId, head.device_seq, head.hash);
    }
    if (incomingEventIds.length > 0) {
        const { data: knownRows, error: knownError } = await client.from("match_events").select("event_id").eq("scorer_stream_id", scorerStreamId).in("event_id", incomingEventIds);
        if (knownError)
            throw new Error(`hydrateSyncEventsDeps: match_events idempotency query failed: ${knownError.message}`);
        for (const row of knownRows ?? [])
            eventStore.seedKnownEventId(row.event_id);
    }
    return { eventStore, fenceStore, officialStore, matchOfficialStore, featureFlagStore };
}
/**
 * Persists exactly the events `pushEvents()` genuinely newly accepted
 * this call (`HydratedMatchEventStore.getNewlyInserted()`) -- a replay
 * never reaches here (`has()` short-circuits inside `ingestPushBatch`
 * before `insert()` ever fires), so this never attempts a duplicate
 * `event_id` insert. `NOT integration-tested` -- same disclaimer as
 * `hydrateSyncEventsDeps`.
 */
export async function persistAcceptedEvents(client, matchId, eventStore, nowIso) {
    const rows = eventStore.getNewlyInserted().map((event) => mapIncomingPushEventToInsertRow(event, matchId, nowIso));
    if (rows.length === 0)
        return;
    const { error } = await client.from("match_events").insert(rows);
    if (error)
        throw new Error(`persistAcceptedEvents: match_events insert failed: ${error.message}`);
}
//# sourceMappingURL=syncEventsPersistence.js.map