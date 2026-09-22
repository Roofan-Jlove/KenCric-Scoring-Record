# Cricket Scoring Book — Offline-First Specification

| | |
|---|---|
| **Document** | Offline-First Specification |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-21 |
| **Upstream** | `docs/architecture/system-architecture.md` v0.1.0 (§3.6 Offline storage, §3.7 Sync architecture) · `docs/architecture/technology-stack.md` v0.1.0 (`ADR-T06` local database, `ADR-T09` synchronization) · `docs/specs/live-scoring.md` v0.1.0 (event schema, audit record, Undo/Correction) · `docs/specs/software-requirements-specification.md` v0.1.0 (`OFF-*`, `SYNC-*`, `AUD-*`, `SEC-014`) |
| **Downstream** | The shared scoring core's sync layer implementation · offline chaos test suite · sync-convergence test suite |
| **Status** | A **deterministic operational specification**, in the same spirit as `live-scoring.md`. **Not source code.** It does not redefine the container architecture (`system-architecture.md` remains authoritative for *what the components are*); it fixes the exact, implementable rules for *how the offline/sync subsystem behaves*, case by case, so two independent client implementations converge on identical outcomes. This document fulfils the `offline-first-strategy.md` item already listed as planned in `docs/README.md`, and substantially covers what `realtime-sync.md` would otherwise hold. |

> The scorer must be able to conduct and score a complete match with zero internet access, for any duration, with zero data loss, and have it reconcile deterministically with the server and any other device once connectivity returns. This document is the exact rule set that makes that guarantee mechanically true rather than aspirational.

---

## 1. Purpose, governing principle, and notation

### 1.1 The governing principle

