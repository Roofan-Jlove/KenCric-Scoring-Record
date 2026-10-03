/**
 * TASK-0144: the repository's own first real Gradle project -- added
 * to unblock a real Kotlin→JS compilation path for `shared/`, resolving
 * the "no Kotlin Multiplatform build exists anywhere" half of the
 * Kotlin↔TypeScript FFI gap (`backend/src/validation/deliveryValidator.ts`'s
 * own doc comment is the other half, a stand-in TypeScript port until
 * this project can actually be built and the JS output wired in).
 *
 * `repository-structure.md §15`'s own stated convention: "`shared/`
 * and `apps/android/` are modules of one Gradle multi-project build (a
 * single `settings.gradle.kts` at the repo root including both) --
 * this is standard, idiomatic Kotlin Multiplatform practice." Only
 * `:shared` is included here -- `apps/android/` remains contract-only
 * (no Gradle Android project exists anywhere in this backlog either);
 * including a module that doesn't exist would fail Gradle's own
 * project-resolution step the moment a real toolchain tried to run
 * this file, a worse failure mode than simply not naming it yet.
 *
 * **HONEST LIMITATION, same as every other artifact in this session:**
 * no Gradle/JDK/Kotlin toolchain exists anywhere in this environment
 * (confirmed: `which gradle`/`java`/`kotlinc` all exit 127). This file
 * is written, reviewed by hand against Gradle Kotlin DSL syntax, and
 * never executed -- the same "written but never run" category every
 * SQL migration and JSON Schema file in this backlog already carries.
 * There is also no Gradle wrapper (`gradlew`/`gradlew.bat`/
 * `gradle/wrapper/gradle-wrapper.jar`) -- the wrapper jar is a binary
 * artifact Gradle itself generates on first run (`gradle wrapper`),
 * which needs a real Gradle install to produce; it cannot be
 * hand-written the way this file can.
 */

rootProject.name = "kencric-score-record"

include(":shared")
