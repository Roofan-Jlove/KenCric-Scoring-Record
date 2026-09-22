# Cricket Scoring Book — Testing Strategy

| | |
|---|---|
| **Document** | Testing Strategy |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-22 |
| **Upstream** | Every prior document — `docs/specs/software-requirements-specification.md`, `docs/specs/cricket-rules-reference.md`, `docs/domain/domain-model.md`, `docs/specs/live-scoring.md`, `docs/architecture/system-architecture.md` (§4.11), `docs/architecture/technology-stack.md` (`ADR-T12`), `docs/architecture/offline-first-specification.md`, `docs/architecture/data-specification.md`, `docs/architecture/api-specification.md`, `docs/architecture/security-specification.md` (§15), `docs/ux/ux-specification.md`, `docs/roadmap/product-roadmap.md` |
| **Downstream** | Actual test-suite authoring, CI pipeline gate configuration (`ADR-T11`), the pilot verification plan |
| **Status** | A **complete testing strategy authored before implementation** — scope, method, coverage targets, and traceability for every test category. **Not test code.** Where a category's tool choice or gate was already decided (`ADR-T12`, `system-architecture.md §4.11`), this document cross-references rather than re-decides; its job is completeness of scope and traceability, not re-litigating tool selection. |

> Written before a single line of application code, as the brief asks. This is possible, and not premature, because the preceding documents already made the system **deterministic by construction** — `live-scoring.md`'s pipeline, `offline-first-specification.md`'s sync protocol, and `data-specification.md`'s schema each specify an exact expected output for a given input, which is precisely what a test needs to assert against. Testing strategy written this early is a direct consequence of specification written this precisely.

---

## 1. Purpose, philosophy, and the determinism principle

### 1.1 Why sixteen categories, not a generic "write tests"

Each category in the brief exercises a genuinely different failure mode this system can have, and conflating them produces false confidence: a suite that only runs unit tests can be 100% green while the sync protocol silently corrupts a match; a suite that only runs UI tests can look perfect while a business rule is subtly wrong. §3–§18 define each category's distinct job so gaps are visible, not hidden behind an aggregate pass rate.

### 1.2 The determinism principle, carried from specification into testing

`live-scoring.md §1.1`'s contract — *same pre-state + same input ⇒ same output, always* — is not only a production-code property. It is what makes a **deterministic test case** possible at all: because the specification fixes one exact correct output for a given input, a test can assert that exact value, not an approximate or "one of several acceptable" one. Every test case in this strategy, wherever the word "deterministic" appears, means precisely this: **one input, one pre-state, one unambiguous expected output, traceable to the rule that fixes it.** This is the direct answer to the brief's closing requirement (§19).

### 1.3 Test-case sourcing policy

Where a prior document already specifies exact expected behavior for a concrete case (`live-scoring.md §21`'s ~55-row case catalogue, `§22`'s 13 worked examples; `offline-first-specification.md §18`'s four scenario walkthroughs; `docs/ux/ux-specification.md §5`'s seven workflows), **that specification is the test case** — this document does not re-author them, it shows how each becomes an executable suite entry and what still needs authoring beyond what's already written.

---

## 2. The test pyramid, adapted

This project's pyramid is not the generic shape — the domain/conformance layer is unusually large and unusually load-bearing, because correctness of cricket-law behavior *is* the product (`OBJ-01`, `OBJ-07`).

```
                        ┌───────────────────┐
                        │   E2E (§14)       │  fewest, slowest, highest confidence per test
                       ┌┴───────────────────┴┐
                       │  UI / Android / Web  │  §11–§13
                      ┌┴──────────────────────┴┐
                      │     Integration (§5)    │  §5–§10: also API, DB, Offline, Sync, Conflict
                     ┌┴─────────────────────────┴┐
                     │   Domain / Conformance      │  §4 — unusually large for this project;
                     │   (the shared scoring core) │  this is where cricket-law correctness lives
                    ┌┴──────────────────────────────┴┐
                    │            Unit (§3)             │  most numerous, fastest, narrowest scope
                    └───────────────────────────────────┘

   Cross-cutting, applied at every applicable layer above, not a layer of their own:
   Security (§15) · Performance (§16) · Accessibility (§17) · Regression (§18)
```

