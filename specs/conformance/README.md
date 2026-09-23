# Conformance fixture catalogue

`TASK-0032`: every row of `live-scoring.md §21` (`C01…C55`) and every worked
example of `§22` (`EX-01…EX-13`) as a literal, standalone data file — one
file per case, 68 files total (55 + 13), matching this task's own
Verification procedure ("a count check — fixture file count equals 55 + 13").

**Fixtures are data, not code** (this task's own Expected behavior): adding
a new case means adding a new `.json` file here, never touching the runner
(`shared/src/commonTest/kotlin/.../conformance/`) or any pipeline code.

## The three fixture kinds

The case catalogue is not uniform — `§21`'s own column sets differ by
section, and `§21.9`'s rows are rejections, not outcomes, so one rigid
schema across all 68 files would either fabricate unstated detail (forcing
every `C*` row into a full pre/post innings-state shape the table never
specifies) or misrepresent what each row actually asserts. Three kinds,
each with its own JSON shape:

### `worked_example` (`EX-01`…`EX-13`, from `§22`)

A full end-to-end scenario: `genesis`/`config`/`delivery`/`expected`, each
shaped exactly like `TASK-0029`'s `InningsFoldState`/`FoldConfig`/
`DeliveryInput`. Checked by applying `delivery` to `genesis` via
`applyDelivery()` (`TASK-0029`) and asserting full equality against
`expected` — precisely `TASK-0031`'s existing `ConformanceCase` shape.

`EX-10` (the mankad) is the one exception: it has no `DeliveryInput` at all
(`§16.3`'s own text — "no legality/runEvents fields exist to validate at
all"), and `applyDelivery()` cannot fold it (a known, already-flagged gap
from `TASK-0029`). Its fixture carries `"executable": false` and a
`"blockedBy"` note instead of a `delivery`/`expected` pair — the narrative
data is captured for whenever mankad-folding is built, not silently
dropped, but it cannot be run against today's runner.

### `delivery_outcome` (most of `C01`…`C49`, from `§21.2`–`§21.8`)

A narrow assertion, containing only the fields that row's own table column
set actually specifies (never fabricated context beyond it): `legality`,
`runEvents`, optionally `shortRuns`/`wicket`/`isFreeHit`, and an `expected`
object whose fields are a subset of `total`, `batterRuns`,
`bowlerRunsCharged`, `ranRuns`, `extrasCategory`/`extrasValue`, `rotates`,
`consumesLegalBallSlot`, `incrementsBallsFaced`, `freeHitPendingAfter`,
`bowlerCredited`, `endResolutionNote` (free text, for the `§21.7` wicket
rows whose end-resolution outcome is prose, not a single field).

Checking one of these composes the already-existing pure functions
directly (`classifyLegality`, `aggregateRuns`, `resolvesStrikeRotation`,
`creditsBowler`, etc.) rather than a full `InningsFoldState` fold — no new
pipeline logic, just calling what `TASK-0018`-`0025` already built with
each case's own inputs.

### `rejection` (`C50`…`C55`, from `§21.9`)

`input` (a full `DeliveryInput` shape, deliberately invalid),
`expectedRule` (one of `V1`…`V11`), and `reason` (the human-readable
justification, copied from the table). Checked via `validateDelivery()`
(`TASK-0017`) — asserts `ValidationResult.Invalid` containing a failure
tagged with `expectedRule`.

## Honest scope note — the loader does not exist yet

This task's own Files/components field is `specs/conformance/` only — data,
not the runner. Actually parsing these `.json` files at Kotlin test-run
time needs a JSON deserialization library (e.g. `kotlinx-serialization-
json`); no such dependency has been added to this project, because no
Gradle build exists yet for `shared/` at all (flagged since `TASK-0016` —
this backlog has never had a Kotlin/Gradle/Java toolchain available). The
matching Kotlin-side data classes for these three shapes, and the checker
functions each kind needs, are scaffolded in
`shared/src/commonTest/kotlin/.../conformance/FixtureSchema.kt` --
deliberately flagged there as *designed, not wired*: real parsing and
100+ per-case execution is future work once a toolchain exists, consistent
with every other `shared/` verification gap this session has carried.
