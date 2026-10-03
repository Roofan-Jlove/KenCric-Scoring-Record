/**
 * TASK-0144: the KMP build config for `shared/` -- `repository-
 * structure.md §15`'s own line: "build config -- KMP Gradle setup; a
 * Kotlin/JS npm-publishable output consumed by apps/web (§15)."
 * `technology-stack.md ADR-T01`'s own decision: "One Kotlin codebase
 * compiled to a JVM artifact (Android) and a JS/wasm bundle (web)" --
 * realised here as a `jvm()` target (for Android, and for finally
 * running every hand-traced `commonTest` suite this session has
 * written for real, once a JDK exists) plus a `js(IR)` target with
 * both `nodejs()` and `browser()` enabled (one JS/IR compilation
 * serves both `backend/` via Node and `apps/web/` via a bundler --
 * Kotlin/JS supports declaring both runtimes under one `js` target).
 *
 * **The Kotlin version below (`2.0.20`) is a placeholder, not a
 * ratified decision** -- no document in this corpus pins an exact
 * Kotlin release; the same "a stand-in value, not a real choice"
 * discipline `ApiErrors.kt`'s own `ERROR_BASE_URI` placeholder already
 * uses. Revisit once a real toolchain is available to verify
 * compatibility against.
 *
 * **Never executed** -- no Gradle/JDK/Kotlin toolchain exists anywhere
 * in this session. Reviewed by hand against Gradle Kotlin DSL syntax
 * only, the same limitation every migration/schema file in this
 * backlog already carries.
 */

plugins {
    kotlin("multiplatform") version "2.0.20"
}

group = "com.kencric.scoring"
version = "0.1.0"

repositories {
    mavenCentral()
}

kotlin {
    jvm()

    js(IR) {
        nodejs()
        browser()
        binaries.library()
    }

    sourceSets {
        val commonMain by getting {
            // The entire shared/ core is pure Kotlin stdlib -- no
            // external dependency has ever been needed (ClockPort/
            // IdPort/EventLogPort/ReferenceDataPort are plain
            // interfaces, no I/O library required at this layer).
        }
        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }
    }
}