**The device is the source of truth for its own unsynced work. The server is the durable destination. Synchronization reconciles the two without ever inventing, discarding, or silently overwriting a fact.** Every rule in this document is a specific instance of that one sentence. Where a rule seems to add complexity, it is because a naive shortcut would violate it (see §10–§11's fence/divergence model, which exists precisely because "just let whoever syncs last win" would silently overwrite a fact).

### 1.2 Determinism contract

Identical to `live-scoring.md §1.1`: same pre-state + same input ⇒ same output, always, on every platform, forever. Nothing in this document depends on wall-clock time for a correctness decision (clock **values** are recorded for display and skew-detection, never trusted as an ordering authority — §7.4); nothing depends on which of two racing requests happens to arrive first at the network layer (ordering is decided by data already agreed, §10).

### 1.3 Relationship to other documents

| Concept | Defined authoritatively in | This document's job |
|---|---|---|
| Event shape (`EVT-DELIVERY-RECORDED` etc.), `event_id`/`device_seq`/`hlc`/`event_ordinal`, hash chain, audit fields | `live-scoring.md §16–17` | Reused verbatim — never redefined here. |
| Component topology (client containers, backend containers, PowerSync's role) | `system-architecture.md §3.1–§3.7` | Reused as given — this document does not choose technology, it specifies behavior. |
| Screens (Offline Mode, Sync Status, Conflict Resolution) | `docs/ux/ux-specification.md` UX-23/24/25 | This document is what those screens display and act on. |
| Reconciliation invariants `INV-001…018` | `live-scoring.md §20` | Cross-referenced, not repeated. |

### 1.4 Notation and tags

Rules use the same style as `live-scoring.md` (numbered, table-driven, formula-precise). Because this document is a systems/protocol specification rather than a cricket-domain one, it uses its own tag set instead of `[LAW]`/`[PRD]`/`[CFG]`/`[EDGE]`:

| Tag | Meaning |
|---|---|
| `[INVARIANT]` | Must always hold; not configurable; violating it is a defect, not a policy choice. |
| `[DEFAULT]` | A specific operational parameter (a timeout, a batch size, a retry count) — tunable, stated here as the working default. |
| `[POLICY]` | A deliberate design choice among genuine alternatives, made explicitly and defensibly, revisitable with a stated trigger. |
| `[OPEN]` | Not yet resolved; implement the stated default, do not treat it as beyond question. |

---

## 2. Local data ownership

"Ownership" here means: **which party's copy is authoritative, and who may legitimately extend it.**

### 2.1 Ownership by data category

| Data category | Owner while offline | Owner once synced | What happens to the local copy after sync |
|---|---|---|---|
| **Domain events** (`match_events` — deliveries, wickets, corrections, sign-offs) for **this device's own stream(s)** | **This device, exclusively** `[INVARIANT]` | Joint — server and device both hold a complete, agreeing copy | Retained. It is never deleted merely because it synced; it becomes eligible for the retention/purge policy (§3.5) only once explicitly superseded by that policy, never automatically on sync. |
| Domain events belonging to **another device's stream** (dual-scorer, or a prior device on the same match) | Not owned by this device at all — this device has, at most, a **cached read copy** received via pull (§7.3) | Server | The device's cached copy is a read-only mirror; this device may never append to another stream. |
| **Reference data** (squads, templates, condition profiles, DLS tables, app config) | **Server**, always — the device holds a **pinned, versioned cached snapshot**, never an authoritative copy | Server | The cached snapshot remains valid for the lifetime of the match it was pinned to (`BR-032`, `MINV-05`); it is not "synced" in the push sense — it is only ever pulled. |
| **Auth session / claims snapshot** | Device, time-boxed to the offline grace window (`OFF-013`) | Server (issuer of truth for the session) | Device cache expires on its own schedule, independent of match sync. |
| **Local backup archive files** (`FR-149`) | Device, exclusively, always | Device, exclusively, always | Never becomes server-owned — a local backup is a portability artefact, not a sync target. |
| **Sync metadata** (outbox, cursors/watermarks, fence-token lease state) | Device, exclusively, ephemeral | N/A — this data is never itself synced | Discarded/rebuilt as needed; it describes the sync process, it is not domain data. |

### 2.2 The guest-match special case

A guest match (`organization_id = null`) has **no server-side existence at all** until claimed (`SEC-016`, `MINV-15`). Every row in §2.1's "domain events for this device's own stream" applies, with "server" simply absent from the picture — the device is the *sole* owner, permanently, unless and until an `EVT-GUEST-MATCH-CLAIMED` event establishes a server copy. Claiming does not change which events exist or their content; it only adds an owner/organization association (`MBR-02`).

### 2.3 Ownership transitions are never silent

A device's local copy of an event transitions from **"local-only"** → **"synced (acknowledged)"** exactly once, the instant the server's push-acknowledgment for that specific `event_id` is received (§7.2, §9). This transition is recorded locally (the sync-metadata watermark advances) and is what every other section in this document (queue, partial sync, reconnection) measures against. There is no intermediate "probably synced" state — an event is either acknowledged or it is not.

---

## 3. Local persistence

### 3.1 The durability contract `[INVARIANT]`

Every domain event, without exception, is written to durable local storage and **only then** does the UI confirm the action to the scorer (`live-scoring.md §17`, `NFR-010`). This is the single load-bearing guarantee behind "zero events lost" (`NFR-009`). No code path may show a confirmation before the write is durably committed, and no code path may treat "queued for sync" as equivalent to "durably committed" — the local commit happens **before and independently of** anything to do with the network.

### 3.2 What is persisted locally

| Store | Contents | Mutability |
|---|---|---|
| **Local event log** | Every active and superseded/voided domain event for every match this device has scored, in the exact shape defined by `live-scoring.md §16` (including `event_id`, `device_seq`, `hlc`, `event_ordinal`, `prevHash`/`hash`) | **Append-only** — never updated or deleted (`MINV-01`), mirrored locally exactly as it will be server-side |
| **Outbox** | An ordered view over the same log: which locally-committed items have **not yet** been acknowledged by the server (§6) | Append on commit; entries leave only on acknowledgment |
| **Sync cursors/watermarks** | Per-match, per-stream: `lastConfirmedDeviceSeq` (this device's own push progress) and `lastPulledEventOrdinal`/`lastPulledServerCursor` per remote stream this device reads (pull progress) | Advances monotonically; never rewound except by the recovery procedures in §15 |
| **Fence-token lease state** | The most recent lease value this device holds or last knew about, per match (§7.5, §10.1) | Replaced on each renewal/loss |
| **Reference-data cache** | Pinned snapshots of condition profiles, DLS tables, squads/templates | Replaced wholesale on a fresh pull; never partially patched |
| **Projection cache** | Scorecards, cards, FoW, etc. — entirely disposable (`MBR-07`) | Rebuilt by folding the active event log; never itself a source of truth |

### 3.3 Write ordering `[INVARIANT]`

Within one device, events for a given stream are appended with a strictly increasing `device_seq`, with no gaps and no reuse, by construction — the local persistence layer is the single writer of this sequence and is not itself concurrent within a device (a device has exactly one active scoring session per match at a time; see §4.4 for the multi-tab/multi-process case). An attempt to persist an out-of-sequence `device_seq` is a defect, not a scenario this specification accommodates — it indicates local storage state was lost or corrupted, and is handled by §15.4, not by silently renumbering.

### 3.4 Recovery on load

Restated precisely from `live-scoring.md §18.1`/`MBR-07` as the canonical local-persistence contract: on every app start, and on resuming an interrupted session, the current state of a match is **always** obtained by folding the active portion of the local event log from the beginning — never by trusting a previously cached "current state" snapshot as authoritative. The projection cache (§3.2) is an optimization (a device may reuse a last-known-good snapshot plus fold only the events after it, if it can prove that snapshot is still valid), never a substitute for this guarantee.

### 3.5 Retention `[POLICY]`

A match's local event log is retained **indefinitely by default**; it becomes eligible for purge (freeing local storage, `OFF-016`, `UX-27`) only once **all** of the following hold: the match is `FINAL`, every event in its log is acknowledged by the server (§2.3), and the user has explicitly triggered a purge (or an automatic retention-window policy the user has configured) — purge is never automatic on sync completion alone.

---

## 4. Offline commands

### 4.1 The classification principle `[INVARIANT]`

**A command is offline-capable if and only if it operates entirely on data this device already owns or has a valid cached copy of (§2), and does not require an answer only the server can currently provide.** This is a closed, checkable rule, not a per-command judgement call — every command in the catalogue below is classified by applying it.

### 4.2 A critical design clarification `[INVARIANT]`

**Offline commands execute immediately, fully, against local state — they are never queued for later execution.** Only the *transmission of the resulting event(s) to the server* is queued (§6). A scorer recording a wicket while offline does not wait for anything; the wicket is fully processed by the pipeline in `live-scoring.md §5–§15` the instant it's entered, and the projection updates immediately. The offline/online distinction affects **only** whether the resulting event has left the device yet — never whether the command itself has taken effect.

### 4.3 Command catalogue

| Command / action | Offline-capable? | Why |
|---|---|---|
| Create/configure a match, team selection, Playing XI, toss, innings setup (`UX-04…09`) | **Yes** | Operates on local input + cached reference data (§2.1). |
| Every live-scoring action: ball entry, wicket entry, extras, strike change/override, bowler change, over completion, pause/resume (`UX-10…16`, `UX-19`) | **Yes** | Pure local state transitions per `live-scoring.md`. |
| Undo, Correction (`UX-17/18`) | **Yes** | §18–19 of `live-scoring.md`, both defined as local operations. |
| Sign-off | **Yes** (`OFF-002/018`) | Local reconciliation check + a local event; publish/notify are separately queued (§6.2), not a precondition of sign-off itself. |
| Scorecard, ball-by-ball, match summary viewing; PDF/CSV export; print | **Yes** (`OFR-009/010`) | Read from local projections; export writes to local storage. |
| Local backup create/restore | **Yes** (`OFR-011`) | By definition local. |
| Match search/history over **locally cached** matches | **Yes**, with a "may be incomplete" caveat for anything not yet pulled | Reads local cache. |
| Guest-mode scoring end-to-end | **Yes** (`OFR-013`) | No server involvement exists for a guest match at all. |
| Sign-in with a **cached** session inside the grace window | **Yes** (`OFF-013`) | Local claims-snapshot verification (§2.1). |
| **Not offline-capable:** account creation, fresh sign-in with no cached session, password reset | **No** | Identity issuance is exclusively a server function (`A-12`). |
| **Not offline-capable:** sending an invitation, approving an appearance claim, publishing a share link, competition/standings recompute, admin operations | **No**, but the *request* can be **queued** (§6.2) | The action's effect requires server-side processing or requires reading state (other users, other devices' data) this device cannot have a valid offline copy of. |
| **Not offline-capable:** viewing another device's *unsynced* data | **No** | By definition — it hasn't reached this device or the server yet; there is nothing to read. |

---

## 5. Local validation

### 5.1 Two distinct guarantees `[INVARIANT]`

Local validation and server-side validation answer **different questions**, and neither one supersedes the other:

- **Local validation** (`live-scoring.md §5`'s V1–V11, plus this document's own §7.6/§10 checks): *"is this consistent with everything this device currently knows?"* — runs synchronously, before any command is accepted, using only local state. It is authoritative for the scorer's immediate experience.
- **Server-side validation** (§7.2): *"is this consistent with everything that has actually happened, including facts this device did not yet have?"* — runs on ingest, using the server's merged, multi-device view. It can reject something local validation correctly accepted (e.g. a fence conflict this device could not have known about while offline).

A rejection at the server stage is **not a bug in local validation** — it is local validation correctly doing the only job it can do with the information available to an offline device.

### 5.2 What local validation can and cannot catch

| Check | Enforceable offline (locally) | Enforceable only once online |
|---|---|---|
| Field-level input correctness (`live-scoring.md` V1–V4, V6–V9, V11) | **Yes** — depends only on the input itself | — |
| State-dependent domain rules against *this device's own* known history (dismissal-mode validity, guardrails, XI validity) | **Yes** — depends only on this device's active local log | — |
| Writer-fence validity (§10.1) | **No, not definitively** — a device offline for a period cannot know whether another device has since taken over the lease | **Yes** — the server holds the authoritative current lease |
| Value-level divergence against another scorer's stream (§10.2) | **No** — this device has no visibility into a stream it hasn't pulled | **Yes** — only detectable once both streams are present in one place |
| Hash-chain continuity against the server's last-known state | **Only against this device's own local chain** (which is always internally consistent by construction) | **Yes**, against the server's independently-held prior hash (§17) |

Every command's local validation therefore has an honest, bounded scope: it prevents every *avoidable* local mistake, and cannot prevent — nor does it pretend to prevent — a conflict whose other half lives on a device or server this one hasn't yet talked to.

---

## 6. Event queue (the outbox)

### 6.1 Structure `[INVARIANT]`

The outbox is an **ordered view over the local event log**: every locally-committed item (domain event, correction, void, strike-override, sign-off, or a queued publish/notify intent, §6.2) that has not yet been acknowledged by the server, in exactly the order it was committed. It is not a separate, independently-writable store — an item enters the outbox **in the same local transaction** as its own durable commit (§3.1), so "committed" and "queued for sync" can never diverge (there is no state where an event exists in the log but was never enqueued, or vice versa).

### 6.2 What is queued

- Every domain event from `live-scoring.md §16` (`EVT-DELIVERY-RECORDED`, `EVT-NON-STRIKER-RUN-OUT`, `EVT-STRIKER-OVERRIDDEN`, `EVT-DELIVERY-CORRECTED`, `EVT-DELIVERY-VOIDED`, `EVT-PLAYING-CONDITIONS-FROZEN`) and the match-lifecycle events (sign-off, pause/resume, etc.) it references.
- **Publish/notify intents** (`OFF-018/019`) — e.g. "make this match's share link live," "send the assignment notification" — queued the same way, with their own idempotency key (§9.3), even though their *effect* only ever happens server-side.

### 6.3 Ordering `[INVARIANT]`

The outbox for a given stream is always processed **strictly FIFO** — the item at the head (lowest `device_seq`) is the next and only thing that may be transmitted for that stream. This is never reordered, batched out of order, or skipped, for the reason given in §10.3.

### 6.4 Dequeue rule `[INVARIANT]`

An item leaves the outbox **only** when the server has returned an explicit acknowledgment for that specific `event_id` (§7.2, §9.1) — never merely because it was "sent," never speculatively, never in a batch whose overall HTTP call merely returned success without itemised confirmation. This single rule is what makes every other section (partial sync, retry, gap-free ordering) provably correct rather than merely "usually correct."

### 6.5 Growth and backpressure `[POLICY]`

No hard cap is placed on outbox size or count — durability outranks an arbitrary limit, and a multi-day offline stretch must not lose data. The only user-facing constraint is the general local-storage-quota warning (`OFF-016`), which is about device disk space, not the sync mechanism. At transmission time, a large outbox is **chunked** into bounded batches (§7.1's `[DEFAULT]` batch size) — chunking is a transport concern, never a reason to drop or summarize queued items.

---

## 7. Sync protocol

### 7.1 Push (upload)

1. Take the outbox for one stream, in FIFO order (§6.3), and form a batch of up to `maxBatchSize = 200 events` `[DEFAULT]` (tuned to keep a batch well inside `NFR-006`'s 3G-class budget for a full T20's ~250 events across a small number of batches).
2. Submit the batch with: the device's identity, the batch's events (each carrying its own `event_id`, `device_seq`, `hlc`, `event_ordinal`, `prevHash`, payload — `live-scoring.md §16.2`), and the `device_seq` the device believes is its next unconfirmed one (`expectedNextSeq`, redundant with but cross-checkable against the batch's first event).
3. The server validates **every event in the batch individually** — schema, `SVC-AUTHORIZER` role check, `device_seq` contiguity against its own stored `lastConfirmedDeviceSeq` for that device, hash-chain continuity against its own stored `prevHash`, and full domain re-validation (`live-scoring.md §5`) — and returns a **per-event outcome**: `ACCEPTED` (with the new server-side position) or `REJECTED` (with a structured reason code, §14.1).
4. The device advances its outbox head (§6.4) exactly as far as the **contiguous prefix of `ACCEPTED` outcomes**, starting from the current head — never past a `REJECTED` item, regardless of what came after it in the batch (§10.3, §14).

### 7.2 Acknowledgment semantics `[INVARIANT]`

An "acknowledgment" is the specific, itemised `ACCEPTED` outcome for one `event_id`, returned synchronously in the push response. A device must not treat an HTTP-level "200 OK" on the overall batch call as acknowledgment of every event inside it — the per-event outcome list is the only thing that advances the outbox (§6.4).

### 7.3 Pull (download)

1. For each remote stream this device is entitled to read on a given match (its own prior sessions on another device, or — dual-scorer, P2 — the other scorer's stream, or — any viewer/organizer context — the server-materialised projection), the device holds a cursor: `lastPulledEventOrdinal` (or an equivalent server-issued opaque cursor token).
2. The device requests everything **after** that cursor for that stream.
3. The server returns events in their canonical order (`live-scoring.md §7`'s ordinal → HLC → device-seq total order).
4. The device applies each pulled event to its local mirror of that stream **idempotently** (§9.4 — re-applying an already-applied `event_id` is a no-op), advances its cursor only past what it has durably stored locally, and only then refolds affected projections.

### 7.4 A sync cycle, precisely `[INVARIANT]`

One sync cycle is exactly this sequence, and this order, for a given match:

1. **Push** this device's own stream's outbox (§7.1) until either the outbox is empty or a `REJECTED` outcome halts it (§14).
2. **Pull** every remote stream this device reads for the match (§7.3).
3. **Apply** pulled events, refold local projections.
4. **Re-evaluate** conflict/divergence state (§10) now that both directions are current.
5. **Update** the user-visible sync state (`UX-23/24`).

Push happens before pull so that this device's own facts are recorded before it reasons about anyone else's — this does not affect *correctness* (the total order in §7.3 step 3 is deterministic regardless), but it minimizes the window in which a viewer or the other scorer would see a stale picture that's about to change again immediately.

### 7.5 Realtime is a nudge, never the durability path `[INVARIANT]`

A realtime/WebSocket channel (`system-architecture.md §3.4`) may notify a device "there may be new events for match X" to prompt an **immediate** sync cycle rather than waiting for the next periodic one. It never itself carries the authoritative event content that this section's push/pull protocol is responsible for, and its absence, failure, or a missed notification **never** causes data loss — the next sync cycle (periodic, reconnection-triggered, or manual) catches up regardless.

### 7.6 Writer-fence acquisition and renewal

Before a device's **first** push for a given scorer stream in a session, and periodically thereafter (`[DEFAULT]` every 5 minutes while actively scoring), it confirms or renews its writer-fence lease for that stream. A push batch **also** implicitly asserts the fence value it believes is current; §10.1 defines what happens when that assertion is stale.

---

## 8. Retry behavior

### 8.1 Failure classification `[INVARIANT]`

Every push (or pull, or fence-renewal) failure is classified into exactly one of two classes, and the class — not the specific symptom — determines behavior:

| Class | Examples | Response |
|---|---|---|
| **Transient** | No connectivity, request timeout, server 5xx, rate-limited (`SEC-010`), a momentary backend-degraded state | Automatic retry with backoff (§8.2). The item(s) remain in the outbox, unchanged, exactly as they were. |
| **Terminal** (for the specific item) | Schema-invalid payload, domain-validation rejection, stale writer-fence, sequence gap, hash-chain break | **Stop retrying that item immediately.** Surface it to the user (§14). Retrying an unmodified terminal-rejection is guaranteed to fail again — it is not a network problem. |

### 8.2 Backoff parameters `[DEFAULT]`

Exponential backoff with jitter: initial delay 2 s, doubling each attempt, capped at 60 s, ±20% random jitter (to avoid many devices reconnecting at the same moment — e.g. after a shared rain delay — all retrying in lockstep and overwhelming the backend). Retries for **transient** failures are **unbounded in count** — durability is paramount and the device must keep trying for as long as the item remains unsynced, including across app restarts (the outbox, being durable local state, survives a restart and resumes retrying automatically). After `[DEFAULT]` 5 consecutive transient failures for the same item, the UI surfaces a "stuck — check connection" state (`UX-24`) so a human notices, **without** the retry loop itself stopping.

### 8.3 Retry granularity

Retry operates on the **batch** as submitted (§7.1) — a batch either fully succeeds (every event `ACCEPTED`) or the device retries from the first non-accepted point on the next attempt, re-sending the unchanged remaining tail. Retry never regenerates, reorders, or merges events — it resends exactly what is already durably queued (§9.1).

### 8.4 Pull retries identically

Pull failures follow the same transient/terminal classification and the same backoff; a failed pull simply means the cursor does not advance and the next cycle tries again from the same cursor — never a partial, uncommitted application of a partially-received pull result (§7.3 step 4 only advances the cursor past what is durably stored).

---

## 9. Idempotency

### 9.1 The mechanism `[INVARIANT]`

Every event carries a client-generated `event_id` (UUID), generated **exactly once**, at the moment of local commit (`live-scoring.md §16.2`) — never regenerated on retry, never reused across a correction (a correction gets its own fresh `event_id` and references the original via `supersedes`, `live-scoring.md §19.1`). The server's event-ingest operation is defined such that **re-submitting an event whose `event_id` has already been durably accepted is a no-op that returns the identical successful outcome as the original acceptance** — never a duplicate row, never a distinct error, never a second effect.

### 9.2 Why this is sufficient

Because retry (§8) always resends the *same* already-committed, already-`event_id`-bearing item, and never fabricates a new attempt at "the same intent" with a new id, at-least-once delivery (the honest reality of any network) combines with §9.1 to produce **exactly-once effect** — the property that actually matters, without requiring a synchronous, exactly-once-delivery transport (which doesn't exist over an unreliable network).

### 9.3 Idempotency extends to every queued item type

Publish/notify intents (§6.2) and fence-renewal requests each carry their own client-generated idempotency key, and the server-side handler for each is required to be idempotent under redelivery of the same key, following the identical principle as §9.1 — this document does not special-case "domain events get idempotency but other queued items don't."

### 9.4 Idempotency applies to pull, too `[INVARIANT]`

The symmetric case: a device may, for its own legitimate reasons (a resumed cursor, a retried pull request), receive the same remote `event_id` more than once. Applying an already-applied `event_id` locally is defined as a no-op, identically to §9.1's server-side rule. This closes the "pull-side duplicate" case referenced in §16.

### 9.5 No expiry `[INVARIANT]`

Idempotency is enforced for as long as the event exists in the authoritative log — **there is no time window after which a duplicate `event_id` is no longer deduplicated.** A device offline for months that finally reconnects must sync exactly as correctly as one offline for minutes; nothing in this specification permits pruning the idempotency check as an optimisation that would violate that.

---

## 10. Conflict detection

Three structurally distinct kinds of conflict exist; each is detected differently, and this document is precise about which is which so they are never accidentally handled by the wrong mechanism.

### 10.1 Writer-fence conflicts (P1 — one scorer, possibly multiple devices)

**What:** two devices attempt to push against the **same** `scorer_stream_id` with inconsistent fence assertions — e.g. Device A holds an outdated lease because Device B has since taken over (`system-architecture.md §3.7`, `UX-25`).

**Detection:** synchronous, at push time (§7.1 step 3). The server compares the batch's asserted fence value against the currently valid lease for that stream; a mismatch is a **terminal** rejection (§8.1) for the *entire remaining batch*, with reason `STALE_FENCE`.

### 10.2 Value-level divergence (P2 — two independent scorer streams)

**What:** two **different**, legitimately independent streams (Scorer A's, Scorer B's) each recorded a value for what aligns to the same over.ball position, and those values disagree (different runs, extras, wicket, or striker).

**Detection:** **not** at push time — each stream's writer never sees the other's data while composing it. Detection is a **separate, explicit alignment pass** (`SVC-DIVERGENCE-DETECTOR`) that runs once **both** streams have reached a common point in a completed sync cycle (§7.4 step 4), comparing them field-by-field per over.ball and producing `divergence` records (`MINV-14`, `docs/ux/ux-specification.md UX-25`). This is inherently a **post-hoc** detection, not an ingest-time one — it cannot be otherwise, since the two writers are, by design, independent and offline-capable.

### 10.3 Structural/ordering and integrity conflicts

**What:** a `device_seq` gap (an incoming batch's first event does not immediately follow the server's `lastConfirmedDeviceSeq` for that device), or a hash-chain break (an incoming event's `prevHash` does not match the server's stored `hash` for the preceding event in that stream).

**Detection:** synchronous, at push time (§7.1 step 3), identically to §10.1.

**Why a gap should essentially never occur from a correctly-implemented client:** because the outbox dequeues strictly in order and only on explicit per-event acknowledgment (§6.3–§6.4), a compliant client's outbox is, by construction, always exactly the contiguous unacknowledged tail starting right after its last-confirmed event. A gap therefore signals either local storage corruption (§15.4) or a client defect — it is treated as a serious condition, not a routine one, and is **rejected outright** rather than tolerated or guessed-around (`[INVARIANT]` — the server never accepts a batch out of sequence order, and never fills a gap with an inferred value).

**Hash-chain breaks are distinguished from gaps** in their reason code and downstream handling (§14.2) — a gap is (almost always) benign and self-healing via retry; a hash-chain break additionally triggers the audit-integrity alerting path (`system-architecture.md §3.13`), because unlike a gap it is also consistent with tampering, not only with a transport anomaly.

---

## 11. Conflict resolution

### 11.1 Writer-fence resolution `[POLICY]`

The **losing** device (stale fence, §10.1) is never silently overwritten or auto-merged. It is told plainly: another device now holds the writer role for this match. Its own rejected, still-locally-held events (§14's terminal-failure handling means they remain in its outbox, never discarded) are presented with exactly two explicit options, and no default is silently applied without one of them being chosen:

1. **Take over** — re-acquire the fence (which in turn fences out whoever currently holds it), then resubmit the queued tail. If the *other* device had, in the meantime, also written valid events past the point this device diverged from, resubmission will itself produce new fence or sequence conflicts against those — at which point the situation has become a genuine **value-level** conflict between two sets of real scoring work and is handled as such (escalates to the same human-adjudicated model as §11.2, since two people scored the same balls differently — this is not swept back into a simple fence retry).
2. **Discard locally** — an explicit, confirmed action; the rejected events remain in local storage (nothing is ever silently deleted, `MINV-01` extends to local storage too) but are marked as abandoned/not-to-be-resubmitted, available for later export/audit if needed.

No third, automatic option exists. `[POLICY]`: a fence conflict is a workflow question a human must answer, never a technical merge decision.

### 11.2 Value-level divergence resolution (dual-scorer, P2) — the canonical algorithm

This document adopts, verbatim, the mechanism already specified in `docs/ux/ux-specification.md UX-25` and `system-architecture.md §3.7`, stated here as the definitive rule for completeness:

1. A `divergence` record exists in state `OPEN` for each mismatched field at a given over.ball (§10.2).
2. Either scorer may **propose** an agreed value for it — this does not apply it; it transitions the record to `PROPOSED`.
3. The **other** scorer must explicitly **confirm** the same proposal — only then does an `EVT-DIVERGENCE-RESOLVED` event get appended to **both** streams, converging both projections to the agreed value (`MINV-14`, `BR-008`).
4. **No divergence is ever resolved by one party's action alone**, by which stream happened to sync first, or by any automatic rule (never "server wins," never "earliest timestamp wins," never "higher run value wins") `[INVARIANT]` — this is the direct, load-bearing consequence of `SYNC-010`'s "never last-write-wins."
5. Sign-off is blocked while any divergence is `OPEN` or `PROPOSED`, overridable only with a reason plus dual attestation from an authorised role (`BR-008`, `UX-25`).

### 11.3 Structural/integrity conflict resolution

A **gap** (§10.3) is resolved automatically and silently from the user's perspective by the retry mechanism itself: because the client's outbox already holds the correct contiguous tail (§10.3's derivation), the very next retry attempt — with no special "gap repair" logic required — is, by construction, the correct resend. No human action is needed for an ordinary gap.

A **hash-chain break** is **not** auto-resolved. It routes to an operational integrity-investigation path (§17.4), not a scorer-facing UI flow — this is a deliberate scope boundary: this document does not define a scorer-facing "resolve a tampering alert" screen, because that is an ops/security incident, not a normal sync outcome.

### 11.4 What resolution never does `[INVARIANT]`

Across every case in §11: no mechanism in this specification ever discards an event that was validly, durably committed on a device without an explicit, attributable human or ops decision to do so, and no mechanism ever silently prefers one device's or one scorer's value over another's. Where a decision must be made, this document names exactly who makes it and requires it to be explicit and recorded.

---

## 12. Reconnection behavior

### 12.1 Detection `[POLICY]`

Connectivity is monitored continuously via the platform's native reachability signal, but that signal **alone never triggers a sync attempt** — a device can be "connected" to a network with no working route to the backend (captive portals, ground Wi-Fi with no uplink). The trigger for an actual sync cycle is a successful, lightweight backend health round-trip. This is the same distinction the UX layer already draws between "offline" and "backend-degraded" (`docs/ux/ux-specification.md §2.4`) — reconnection detection and that UI distinction are two views of the same underlying check.

### 12.2 What happens on confirmed reconnection `[INVARIANT]`

The device **automatically and immediately** triggers a sync cycle (§7.4) for every match with a non-empty outbox or a stale pull cursor — **no user action is required.** A manual "Sync now" control (`UX-24`) remains available as a nudge, but automatic reconnection sync is the primary path, not a fallback.

### 12.3 Scoring is never blocked or paused by reconnection `[INVARIANT]`

The sync cycle triggered by reconnection runs entirely in the background. If the scorer is mid-delivery when connectivity returns, nothing about their input experience changes — no spinner gates the UI, no confirmation is delayed (`OFF-023`). This holds even while a sync cycle is actively pushing/pulling large volumes of catch-up data.

### 12.4 If connectivity drops again mid-cycle

The cycle simply halts at whatever point it had reached. Anything already acknowledged (§7.2) stays acknowledged — there is no rollback of partial progress. The next reconnection resumes exactly where the outbox/cursor state says to resume (§13) — reconnection handling is fully idempotent to being interrupted and retried any number of times.

### 12.5 Reconnection while a fence has been lost

If, on reconnection, the device discovers (via §7.1 step 3's response) that its writer-fence assertion is stale, it does **not** proceed with the rest of its queued push — it halts that stream's sync and immediately surfaces the §11.1 resolution flow, since continuing to push against a fence it no longer holds would itself be the exact silent-overwrite risk this document exists to prevent.

---

## 13. Partial synchronization

### 13.1 Partial sync is a normal, safe, expected state `[INVARIANT]`

A device with some but not all of its outbox acknowledged is not in an error condition — it is in the ordinary, expected state for any device that has been offline for more than the time one sync cycle takes to drain a large backlog. Distinguish this sharply from §14 (**failed** sync), which is specifically about an item that cannot be resolved by simply continuing.

### 13.2 The correctness guarantee `[INVARIANT]`

Because the server only ever accepts a **contiguous prefix** of a stream (§10.3), "partially synced" always and only means *"the first K events made it, the remainder are still queued"* — it can never mean an inconsistent state where a later event was accepted but an earlier one was not. This guarantee holds regardless of how or why the sync was interrupted.

### 13.3 Computing sync progress

`syncedCount` = the position of the server-confirmed watermark within the device's own local commit order. `pendingCount = totalLocallyCommitted − syncedCount`. This is exactly what `UX-24`'s "N of M events synced" display renders, computed identically on every platform.

### 13.4 What a partially synced match's server-side view looks like

The server's projections (`match_snapshots`/`live_state`) reflect **only** what has actually been accepted — a viewer watching a partially-synced match sees a state that is genuinely behind the device's true local state, exactly as far behind as `pendingCount` implies. This is communicated via the existing freshness convention (`UX-20`'s provisional badge, `UX-23`'s "last updated X ago"), not a special partial-sync-specific UI.

### 13.5 Partial sync never blocks sign-off `[INVARIANT]`

Sign-off is a local, offline-capable action (§4.3). A match may be signed off while its outbox is non-empty; the sign-off event itself simply joins the same outbox and syncs like everything else, whenever connectivity allows. This is an explicit, deliberate consequence of the offline-first requirement, stated here so it is never "fixed" by an implementation that mistakenly gates sign-off on sync completion.

---

## 14. Failed synchronization

### 14.1 Definition — distinct from "partial"

A **failed** sync, for a specific item, means a **terminal** rejection (§8.1) — a condition that will not resolve itself by waiting or retrying unmodified. It is a property of one queued item, not of the device's sync state as a whole; the rest of the outbox for *other* streams (other matches, or the other scorer's stream in P2) is entirely unaffected.

### 14.2 Reason taxonomy and its consequence for the queue

| Reason | Class (§8.1) | Blocks items queued behind it in the same stream? |
|---|---|---|
| Network/timeout/5xx/rate-limited | Transient | No permanent block — auto-retried (§8.2); the queue is simply not advancing yet. |
| `STALE_FENCE` (§10.1) | Terminal | **Yes**, until §11.1 is resolved. |
| Sequence gap (§10.3) | Terminal, but self-healing (§11.3) | Briefly, until the next retry — not a lasting block in practice. |
| Hash-chain break (§10.3) | Terminal | **Yes**, until the ops-level investigation (§17.4) resolves it. |
| Domain-validation rejection (`live-scoring.md §5`) | Terminal | **Yes**, until corrected (§14.3). |

### 14.3 Why a single terminal rejection blocks everything behind it — and the fix `[INVARIANT]`

Because the server only accepts a contiguous prefix (§10.3, §13.2), a terminally-rejected event necessarily blocks **every subsequent event in that same stream** from syncing until it is resolved — this is a direct, unavoidable consequence of strict ordering, not an implementation gap. The resolution mechanism is uniform regardless of *why* the original was rejected: **Score Correction** (`live-scoring.md §19`) produces a new, superseding event.

### 14.4 The single correction mechanism, including for a never-yet-accepted event `[INVARIANT]`

There is exactly **one** correction mechanism in this system, used identically whether the event being corrected was already synced-and-accepted or was rejected before ever being accepted: append a new event that supersedes the old one (`MINV-01` — never mutate, not even locally, not even for an event the server has never seen). Concretely:

1. The original (rejected) event remains in the local log, permanently, now marked **superseded** — it is never edited or removed.
2. A new corrected event is appended, referencing `supersedes = <original event_id>`.
3. **Both** are eventually submitted to the server: the original, marked as a historical/superseded-before-acceptance record (so the full history — "scorer entered X, it was rejected, corrected to Y, reason Z" — remains fully auditable server-side too, per `AUD-010`), and the new superseding event, submitted for full normal acceptance.
4. Only the superseding event participates in active projections (`MINV-02`) — the historical record is stored but never active, identically to any other superseded event.
5. Once the superseding event is accepted, the block on everything queued behind it in step 3 (§14.3) lifts automatically, and the rest of the outbox proceeds on the next sync attempt with no separate "resume" action needed.

This means a client implementation never needs special-case logic distinguishing "correcting something already synced" from "correcting something that failed to sync" — both are the exact same Correction operation from `live-scoring.md §19`, and the queue mechanics in this document handle the rest uniformly.

### 14.5 Escalation and visibility

A terminal failure is surfaced immediately and specifically (not merely as a generic "sync failed") on `UX-24`, naming the affected over/ball and the reason in plain language, with a direct link into Score Correction where applicable (§14.4) or into §11.1's fence-resolution flow. It does not wait for a retry-count threshold the way a transient failure's "stuck" indicator does (§8.2) — a terminal failure is definitionally not something retrying will fix, so it is shown at first occurrence.

---

## 15. Device recovery

Four distinct scenarios, with honestly different guarantees — this document does not claim a single blanket "everything always recovers" statement where the physics don't support it.

### 15.1 Process/app crash, force-kill, OS eviction, or reboot — full recovery guaranteed `[INVARIANT]`

Covered entirely by §3.1's durability contract and §3.4's fold-on-load rule: on relaunch, the app reads the local active event log and rebuilds every projection from it, resuming at the exact last durably-committed state. This is the scenario `NFR-009…011` and `SPK-03`'s chaos test target directly, and the guarantee is **zero event loss**, unconditionally, provided local storage itself remains intact.

### 15.2 App reinstall or local data wipe on the same device — bounded loss, honestly stated `[INVARIANT]`

If the app's local storage is deleted, any event that was **never acknowledged by the server** (§2.3) is genuinely, irrecoverably gone from that device — there is no mechanism that reconstructs data from nothing. This document does not overclaim durability beyond what is physically possible. The only recovery paths are: (a) whatever the server had already acknowledged before the wipe, retrievable by signing back in and pulling (§7.3); (b) a local backup file created before the wipe (`FR-149`, `OFR-011`), restorable manually. Neither is automatic; both require the user to have taken a prior action (stayed synced, or exported a backup).

### 15.3 Device loss / continuation on a new device — bounded, precisely stated loss

1. A new device authenticates and pulls the match from the server's **last-synced** state (§7.3) — not from the lost device's unsynced tail, which the server never had.
2. It acquires the writer fence (§7.6), fencing out the lost device's stale lease.
3. Scoring resumes from that point.
4. **Data-loss bound, stated precisely:** the loss is exactly the events that existed only in the lost device's outbox and were never acknowledged before it was lost — no more, no less. This is a materially different, and more honest, guarantee than "zero loss": it is "loss bounded to exactly the unsynced delta at the moment of loss."
5. If the lost device is later recovered and reconnects, its stale outbox is handled exactly as §11.1 describes (a fence conflict, requiring an explicit take-over-or-discard decision) — it is not silently merged back in.

### 15.4 Local storage corruption — verify before trusting `[POLICY]`

On load, **before** folding the log into a projection, the local event log's hash chain is verified for internal continuity (§17.2). If verification fails, the app does **not** proceed to fold and display unverified data — it halts normal operation for the affected match and routes to a recovery flow: pull-from-server if the match has prior sync history, or restore-from-local-backup-file otherwise. Silently continuing on a log that has failed its own integrity check is explicitly disallowed by this specification, even though doing so might "usually be fine" — the whole point of the hash chain (§17) is to never have to make that gamble.

**Disclosure is mandatory, not optional** `[POLICY]` (`RCR-0003`): the recovery flow **must** explicitly disclose the loss bound — the exact point (the last verified-good local state) the device is recovering to — to the scorer, **who must explicitly acknowledge it before scoring resumes**; a passive notification (a toast, a banner) is not sufficient. This uses the same disclosure model §15.2 already applies to an unacknowledged-event loss, and the same acknowledgment-required pattern `live-scoring.md §19`'s Correction model already requires for a mandatory reason — a consequential, potentially-data-losing action is never surfaced ambiently. Silently resuming from a recovered state without this disclosure and acknowledgment is prohibited, matching this document's own §1.1 principle: never discarding a fact silently.

---

## 16. Duplicate prevention

This section is the full surface — idempotency (§9) is the *mechanism* for the sync-layer portion of it; this section states where duplication could arise across the whole system and which mechanism closes each one, so nothing is assumed covered that isn't.

| Where duplication could arise | What prevents it |
|---|---|
| A push retry resends an already-accepted event | `event_id` idempotency at server ingest (§9.1) |
| A pull is retried or a cursor is replayed | `event_id` idempotency applied locally on apply (§9.4) |
| The scorer double-taps a scoring control rapidly | **Not a sync-layer concern** — client-side input debouncing before an `event_id` is even generated, owned by the UI layer (`docs/ux/ux-specification.md UX-11`'s single-tap-commits model); noted here only so the full surface is accounted for. |
| Two independent scorers (P2) both record "over 12.4" | **Not duplication at all** — two distinct `scorer_stream_id`s producing two distinct, individually legitimate `event_id`s is exactly the intended dual-scorer model; conflating this with a technical duplicate would be a category error. This is divergence (§10.2), never deduplicated, always compared. |
| A downstream integration-event consumer (competition recompute, notifications) is redelivered the same event | Server-internal — the transactional outbox's consumers are required to be idempotent, per `system-architecture.md §3.11`; out of this document's device-facing scope, noted for completeness. |
| A correction is submitted twice (e.g. the scorer taps "Save" twice on the correction screen) | The correcting event itself is just another event with its own `event_id`, generated once at commit (§9.1) — the same mechanism, no special case. |

**The one thing this document is careful never to do:** collapse "prevent an accidental technical duplicate" and "prevent two people's independently legitimate records from both existing" into the same mechanism. The first is always closed automatically and silently (idempotency). The second is never closed automatically — it is surfaced (divergence, §10.2–11.2) precisely because both records are real and a human, not a dedup rule, must decide what happened.

---

## 17. Data integrity

### 17.1 The end-to-end guarantee, stated once `[INVARIANT]`

For any match, at any point — fully offline, partially synced, or fully synced — replaying the **active** portion of its event log (local or server copy, they are required to agree once synced) through the shared scoring core deterministically reproduces the exact same reconciled state (`live-scoring.md §20`, `NFR-034`). If it does not, that mismatch is itself a detectable, named reconciliation failure — never a silent divergence a user could miss.

### 17.2 Hash-chain verification works offline too

The tamper-evidence chain (`live-scoring.md §17.3`, `AUD-003`) is a property of the **local** log independent of whether or when it has synced — a purely local, never-synced guest match still has a fully valid, independently verifiable hash chain the moment it's created. Integrity does not begin at the server; it begins at the first event.

### 17.3 The server independently re-verifies — it never trusts a client's assertion `[INVARIANT]`

On ingest (§7.1 step 3), the server recomputes and checks hash-chain continuity against **its own** stored `prevHash` for that stream — it does not accept a client-supplied "this chain is valid" flag as sufficient. This is the concrete mechanism behind `SEC-014`'s "all client input is untrusted" boundary, applied specifically to integrity, not just authorization.

### 17.4 Hash-chain breaks are an operational incident, not a user flow

Distinct from every other conflict/failure category in this document, a hash-chain break routes to the observability/alerting path (`system-architecture.md §3.13`'s "audit chain-verification failure = page") — an on-call operational investigation, because unlike a sequence gap (benign, self-healing) a chain break is also consistent with tampering or serious corruption and must be looked at by a person with the full picture, not resolved by a scorer-facing retry or correction flow.

### 17.5 Honest guarantee summary

| Property | Guaranteed when | Not guaranteed when |
|---|---|---|
| Zero event loss | Local storage remains intact through any crash/kill/reboot/connectivity interruption (§15.1) | Local storage is deleted/wiped with no prior sync or backup (§15.2) |
| Bounded, known loss on device loss | A new device continues from the last server-synced point (§15.3) | Never claimed as "zero" — stated precisely as "exactly the unsynced delta" |
| Tamper evidence | Any post-hoc alteration of a stored event breaks the hash chain and is detected on verification (§17.2–17.3) | Against a privileged actor with simultaneous access to both the primary store and the external anchor point (`system-architecture.md §3.12`) before the next anchor comparison runs — a stated, known limit of hash-chain-plus-periodic-anchoring designs, not claimed away |
| Exactly-once effect | Every event and every queued item, via `event_id`/key-based idempotency (§9) | N/A — unconditional given §9's mechanism |
| No silent conflict resolution | Every value-level (§11.2) and writer-fence (§11.1) conflict, structurally, by this document's design | N/A — this is an architectural guarantee, not a probabilistic one |
| Reconciliation catches any construction violation | Every case this document and `live-scoring.md` define (`INV-001…018`) | A defect outside both documents' defined rules — the reason both exist and are maintained together |

---

## 18. Exactly what happens — the four canonical scenarios

Each walkthrough is a precise, numbered sequence, cross-referencing the rules above rather than restating them.

### 18.1 Offline

1. The device has no working route to the backend (§12.1's health-check fails, or the platform reachability signal is already negative).
2. **Every offline-capable command (§4.3) is fully available and executes immediately and completely against local state** (§4.2) — there is no degraded mode for these; scoring, corrections, undo, pause/resume, sign-off, export, backup, and local search/history all work exactly as they would online.
3. Every resulting event is durably committed locally (§3.1) and enters the outbox in the same transaction (§6.1).
4. The persistent connectivity indicator (`UX-23`) shows "Offline"; the app **may** attempt a bounded, non-blocking background reachability check at a `[DEFAULT]` 30-second interval while a match is actively being scored, solely to detect the moment connectivity returns — this check never delays, blocks, or is a precondition for any scoring input (`OFF-023`).
5. No push or pull attempt is made while offline (there is nothing to attempt against) — the outbox simply grows, unbounded in duration (§6.5); a multi-hour or multi-day fully-offline match is a supported, ordinary case, not an edge case.
6. Commands that are **not** offline-capable (§4.3's second table) — account creation, sending an invitation, publishing a share link, competition recompute, admin actions — are either not offered at all, or (where a queued-intent form exists, §6.2) accepted and queued with a visible "will sync" indication, never silently accepted-and-then-failed.

### 18.2 During reconnection

1. A backend health check succeeds (§12.1) — this is the sole, definitive trigger.
2. A sync cycle begins **automatically**, immediately, with no user action (§12.2), and runs entirely in the background (§12.3); the scorer's input experience is unaffected throughout, even if scoring continues during the cycle.
3. **Push** proceeds in FIFO batches (§7.1) until the outbox is empty or a rejection halts it.
   - Every `ACCEPTED` event advances the local watermark (§6.4, §7.2).
   - A **transient** rejection (§8.1) leaves the remaining outbox untouched and schedules a backoff retry (§8.2) — the cycle for this stream pauses, but connectivity itself hasn't been lost, so the retry timer, not a fresh reconnection, drives the next attempt.
   - A **terminal** rejection (§8.1) halts this stream's push at that point (§14.3) and immediately surfaces the specific failure (§14.5); other matches' or the other scorer's streams are unaffected and continue independently.
4. **Pull** then proceeds for every remote stream this device reads (§7.3), applying events idempotently (§9.4) and refolding projections.
5. **Divergence detection** re-runs now that both directions are current (§7.4 step 4, §10.2) — if it finds new `OPEN` divergences (dual-scorer), they surface on `UX-25`; if none, the "no conflicts" state is shown.
6. The sync-status UI (`UX-24`) updates to reflect the outcome: fully synced (empty outbox, no open divergence), partially synced (§13, some items still queued), or blocked (§14, a specific item needs Correction or fence resolution).
7. If connectivity drops again before the cycle completes, it simply halts (§12.4); the next reconnection resumes from exactly the state the watermarks/cursors describe — the whole sequence is safely re-entrant any number of times.

### 18.3 After synchronization

"After synchronization" means the **full bidirectional cycle** in §18.2 has completed with an empty outbox and current pull cursors for a given match — not merely "I finished pushing."

1. **Server state guarantee:** the server's `match_events` for this device's stream(s) exactly matches this device's active local log, event for event (§2.3, §7.2). Server-side projections (`match_snapshots`/`live_state`) reflect it, subject only to the server's own (near-instant) processing latency.
2. **This device's view of other streams is current too:** any events from another device or scorer that existed at the moment this cycle ran have been pulled and folded in (§7.3–§7.4); anything committed by another party *after* this cycle completed is, correctly, not yet visible — that's the next cycle's job, not a defect of this one.
3. **Nothing about editability changes.** Undo and Correction (`live-scoring.md §18–19`) work exactly as they did before sync — a synced event is corrected by the identical supersede mechanism as an unsynced one (§14.4); sync status never freezes what can be edited. Only match state (`Final`, requiring elevated permission — `BR-006`) and role gate editability, never sync status by itself.
4. **Downstream effects begin, asynchronously, server-side:** if the newly-synced events include a match reaching `Final`, the transactional outbox (`system-architecture.md §3.11`) begins propagating integration events — competition recompute, profile updates, notifications — none of which block or are visible as a further "step" from the device's perspective; from the device's point of view, sync is simply complete.
5. **The local copy is retained**, unchanged in content, per §2.3 and §3.5 — synchronization is a state transition on *ownership/acknowledgment*, never an implicit deletion of the device's own record.

### 18.4 When two devices modify the same match

Two structurally different situations, both real, never conflated (§16's closing point).

**18.4.A — Same scorer, two devices (P1: one logical writer, a device handoff)**

1. Device 1 holds the writer fence and has been scoring offline.
2. Device 2 (same account) opens the match — perhaps because Device 1's battery died, or simply because the scorer switched devices.
3. Device 2 pulls the match's last-**server-synced** state (§15.3 step 1) — it has no knowledge of whatever Device 1 has locally but never sent.
4. Device 2 requests the writer fence (§7.6); the server grants it, invalidating Device 1's lease.
5. Device 2 scores from that point on; every event it commits is fully valid and syncs normally.
6. **If Device 1 returns** (regains power/connectivity) and attempts to push its queued tail: §7.1 step 3 detects the stale fence, rejects with `STALE_FENCE` (§10.1), and the device surfaces exactly the §11.1 choice: take over (which will now itself reveal any genuine overlap with what Device 2 recorded, escalating to human-adjudicated value comparison if so) or discard the stale local tail explicitly.
7. **No automatic merge is ever attempted** between Device 1's orphaned tail and Device 2's accepted events — this is the entire point of the fence mechanism.

**18.4.B — Two different scorers, two streams (P2: dual-scorer reconciliation)**

1. Scorer A and Scorer B each independently score the entire match offline, on their own devices, in their own `scorer_stream_id` — neither writes to or is blocked by the other's stream at any point (§2.1's per-stream ownership).
2. Both eventually sync (§18.2) — each stream's own push/pull proceeds completely independently; there is no fence conflict between A and B, because they were never sharing one stream.
3. Once both streams are present server-side (which may happen at very different times — A might sync mid-match, B only at the end), the divergence-detection pass (§10.2) aligns them by over.ball.
4. Every field that agrees produces no divergence record at all — the common case for the vast majority of a well-scored match.
5. Every field that disagrees produces an `OPEN` divergence (`UX-25`), naming both recorded values.
6. Resolution follows §11.2's propose/confirm algorithm exactly — **neither scorer's value is ever preferred automatically**, not by sync order, not by device, not by timestamp.
7. Sign-off remains blocked (`BR-008`) until every divergence reaches `RESOLVED`, or is explicitly overridden with a reason and dual attestation by an authorised role.
8. Once resolved, both streams' projections converge to the identical agreed state, and reconciliation (`live-scoring.md §20`) passes exactly as it would for a single-scorer match.

---

## 19. Traceability

| This document | Source |
|---|---|
| §2 (ownership), §4 (offline commands) | `OFF-001…013/020/022`, `A-24`, `SEC-016`, `MINV-15`, `MBR-02` |
| §3 (local persistence) | `OFF-003/004/012`, `NFR-009…011`, `SPK-03`, `MBR-07`, `ADR-T06` |
| §5 (local validation) | `live-scoring.md §5`, `SEC-014` |
| §6 (event queue) | `OFF-005/018/019`, `system-architecture.md §3.7` |
| §7 (sync protocol) | `SYNC-001…008`, `NFR-006`, `system-architecture.md §3.7`, `ADR-T09` |
| §8 (retry) | `NFR-014`, `OFF-019` |
| §9 (idempotency) | `SYNC-008`, `system-architecture.md §4.7` |
| §10–§11 (conflict detection/resolution) | `SYNC-009…014`, `MINV-14`, `BR-008`, `docs/ux/ux-specification.md UX-25` |
| §12 (reconnection) | `OFF-021/022/023`, `ONR-001` |
| §13 (partial sync) | `OFF-018`, `UX-24` |
| §14 (failed sync) | `live-scoring.md §19`, `AUD-010`, `BR-006` |
| §15 (device recovery) | `NFR-009…011`, `SPK-03`, `FR-149`, `OFR-011`, `system-architecture.md §3.14` |
| §16 (duplicate prevention) | `SYNC-008`, `system-architecture.md §3.11` |
| §17 (data integrity) | `AUD-003`, `SEC-014`, `live-scoring.md §17/§20`, `system-architecture.md §3.12` |
| §18 (four scenarios) | Synthesis of all of the above |

---

## 20. Open items

| # | Item | Current default | Resolution path |
|---|---|---|---|
| OFQ-1 | Exact `maxBatchSize` (§7.1) and reachability-check interval (§18.1) | 200 events / 30 s — `[DEFAULT]`, chosen to fit `NFR-006`'s 3G budget | Tune against real device-lab measurements before pilot; not a correctness question, purely a performance one |
| OFQ-2 | Whether fence-renewal (§7.6) should shorten automatically during very short, high-frequency scoring bursts vs. the flat 5-minute default | Flat `[DEFAULT]` interval | Revisit if pilot data shows spurious fence loss during continuous active scoring |
| OFQ-3 | Whether a discarded stale tail (§11.1 option 2) should be retained locally forever or subject to its own retention policy | Retained indefinitely, same as §3.5's general policy | Low priority; revisit alongside general local-storage retention tuning |
| OFQ-4 | The exact anchoring cadence and target for external hash-chain-head anchoring (§17.5's stated limitation) | Carried from `system-architecture.md AQ-6`, unresolved there too | Security review, pre-pilot |
| OFQ-5 | Whether the "historical, superseded-before-acceptance" record (§14.4 step 3) needs its own distinct query/export surface, or is sufficient as an inactive entry alongside normal superseded events | Sufficient as-is — no distinct surface planned | Revisit only if an audit/export use case demonstrates a need |

---

## 21. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-21 | Initial offline-first specification. Governing principle (§1) stated once and applied throughout. §2–§6: local data ownership by category (including the guest-match special case), the local durability/write-ordering/recovery-on-load contract, the offline-command classification principle with the explicit "commands execute immediately, only transmission is queued" clarification, the local-vs-server validation distinction, and the outbox structure/ordering/dequeue rules. §7–§9: the push/pull sync protocol as an exact ordered sequence, realtime-as-nudge-never-durability-path, writer-fence acquisition, the transient/terminal retry classification with exponential-backoff parameters, and the idempotency mechanism (including its extension to every queued item type and to the pull direction). §10–§11: three structurally distinct conflict categories (writer-fence, value-level divergence, structural/integrity) each with precise detection timing, and their resolution rules — never automatic, never last-write-wins, with the single correction mechanism (§14.4) used uniformly whether an event was ever accepted or not. §12–§14: reconnection detection and automatic sync triggering, partial synchronization as a normal state with a proven correctness guarantee (contiguous-prefix-only), and failed synchronization's reason taxonomy and blocking consequences. §15: four device-recovery scenarios with honestly differentiated guarantees (full recovery vs. bounded, stated loss). §16: the full duplicate-prevention surface, explicitly distinguishing technical duplicates (always deduplicated) from independently legitimate dual-scorer records (never deduplicated, always compared). §17: the end-to-end integrity guarantee and an honest guarantee-vs-limitation summary table. §18: the four required "exactly what happens" scenarios (offline; during reconnection; after synchronization; two devices modifying the same match, both the single-writer-handoff and dual-scorer sub-cases) as precise numbered walkthroughs. §19 traceability, §20 five open items. No implementation code — a deterministic operational specification. |
| 0.1.0 | 2026-09-23 | `RCR-0003` approved (Gate G3) and applied: §15.4 amended to require the recovery flow explicitly disclose the loss bound and obtain the scorer's explicit acknowledgment before scoring resumes — closing a gap where a literal reading of the prior text permitted silent data loss on corruption recovery, in tension with §1.1's own governing principle. Source finding: `adversarial-verification-report.md AVF-OF-01`. |