| Layer | What it proves | Isolation | Relative volume | Relative speed |
|---|---|---|---|---|
| Unit | One function/class is correct in isolation | Mocked dependencies | Highest | Fastest |
| Domain/Conformance | The shared scoring core is correct end-to-end, and identical across platforms | Pure — no I/O, no network, no real storage | Very high (mirrors `live-scoring.md`'s ~55+13 cases plus property-based generation) | Fast |
| Integration | Two or more real components (core + real local DB, Edge Function + real test Postgres) work together | Real I/O against test infrastructure | Moderate | Moderate |
| API / DB / Offline / Sync / Conflict | The system's distinctive cross-cutting guarantees hold under realistic conditions | Real backend/device conditions, simulated adversity | Moderate | Slower |
| UI / Android / Web | Each screen behaves exactly as `docs/ux/ux-specification.md` specifies | Component/screen level, mocked backend | Moderate | Moderate |
| E2E | A whole user journey, across real (or realistic) systems, works | Full stack | Lowest | Slowest |

**Coverage-percentage caveat, stated once:** a line/branch coverage number is a floor, never a proxy for quality — the domain/conformance suite's *behavioral* completeness against `cricket-rules-reference.md` matters more than any coverage percentage, and §19 measures that directly rather than by proxy.

---

## 3. Unit tests

**Scope:** one function, method, or small class, in isolation, with every dependency mocked or stubbed — never real I/O, never the full delivery-processing pipeline (that's §4). The boundary is precise: if a test needs more than one collaborating rule from `live-scoring.md` to make sense, it belongs in §4, not here.

**What's tested:** individual formulas and pure helpers inside the shared scoring core (the `RunEvent` aggregation formulas — `batterRuns`/`bowlerRunsCharged`/`ranRuns`, §7.2 — tested standalone with hand-picked `RunEvent` lists; the strike-rotation parity formula, §14.2, tested as a pure function of `(ranRuns, isOverFinalBall)` pairs covering all four boolean combinations; each of the 11 validation rules V1–V11, §5, tested independently); client-side utilities outside the core (date/timezone formatting per the match timezone, `NFR-059`; input debouncing logic, §16 of the UX spec); backend Edge Function helper logic (canonicalisation/hashing helpers, §17 of `live-scoring.md`, tested against known input→hash pairs).

**Tools:** Kotest/JUnit5 (core, Android), Vitest (web) — per `technology-stack.md ADR-T12`.

**Coverage target:** `[DEFAULT]` 85% line coverage on core pure-function modules specifically (not the whole codebase) — a floor, per §2's caveat, not the quality bar itself.

**Representative cases:**

| Unit under test | Example assertion |
|---|---|
| `RunEvent` aggregation (§7.2 of `live-scoring.md`) | Given `[NBP:1:A, NBB:4:B]`, `batterRuns=4`, `bowlerRunsCharged=5`, `ranRuns=0` |
| Strike-parity formula (§14.2) | `netRotates(ranRuns=1, isOverFinal=true) = false`; `netRotates(ranRuns=0, isOverFinal=true) = true` |
| Short-run deduction (§8) | Given `ranRuns=2, shortRuns=1`, `effectiveRanRuns=1` |
| Dismissal bowler-credit lookup (§9.4) | `creditsBowler(RUN_OUT)=false`; `creditsBowler(HIT_WICKET)=true` |
| Canonical hash function (`live-scoring.md §17.3`) | A fixed event, canonicalised and hashed twice, produces the identical hash both times, on both platform builds |

## 4. Domain tests (the conformance suite)

This is the project's most distinctive and highest-value layer — where cricket-law correctness and cross-platform parity are actually proven, not assumed.

### 4.1 What's tested and how

**Scope:** the shared scoring core's full delivery-processing pipeline (`live-scoring.md §5–§15`), exercised end-to-end with **no I/O** — pure input (a `DeliveryInput` or command) plus pre-state in, a fully-computed output across every dimension (score calculation, batter/bowler/team/over/wicket/strike state, event payload) out.

**Four complementary techniques, all required, none sufficient alone:**

| Technique | What it catches | Source |
|---|---|---|
| **Fixed case catalogue** | The specific, named, hand-verified scenarios — including every deliberately tricky one | `live-scoring.md §21`'s ~55 rows (`C01…C55`), used **verbatim** as test fixtures, not re-derived |
| **Worked-example replay** | The same cases, replayed through all thirteen dimensions in one assertion, catching a regression that breaks the *interaction* between dimensions even if each passes individually | `live-scoring.md §22`'s 13 worked examples (`EX-01…EX-13`) |
| **Property-based generation** | Combinatorial cases no fixed list can be exhaustive over — random *legal* command sequences (respecting §5's validation rules), asserting `INV-001…018`/`MINV-*` hold after every single step | Generated per-build; shrinks a failing sequence to a minimal reproducing case automatically |
| **Golden-file full-match replay** | A regression in how many small-correct pieces *compose* over a whole innings — a complete match's event log replayed and diffed byte-for-byte against a previously-approved scorecard snapshot | Synthetic matches authored to cover every format (`T20`/`ODI`/`T10`/`The Hundred`), plus (once available) real anonymised Cricsheet-derived matches (`SPK-05`) |

### 4.2 Cross-platform parity — the second job of this same suite

**The identical corpus (fixed cases + golden files) runs against both the JVM and the JS/wasm build of the shared core** (`ADR-T01`), and the two results are diffed field-for-field. This is not a separate suite — it is the same domain tests, run twice, which is precisely what makes parity checkable rather than merely claimed (`NFR-047/048`, `technology-stack.md ADR-T01`'s confirmation criterion). CI publishes the resulting **parity-matrix score** as a tracked metric.

### 4.3 Entry/exit criteria

| Gate | Threshold |
|---|---|
| Conformance-suite pass rate | **100% required to release** (`NFR-053`) — this is not a target, it is a hard release gate |
| Cross-platform parity matrix | ≥ 95% at each release, target 100% on the scoring core specifically (`NFR-047/048`) |
| Every `[LAW]`-tagged rule in `cricket-rules-reference.md` | Reviewed by an accredited scorer against its corresponding test case(s) before the pilot gate (`docs/README.md` Status; `docs/roadmap/product-roadmap.md §4.1` Alpha entry gate) |
| A confirmed real-world edge case not yet in the corpus | Adds a `CSR-*`/`DR-*` entry **and** a conformance-suite case **before** the corresponding fix ships (`docs/roadmap/product-roadmap.md §4.4`'s feedback-loop rule, restated here as a testing-process requirement) |

### 4.4 What is deliberately **not** in this suite

Anything requiring real storage, real network, real UI, or wall-clock timing does not belong here — that discipline is what keeps this suite fast enough to run on every commit (`ADR-T11`'s PR gate). Those concerns are §5–§18's job.

---

## 5. Integration tests

**Scope:** two or more real components together, against real (test-environment) infrastructure — never mocked storage or a mocked database — but still short of a full running application (that's §14).

**What's tested:**

| Integration point | Representative case |
|---|---|
| Shared core ↔ real local persistence | Record 10 deliveries via the real local SQLite/IndexedDB store, kill and restart the test process, assert the fold-on-load recovery (`offline-first-specification.md §3.4`) reproduces the exact pre-kill state |
| Edge Function ↔ real test Postgres with RLS enabled | Push a batch as a non-scorer role, assert refusal at the RLS layer, not merely at application logic (proves `data-specification.md §6.1`'s grant-level enforcement, not just the Edge Function's own checks) |
| Sign-off command ↔ reconciliation | Sign off a seeded match with a deliberately broken invariant, assert `422 reconciliation/blocked` (`api-specification.md §11.1`) naming the specific failing `INV-*` |
| Outbox ↔ downstream consumer | A `MatchFinalised` integration event is written to the outbox in the same transaction as sign-off acceptance; the dispatcher delivers it exactly once to a test consumer even under simulated redelivery (`ADR-09`) |
| Correction ↔ cascade | A mid-match correction is applied against a real, multi-delivery local log; assert the full downstream refold (strike, projections) matches `live-scoring.md §22.12`'s worked example exactly |

**Tools:** the same unit-test frameworks, pointed at real test-scoped infrastructure (an ephemeral Supabase project/branch, a real on-device or emulator SQLite instance) rather than mocks.

## 6. API tests

**Scope:** every endpoint in `api-specification.md`, validated against its own documented contract — this is a contract-conformance suite, not a re-test of business logic already covered in §4/§5.

**What's tested:**

| Concern | Approach |
|---|---|
| Request/response schema conformance | Every endpoint's request and response validated against its JSON Schema (once authored, `system-architecture.md §4.7/4.8`); a schema drift between this document and the implementation fails CI |
| Status codes and error shape | Every documented error code in `api-specification.md §5.2` has at least one test that provokes it and asserts the exact RFC 7807 shape |
| Auth × Authz matrix | Every endpoint tested against every relevant role from `security-specification.md §4.2`'s permission matrix, asserting the correct `200`/`401`/`403` for each — a systematic cross-product, not spot checks |
| Idempotency | Resubmitting an identical `event_id` or `Idempotency-Key` returns the identical prior result with no duplicate side effect (`api-specification.md §8.2`) |
| Pagination & filtering | Keyset cursors advance correctly and exhaust cleanly; every documented filter operator (`api-specification.md §7`) is exercised at least once |
| Versioning/deprecation | A request against a deprecated contract version returns the `Deprecation`/`Sunset` headers (`api-specification.md §9.2`) |

**Tools:** contract tests run against the OpenAPI/JSON-Schema definitions as the source of truth once authored; the auth×authz matrix is generated programmatically from `security-specification.md §4.2`'s table rather than hand-enumerated, so a new role or endpoint automatically extends the matrix.

## 7. Database tests

**Scope:** the schema itself (`data-specification.md`), independent of any application code sitting above it.

**What's tested:**

| Concern | Approach | Tool |
|---|---|---|
| RLS policy matrix | Every table, every role, every operation (read/insert/update/delete) — asserts no row is reachable outside the actor's authorized scope | **pgTAP**, every migration, CI-blocking (`security-specification.md SR-B01`) |
| Append-only enforcement | An `UPDATE`/`DELETE` attempt against `match_events`/`audit_log`, from **every** role including platform-admin, is refused at the grant level | pgTAP |
| Constraints | Every `CK`/`UQ`/`FK` in `data-specification.md` rejects the specific invalid case it exists to catch (e.g. `wicket.mode = CAUGHT` with non-empty `RunEvent`s, `CK` on `delivery_run_events`) | pgTAP |
| Migrations | Every migration applies cleanly, forward-only, against a prod-like snapshot, and does not corrupt or lose existing data | `ADR-T11`'s migration-dry-run CI step |
| Partitioning behavior | A `match_events` write lands in the expected partition; a query scoped to one match touches only the expected partition(s) | Integration-level, run less frequently than the PR gate |
| Soft-deletion policy | A `DELETE` call against a policy-2 resource (`data-specification.md §1.7`) performs the correct soft-deactivate/merge, never a row removal; a policy-3 resource genuinely hard-deletes | pgTAP + integration |

---

## 8. Offline tests

**Scope:** the system's core promise — a complete match, scored with zero connectivity, with zero event loss, under adversity.

### 8.1 The flagship: offline chaos test

**What:** force-kill, battery pull, OS eviction, and airplane-mode toggling, injected at random points across **≥ 50 simulated innings** on target-tier Android hardware (`NFR-009`, `SPK-03`).
**Pass condition:** **zero ball-events lost**, across every run, with every recovered match state matching what a clean, uninterrupted run of the identical input would have produced (i.e. checked against the deterministic domain-test corpus, §4, not just "didn't crash").
**Execution:** device lab (Firebase Test Lab or an on-prem target-tier set, `ADR-T12`), scheduled and pre-pilot-gating (`docs/roadmap/product-roadmap.md §4.1`).

### 8.2 Other offline coverage

| Concern | Test | Trace |
|---|---|---|
| Local-vs-server validation boundary | A command accepted by local validation but later rejected server-side (a fence conflict this device couldn't have known about) is handled per `offline-first-specification.md §5.1`'s stated distinction, never treated as a client bug | `SR-G01` |
| Outbox durability | Every committed event is provably in the outbox in the same transaction as its own durable commit (`offline-first-specification.md §6.1`) — no window where an event exists in the log but not the outbox, or vice versa | `OFF-005/006` |
| Storage-quota warning | Local storage approaching its limit triggers the warning and one-tap purge flow (`OFF-016`) before write failures could occur | `docs/ux/ux-specification.md UX-27` |
| Local backup round-trip | A backup file created offline, restored on a second offline device, reproduces the match identically, including unsynced events (`FR-149`) | `OFR-011` |
| "Never blocks a scoring input on the network" | A simulated network stall (not a timeout, an indefinite stall) during active scoring produces no measurable input-latency change versus fully-offline (`OFF-023`) | — |
| Never-connectivity full match | A complete match — setup through sign-off through export — scored entirely in airplane mode, no network call attempted anywhere in the path | `OFF-001/002/018`; `offline-first-specification.md §18.1` |

## 9. Sync tests

**Scope:** the push/pull protocol's own correctness guarantees (`offline-first-specification.md §7–§9`, `api-specification.md §12`) — distinct from Conflict tests (§10), which specifically target the human-adjudicated resolution paths.

### 9.1 The flagship: sync convergence

**What:** a fixed multi-device event set for one match, delivered to the backend in a large number of randomised arrival orders (batches split, reordered, interleaved).
**Pass condition:** **every** arrival order produces an identical merged projection (`NFR-016`, `SYNC-009`) — the deterministic total order (`offline-first-specification.md §7`'s ordinal → HLC → device-seq) is what this test exists to prove holds under real-world arbitrary arrival.
**Cadence:** CI (a bounded number of orderings, fast) plus a larger nightly/staging run (many more orderings).

### 9.2 Other sync coverage

| Concern | Test |
|---|---|
| Idempotency under retry | The identical batch, resubmitted after a simulated network failure mid-response, produces no duplicate `match_events` rows and the identical `results` array both times (`offline-first-specification.md §9`) |
| Contiguous-prefix acceptance | A batch with events `[N, N+1, N+2]` where `N+1` is terminally invalid: `N` is accepted, `N+1`/`N+2` are not, and the client's next retry correctly resumes from `N+1` with no gap-repair logic needed (§10.3/§14.3 self-healing property) |
| Sequence-gap detection and self-healing | A genuinely corrupted/out-of-order batch is rejected with `sync/sequence-gap`, and — because the outbox never advances past an unacknowledged item by construction (§6.4 of `offline-first-specification.md`) — the very next ordinary retry, with no special repair code, succeeds |
| Hash-chain break | A batch with a `prevHash` mismatch is rejected with `sync/hash-chain-break`, and this specifically (not a gap) triggers the audit-integrity alert path (§11 of `security-specification.md`) |
| Writer-fence acquire/renew/staleness | Acquiring a fence invalidates a prior holder's lease; that prior holder's next push is rejected with `sync/stale-fence`; a renewed-in-time fence never spuriously expires mid-active-scoring |
| Realtime is advisory only | Sync correctness (assessed via §9.1) is unaffected when the realtime channel is entirely disabled — proving it is a nudge, never the durability path (`offline-first-specification.md §7.5`) |
| Partial sync correctness | An interrupted sync leaves the outbox in a state where `syncedCount`/`pendingCount` (`offline-first-specification.md §13.3`) exactly matches the true server-accepted prefix, with no drift |

## 10. Conflict tests

**Scope:** the human-adjudicated resolution paths specifically — writer-fence handoff and dual-scorer divergence — where sync tests (§9) prove the mechanics and these prove the **policy** (never silent, never automatic).

| Scenario | Assertion |
|---|---|
| Fence conflict, take-over path | The fenced-out device's rejected events remain fully present in its local log (never discarded); taking over re-acquires the fence; if the *other* device had genuinely also scored past the divergence point, the take-over escalates to a value-level conflict rather than silently overwriting (`offline-first-specification.md §11.1`, `§18.4.A`) |
| Fence conflict, discard path | An explicit, confirmed discard marks the stale tail abandoned but never deletes it from local storage |
| Divergence detection | Two seeded, deliberately different scorer streams for the identical over.ball always surface an `OPEN` divergence — **never** silently merged, regardless of which stream synced first (`FR-116…119`, `MINV-14`) |
| Propose/confirm resolution | A proposal from Scorer A alone does **not** apply; only Scorer B's distinct confirmation converges both streams (`BR-008`); a proposal confirmed by the **same** user who proposed it is rejected (`data-specification.md §8.5`'s `CK confirmed_by IS DISTINCT FROM proposed_by`) |
| Sign-off gate | Sign-off is blocked while any divergence is `OPEN`/`PROPOSED`; an override requires a reason **and** dual attestation, never a single scorer's override alone (`BR-008`) |
| No automatic preference, ever | Across every case above, no test asserts (or should ever pass if it asserted) that "server wins," "earliest wins," or "higher value wins" — the suite explicitly includes a negative test confirming these outcomes are **not** what happens |

---

## 11. UI tests

**Scope:** shared principles applied by both §12 and §13 — stated once here rather than duplicated per platform.

**One suite per screen.** Every one of the 28 screens in `docs/ux/ux-specification.md §4` gets its own test suite, named after its `UX-##` id, asserting exactly the nine dimensions that screen's spec defines: **Purpose** (the primary action is reachable and does what's documented), **Inputs** (every field accepts valid values and rejects invalid ones per its stated validation), **Actions** (each documented action fires the correct effect), **Validation** (every inline/blocking rule from the screen's spec), **States** (every state in `docs/ux/ux-specification.md §2.1`'s canonical model that screen instantiates — Loading/Empty/Populated/Error/Offline/Guardrail-blocked/Destructive-confirm/Read-only — is independently reachable and renders correctly), **Error handling** (§2.2's conventions), **Empty states** (§2.3's conventions), **Offline behavior** (exactly as that screen's spec states — not merely "works offline" but the *specific* offline behavior, e.g. UX-05's local-only setup vs. UX-02's registration-requires-connectivity), **Accessibility** (the baseline, §2.7, plus that screen's own additions).

**Component-level tests** (below full-screen) cover shared components once (the run-entry pad, the guardrail-override modal pattern, the connectivity indicator) rather than re-testing them inside every screen that uses them.

## 12. Android tests

**Tools:** JUnit5 + Turbine (ViewModel/Flow unit tests, MVI state-reducer correctness) · Compose UI tests (screen-level, per §11's one-suite-per-screen rule) · instrumented tests on real target-tier devices via Firebase Test Lab (`ADR-T12`).

**Android-specific coverage beyond §11's shared model:**

| Concern | Test |
|---|---|
| One-handed thumb-zone reach | Primary scoring controls fall within the documented reach envelope on the largest supported phone size (`NFR-020`) |
| Touch-target size, glove-usable | Every primary scoring control meets the minimum target size (`NFR-021`) |
| TalkBack | Every control's accessible label and live-region behaviour matches `docs/ux/ux-specification.md §2.7`'s baseline, verified with TalkBack enabled on-device, not only via semantic-tree assertions |
| Lifecycle survival | Backgrounding, an incoming call, a notification, and a screen lock during active scoring each preserve exact state on return (`AND-007`) |
| WorkManager sync scheduling | Background sync fires on the documented constraints (connectivity regained, battery not critically low) and survives an app restart mid-retry |
| Play distribution integrity | A release artefact is signed and delivered only through the Play Console pipeline (`SR-F05`) |

## 13. Web tests

**Tools:** Vitest + React Testing Library (component tests) · Playwright (e2e, offline/service-worker simulation, keyboard-navigation) · axe-core (accessibility, integrated into Playwright runs).

**Web-specific coverage beyond §11's shared model:**

| Concern | Test |
|---|---|
| PWA installability | The app meets install-ability criteria (manifest, service worker registered) and installs cleanly on a fresh profile |
| Offline-after-first-load | The app shell and last-cached data render with the network disabled in the test harness, after one successful prior load (`NFR-046`) |
| Service-worker update flow | A new deployed version prompts the "reload to update" flow rather than silently swapping under an active session |
| Keyboard-complete | Every core scoring action is reachable and operable with no pointer device at all, following the documented tab order (`WEB-003`) |
| Multi-tab writer coordination | Two tabs open on the same match: only one holds the writer role at a time, coordinated via the documented `BroadcastChannel`/lock mechanism (`docs/architecture/api-specification.md §4.3`'s note) |
| Print stylesheet | The scorecard and linear sheet print outputs are legible and complete (`WEB-005`) |

## 14. End-to-end tests

**Scope:** a full user journey across real (or realistically simulated) systems — the fewest, slowest tests, each proving something no lower layer can prove alone: that the *composition* of correct pieces is itself correct.

**Source of scenarios — not invented here, sourced from already-specified workflows:**

| E2E suite | Source | What it proves beyond its component tests |
|---|---|---|
| First offline match (guest) | `docs/ux/ux-specification.md §5` W-1 | The whole offline path, screen to screen, with zero network calls anywhere |
| Full-season sync workflow | W-2 | Score offline → reconnect → sync → sign-off → server materialisation, as one continuous flow |
| Rain interruption / reduced overs | W-3 | Pause → resume → target adjustment → live-panel reflects it correctly |
| Mid-innings correction | W-4 | A correction's cascade is visible and correct across every downstream screen, not just the corrected delivery |
| Dual-scorer reconciliation *(P2)* | W-5 | Two independent devices, two streams, divergence detection and resolution, end to end |
| Org onboarding and role assignment | W-6 | Invite → accept → role takes effect, across the identity/auth boundary |
| Multi-device handoff | W-7; also `offline-first-specification.md §18.4.A` | The fence-conflict take-over flow, end to end, on two real devices |
| Four "exactly what happens" scenarios | `offline-first-specification.md §18.1–18.4` | Offline, reconnection, post-sync, and two-devices-same-match, each as its own E2E suite, directly against that document's numbered steps |

**Execution:** Playwright (web), instrumented Espresso/Compose tests (Android) — the *scenario* is defined once, platform-agnostically, and implemented per platform, since the shared core is what guarantees the two implementations should produce identical outcomes (parity is §4.2's job to prove at the domain level; E2E here is about the *user-facing* journey, not re-proving core parity).

---

## 15. Security tests

**Scope:** the 76 `SR-XXX` requirements in `security-specification.md` — this section is this document's pointer into that one's own §15 (already a verification table), not a duplicate of it.

| Verification | Covers | Cadence |
|---|---|---|
| RLS policy matrix (pgTAP) | `SR-B01/B02/B05` | Every migration, CI-blocking (also §7 of this document) |
| Static secret/key scan | `SR-D07`, `SR-E06` | Every build, CI-blocking |
| Auth × authz matrix | Every endpoint × every role | Part of §6's API test suite, generated from `security-specification.md §4.2` |
| Token-handling review | `SR-D01…D07` | Pre-pilot, and on every auth-flow change |
| Rate-limit / abuse simulation | `SR-H01…H05` | Pre-beta, pre-GA |
| Audit-chain verification | `SR-I03` | Scheduled, continuous, plus a deliberately-induced-break test in staging |
| Penetration test (RLS, auth, session, API) | §3–§4, §9 of `security-specification.md` | Pre-pilot, pre-GA, and on any auth/permission-model change |
| Incident-response tabletop | `SR-L05` | Pre-GA, then annually |

**Full detail — thresholds, tools, exact scope of each — lives in `security-specification.md §15`; this document does not restate it a second time with a risk of drifting out of sync.**

## 16. Performance tests

**Scope:** the numeric budgets in `software-requirements-specification.md §7.1` and the sync/availability budgets in §7.2/§7.3.

| Budget | Target | Measured how |
|---|---|---|
| Input acknowledgement latency | ≤ 100 ms p95 (`NFR-002`) | On target-tier Android hardware, device lab, every build |
| Interactions per normal delivery | ≤ 2 (`NFR-001`) | Instrumented UI test counting taps for a representative delivery set |
| Cold start to ready-to-score | ≤ 3 s (`NFR-005`) | Device lab, target-tier hardware |
| Scorecard/chart render | ≤ 1 s for a completed T20 (`NFR-004`) | Device lab and desktop-class hardware for web |
| Full offline T20 sync | ≤ 30 s p95 on a 3G-class connection (`NFR-006`) | Simulated 3G-class network conditions, staging environment |
| Battery, full day's intermittent scoring | ≥ 8 h on a mid-range phone (`NFR-007`) | Device lab, extended-duration run |
| Concurrent live matches + viewer fan-out | Target set in planning (`NFR-016`), graceful polling degradation beyond it (`NFR-021`) | **k6** load tests (`ADR-T12`), pre-beta and pre-GA |
| Availability | ≥ 99.5% monthly (`NFR-013`) | Production monitoring, not a pre-release test — tracked continuously post-launch |
| DLS numeric accuracy vs. reference | Within published rounding tolerance across a fixed benchmark scenario set | The DLS benchmark job — an **accuracy**, not speed, test; catalogued under Domain tests (§4) since it is a correctness property of the core, run on every DLS-affecting change |

**Execution note:** every device-lab performance measurement runs on the same target-tier hardware profile defined for the offline chaos test (§8.1) — one hardware baseline, reused, so results are comparable across suites.

## 17. Accessibility tests

**Scope:** `NFR-019/037…045`, `docs/ux/ux-specification.md §2.7`'s baseline plus every screen's own additions.

| Check | Method |
|---|---|
| WCAG 2.2 AA (contrast, focus visibility, target size) | Automated **axe-core** scan on every web screen, integrated into the Playwright suite (§13), on every PR |
| Screen-reader completeness | Manual pass with TalkBack (Android, §12) and a desktop screen reader (web) on core flows, pre-pilot and pre-GA — automated tools catch structural issues, not narration quality, so a manual pass is retained deliberately |
| Keyboard-complete (web) | Automated tab-order and no-pointer-required assertions (§13) |
| Touch-target size and glove-usability (Android) | §12 |
| Focus management | Modal focus-trap-and-return, error-summary-moves-focus, and disclosure-pattern `aria-expanded` correctness — per screen, per `docs/ux/ux-specification.md §2.7`'s rules |
| Sunlight/high-contrast/large-text mode | Every screen renders correctly under each toggle, verified live rather than requiring an app restart (`docs/ux/ux-specification.md UX-27`) |
| Never color-alone | A specific, repeatable check per screen: every state-conveying color has an accompanying icon or text label |

**Gate:** zero blocking WCAG 2.2 AA issues on core flows is a pre-pilot and pre-GA release gate (`docs/roadmap/product-roadmap.md §6.2` `AC-V1-07`).

## 18. Regression tests

**Policy, not a new test-writing activity.** Regression coverage **is** the accumulated Unit/Domain/Integration/API/DB/Offline/Sync/Conflict/UI/E2E suites, re-run on every change (`ADR-T11`'s CI pipeline) — this section states the *policy* governing how that accumulation stays trustworthy, not a seventeenth thing to separately author.

| Policy | Statement |
|---|---|
| **Bug-fix-adds-a-test, always** | Any confirmed production defect is reproduced as a failing test **before** the fix is written, and that test remains in the suite permanently — restated directly from `docs/roadmap/product-roadmap.md §4.4`'s feedback-loop rule, now made a binding testing-process requirement |
| **Confirmed edge case → conformance-suite case, before the fix ships** | Identical rule, specific to cricket-domain edge cases (§4.3's exit criteria) |
| **Visual regression (UI)** | `[POLICY]` — screenshot/visual-diff testing is available and recommended for the highest-traffic screens (Live Scoring, Scorecard) but not mandated for all 28; a functional UI-test failure (§11) is the mandatory gate, visual diffing is a supplementary signal |
| **Parity-matrix regression** | A drop in the cross-platform parity-matrix score (§4.2) between releases is itself treated as a regression requiring investigation, even if every individual test still passes — a slow drift is exactly what an aggregate metric like this exists to catch |
| **No test is ever deleted to make a suite pass** | A previously-passing test that starts failing is either a genuine regression (fix the code) or the specification changed (update the spec document first, then the test, with the change traceable to the updated `FR-`/`DR-`/etc. entry) — never silently removed |

---

## 19. Every critical cricket rule has deterministic test cases

### 19.1 Defining "critical" precisely

Not every one of `cricket-rules-reference.md`'s ~640 classified rules carries equal weight, and treating them as uniformly "critical" would dilute the term. This document defines **critical** as:

- **Every `[LAW]`-tagged rule** — directly from the MCC Laws/ICC Standard Playing Conditions; getting one wrong is a Law-accuracy failure, the product's core promise (`OBJ-01`).
- **Every invariant** — `INV-001…018` (`cricket-rules-reference.md §34`) and `MINV-01…18` (`docs/domain/domain-model.md §7`) — these are the properties that make the whole record trustworthy, not one scenario among many.
- **Every dismissal-mode-validity and bowler-credit rule** (`live-scoring.md §9.1/§9.4`) — the single densest source of real-world scorer error this specification exists to prevent.

`[PRD]`/`[CFG]`/`[EDGE]`-tagged rules are **important** and still require coverage (§19.3), but are not held to the same "must have a deterministic, individually-traceable test case" bar as the `[LAW]`+invariant set — a configuration default or a genuinely rare edge case is covered by the general test, not necessarily its own named case.

### 19.2 Determinism, restated as a testable property

Every critical-rule test case **shall**: (1) state one exact pre-state, (2) state one exact input, (3) assert one exact, unambiguous expected output across every affected dimension of `live-scoring.md`'s thirteen (§0 of this document), (4) cite the specific rule id(s) it verifies. A test that asserts "the result is reasonable" or "one of several acceptable outcomes" does not satisfy this section, by definition — `live-scoring.md`'s entire design (the `RunEvent` model, the dismissal-validity matrix, the strike-parity formula) exists precisely to make this level of precision achievable.

### 19.3 Coverage by cricket-rules-reference area — what's done, what's planned

| `cricket-rules-reference.md` area | Critical? | Covered by `live-scoring.md §21/§22` today | Gap / plan |
|---|---|---|---|
| `FMT` Formats, `TEAM`, `PLYR`, `OFCL` | Partial (`[LAW]` on XI/role validity) | Indirectly, via pre-state assumptions | Covered by `data-specification.md`'s `CK` constraints + §7 DB tests, not a domain-test concern |
| `STATE` Match lifecycle | Yes | `SM-MATCH` transitions covered by integration tests (§5), not domain-test case catalogue | Add a state-machine transition table as its own fixed-case suite before Version 1 implementation begins |
| `INN` Innings, `OVER` Overs, `BALL` Deliveries | **Yes — core** | **Fully** — §6/§13 of `live-scoring.md`, `C01…C12` | Done |
| `RUN`, `STRK`, `EXT`, `NB`, `WD`, `BYE`, `LB`, `PEN` | **Yes — core** | **Fully** — §7–§8, `C13…C30` | Done |
| `FH` Free hit | **Yes** | **Fully** — §13.4, `C46…C49` | Done |
| `WKT` general + all 12 dismissal sub-areas | **Yes — the densest area** | **Fully** — §9, `C31…C45` | Done |
| `BOWL`, `BAT`, `PART` figures | **Yes** | **Fully** — §10–§11, folded into every case's Batter/Bowler-state assertion | Done |
| `PP` Powerplays | Partial (`[CFG]`-heavy) | Indirectly (config-driven, not a distinct case set) | Add a powerplay-repartition-after-reduction case set alongside the reduced-overs feature |
| `DRS` Reviews | No (P2, not yet detailed) | Not covered | Author when P2 review-workflow implementation begins, following the same method (general rules + case catalogue + worked examples) |
| `DECL`/`FLW` Declarations/Follow-on | No (P3, multi-day, deferred) | Not covered | Deferred with the feature itself (`docs/roadmap/product-roadmap.md` Future); author its own domain-test pass when that work begins — explicitly must **not** retrofit into the P1/P2 case catalogue, per `live-scoring.md §13.5`'s isolation principle |
| `RES` Results, `TGT` Target | **Yes** | **Fully** — §15, folded into innings-end assertions | Done |
| `DLS` | **Yes, once unblocked** | **Not covered** — correctly deferred pending `SPK-01` | A dedicated DLS case catalogue (fixed rain scenarios vs. published reference outputs, the "DLS benchmark") must be authored **before** `FR-083…089` implementation begins, using this same method |
| `SO` Super Over | **Yes** | **Partially** — the per-delivery pipeline is identical (reuses `C01…C45`); container-level rules (2-wicket cap ends the mini-innings, stats isolation `MINV-12`) need 2–3 dedicated cases | Small, bounded gap — add before Super Over implementation |
| `SCRD` Scorecard content | Partial | Covered via golden-file full-match replay (§4.1) | Done |
| `CMTRY` Commentary | No | N/A — not a determinism concern (free text) | — |
| `CORR` Corrections | **Yes** | **Fully** — §18–19 of `live-scoring.md`, `EX-12/EX-13` | Done |
| `CFG-REG` Configuration registry | Partial | Every `[CFG]` default has at least one case exercising it; **not** every possible value combination | Property-based generation (§4.1) is the intended mechanism for combinatorial `[CFG]` coverage, not an exhaustive fixed list |

### 19.4 The honest summary

Every `[LAW]`-tagged rule and every invariant governing the **P1 core scoring path** (deliveries, extras, wickets, strike, overs, innings, results, corrections) has a deterministic test case **today**, inherited directly from `live-scoring.md`. The areas without coverage yet (`DLS`, `DRS`, multi-day) are precisely the areas this project has **already, deliberately, and visibly** deferred (`SPK-01`, `docs/roadmap/product-roadmap.md`'s P2/P3 buckets) — this table exists so that deferral is a stated, tracked fact, never a silent gap discovered during implementation.

---

## 20. Test environments and data strategy

| Environment | Purpose | Data |
|---|---|---|
| **Local/CI ephemeral** | Unit, Domain, Integration, DB, API tests on every PR | Synthetic fixtures only; no production-shaped data ever |
| **Preview (per-PR)** | E2E smoke subset, manual exploratory testing | A seeded synthetic dataset covering every match state (in-progress, Final, disputed, guest) |
| **Staging** | Full nightly suite: chaos, convergence, load, DLS benchmark, larger property-based runs | Synthetic + anonymised Cricsheet-derived matches (once `SPK-05` resolves), never real user PII |
| **Device lab** | Offline chaos, Android instrumented, performance-on-target-hardware | Synthetic matches sized to realistic formats (T20 ≈ 250 events) |
| **Production** | Availability monitoring, synthetic canaries (`security-specification.md §15`, `system-architecture.md §3.13`) | Real, but no test *writes* real match data — canaries use dedicated synthetic-marked accounts |

**Test data principles:** every fixture is versioned alongside the spec it tests against (a conformance-suite case and its expected output live in the same repository location as `live-scoring.md`'s catalogue, so a spec change and its test update are one reviewable diff); no test suite at any layer ever depends on real personal data, satisfying `security-specification.md §12`'s minimisation principle inside the test process itself, not only production.

## 21. CI/CD gates — the consolidated list

Every "must pass" gate named across every prior document, in one place, mapped to its pipeline stage (`technology-stack.md ADR-T11`):

| Stage | Gate | Threshold |
|---|---|---|
| **Every PR** | Unit + Domain/Conformance suite | 100% pass |
| | Cross-platform parity corpus | Matrix published, no regression from the prior merged commit |
| | RLS policy matrix (pgTAP) | 100% pass |
| | API contract tests | 100% pass |
| | UI suites (changed screens) | 100% pass |
| | Static secret/key scan | Zero findings |
| | Offline-chaos subset + convergence subset | 100% pass (bounded subset for PR speed; full run nightly) |
| **`main` (pre-merge-to-release)** | Full offline chaos suite (≥ 50 innings, device lab) | Zero event loss |
| | Full sync-convergence suite (wide ordering sweep) | 100% identical merges |
| | Migration dry-run against a prod-like snapshot | Clean apply, no data loss |
| **Pre-pilot** | Conformance suite | 100% |
| | Accredited-scorer `[LAW]` review pass | Complete |
| | WCAG 2.2 AA on core flows | Zero blocking issues |
| | DLS benchmark (or documented manual-fallback acceptance) | Within tolerance, or fallback formally accepted |
| | Security review / initial penetration test | Complete, no unresolved critical/high findings |
| **Pre-GA** | Parity matrix | ≥ 95% |
| | Load test (concurrent matches + viewer fan-out) | Meets planned target, graceful degradation confirmed |
| | Full penetration test | Complete, no unresolved critical/high findings |
| | Incident-response tabletop | Complete |

---

## 22. Requirements-to-test traceability matrix

Cluster-level view — every SRS requirement cluster and every domain-model category, mapped to the test category/categories that cover it and the primary suite. `DR-01…36` (the cricket-rule domain requirements) are additionally detailed individually here since §19.3 already covers them at the *rule-area* level — this table gives the complementary *requirement-ID* view.

### 22.1 Functional requirements (`FR-*`, by cluster)

| Cluster | Requirements | Primary test category(ies) |
|---|---|---|
| A. Identity, Accounts & Tenancy | `FR-001…014` | API (§6), Security (§15), Integration (§5) |
| B. Match Setup | `FR-015…029` | Domain (§4, pre-state validity), DB (§7), UI (§11) |
| C. Squads, Lineups & Roles | `FR-030…041` | DB (§7), UI (§11), Domain (§4) |
| D. Live Ball-by-Ball Scoring | `FR-042…070` | **Domain (§4) — primary**, Offline (§8), UI/Android/Web (§11–13) |
| E. Innings & Match State | `FR-071…082` | Domain (§4), Integration (§5) |
| F. Rain, DLS & Reduced Overs | `FR-083…094` | Domain (§4, once `SPK-01` unblocks per §19.3) |
| G. Tie-breakers / Super Over | `FR-095…099` | Domain (§4, per §19.3's Super Over row) |
| H. Corrections, Audit & Sign-off | `FR-100…112` | Domain (§4), Integration (§5), Security/Audit (§15) |
| I. Dual-Scorer Reconciliation | `FR-113…120` | **Conflict (§10) — primary**, Sync (§9) |
| J. Scorecards, Analytics & Commentary | `FR-121…138` | Domain (§4, golden-file replay), UI (§11) |
| K. Competitions, Fixtures & Standings | `FR-139…150` | API (§6), DB (§7), Integration (§5) |
| L. Profiles, Stats, History & Search | `FR-151…160` | API (§6), DB (§7) |
| M. Sharing, Notifications & Viewer | `FR-161…170` | API (§6), E2E (§14), Security (§15, token handling) |
| N. Import, Export, API & Backup | `FR-171…182` | Integration (§5), Offline (§8, backup round-trip) |
| O. Settings, Localization & Preferences | `FR-183…190` | UI (§11), Accessibility (§17) |

### 22.2 Non-functional, business, security, offline, sync, and audit requirements

| Cluster | Requirements | Primary test category(ies) |
|---|---|---|
| Performance & efficiency | `NFR-001…008` | **Performance (§16)** |
| Reliability, durability, availability | `NFR-009…015` | **Offline (§8)**, Performance (§16, availability) |
| Sync & consistency | `NFR-016…019` | **Sync (§9)** |
| Scalability | `NFR-020…022` | Performance (§16, load) |
| Security & integrity | `NFR-023…030` | **Security (§15)** |
| Privacy & compliance | `NFR-031…036` | Security (§15), API (§6, data-subject-rights endpoints) |
| Usability & accessibility | `NFR-037…043` | **Accessibility (§17)**, UI (§11) |
| Compatibility & portability | `NFR-044…049` | Android (§12), Web (§13), Domain (§4, parity) |
| Interoperability | `NFR-050…052` | Integration (§5, export/import round-trip) |
| Maintainability/observability/testability | `NFR-053…056` | **Domain (§4)**, all categories (this document's own subject) |
| Internationalisation | `NFR-057…059` | UI (§11), Accessibility (§17) |
| Business rules | `BR-001…045` | Domain (§4) for scoring-adjacent rules; DB (§7) for storage-enforced ones; API (§6) for command-level ones |
| Security requirements | `SEC-001…018` | **Security (§15)** — full detail in `security-specification.md`'s own `SR-XXX` catalogue |
| Offline requirements | `OFF-001…022` | **Offline (§8)** |
| Synchronization requirements | `SYNC-001…016` | **Sync (§9)**, Conflict (§10) |
| Audit requirements | `AUD-001…015` | Domain (§4, provenance on every event), DB (§7, append-only grants), Security (§15) |

### 22.3 Domain rules (`DR-01…36`) — individual trace

| `DR-*` | Area | Covered (§19.3) | Suite |
|---|---|---|---|
| `DR-01` Formats | `FMT` | Indirect | DB §7 |
| `DR-02` Teams | `TEAM` | Indirect | DB §7 |
| `DR-03` Players | `PLYR` | Indirect | DB §7 |
| `DR-04` Officials | `OFCL` | Indirect | DB §7 |
| `DR-05` Match lifecycle | `STATE` | Planned | Integration §5 |
| `DR-06` Innings | `INN` | **Done** | Domain §4, `C01…C12` |
| `DR-07` Overs | `OVER` | **Done** | Domain §4, `C01…C12` |
| `DR-08` Balls | `BALL` | **Done** | Domain §4, `C01…C12` |
| `DR-09` Runs & boundaries | `RUN` | **Done** | Domain §4, `C01…C10` |
| `DR-10` Strike rotation | `STRK` | **Done** | Domain §4, `C11/C12`, `EX-03/EX-04` |
| `DR-11…16` Extras (general/NB/WD/BYE/LB/PEN) | `EXT/NB/WD/BYE/LB/PEN` | **Done** | Domain §4, `C13…C30` |
| `DR-17` Free hit | `FH` | **Done** | Domain §4, `C46…C49` |
| `DR-18/19` Wickets general + dismissal detail | `WKT` + 12 sub-areas | **Done** | Domain §4, `C31…C45` |
| `DR-20` Bowling figures | `BOWL` | **Done** | Domain §4 |
| `DR-21` Batting figures | `BAT` | **Done** | Domain §4 |
| `DR-22` Partnerships | `PART` | **Done** | Domain §4, golden-file |
| `DR-23` Powerplays | `PP` | Partial | Domain §4 (add per §19.3) |
| `DR-24` Reviews | `DRS` | Not started (P2) | — |
| `DR-25/26` Declarations/follow-on | `DECL/FLW` | Not started (P3) | — |
| `DR-27` Results | `RES` | **Done** | Domain §4 |
| `DR-28` Target | `TGT` | **Done** | Domain §4 |
| `DR-29` Reduced overs/interruptions | `INN`/`DLS` inputs | Partial | Domain §4 (target reduced-overs cases) |
| `DR-30` Super Over | `SO` | Partial | Domain §4 (add per §19.3) |
| `DR-31` Cross-cutting invariants | `INV` | **Done** | Domain §4 property-based, every case |
| `DR-32` Commentary | `CMTRY` | N/A | — |
| `DR-33` Corrections | `CORR` | **Done** | Domain §4, `EX-12/EX-13` |
| `DR-34` Scorecard content | `SCRD` | **Done** | Domain §4, golden-file |
| `DR-35` Configuration registry | `CFG-REG` | Partial | Domain §4 property-based |
| `DR-36` DLS method | `DLS` | Not started (`SPK-01`) | — |

---

## 23. Open items

| # | Item | Current default | Resolution path |
|---|---|---|---|
| TQ-1 | Exact number of property-based generation iterations per CI run vs. nightly | Not numerically fixed | Tune for CI speed vs. coverage once the suite exists |
| TQ-2 | `[DEFAULT]` 85% unit-coverage floor (§3) not yet validated against real module sizes | Placeholder default | Revisit once the core's actual module structure exists |
| TQ-3 | Visual-regression tooling choice for the two highest-traffic screens (§18) | Not yet selected | Web + Android leads, pre-Version-1 |
| TQ-4 | Whether real (anonymised) Cricsheet-derived matches become available for golden-file testing before or after `SPK-05` resolves | Synthetic-only until then | Product-spec, tied to `SPK-05`'s own resolution |
| TQ-5 | `DR-23`/`DR-29`/`DR-30` "partial" gaps (§19.3/§22.3) need a concrete authoring owner and date | Flagged, not yet scheduled | Assign against `docs/roadmap/product-roadmap.md`'s MVP/Version-1 build sequence |

---

## 24. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-22 | Initial testing strategy, written before implementation. §1–§2: purpose, the determinism-as-testable-property principle (carried directly from `live-scoring.md`'s production-code determinism contract), and a pyramid adapted for this project's unusually large domain/conformance layer. §3–§18: sixteen test categories — Unit, Domain/Conformance (the shared scoring core's four-technique suite: fixed catalogue + worked examples + property-based generation + golden-file replay, doubling as the cross-platform parity mechanism), Integration, API, Database, Offline (the chaos-test flagship), Sync (the convergence-test flagship), Conflict (fence and divergence resolution policy, distinct from sync mechanics), UI (one suite per `UX-##` screen), Android, Web, End-to-end (sourced from `docs/ux/ux-specification.md`'s seven workflows and `offline-first-specification.md`'s four scenarios, never invented fresh), Security (pointer into `security-specification.md §15`), Performance, Accessibility, and Regression (a policy section, not a new suite). §19: the explicit "every critical cricket rule has deterministic test cases" requirement — `[LAW]`+invariant rules defined as the critical bar, a full area-by-area coverage table against `cricket-rules-reference.md`'s 34 areas showing what's done (the entire P1 core scoring path) versus deliberately deferred (`DLS`, `DRS`, multi-day), and an honest summary. §20 test environments and data strategy. §21 a consolidated CI/CD gate list spanning every prior document's release gates. §22 the requirements-to-test traceability matrix, at cluster level for `FR`/`NFR`/`BR`/`SEC`/`OFF`/`SYNC`/`AUD`, and at individual-ID level for all 36 `DR-*` domain rules. §23 five open items. No test code — a strategy document. |

