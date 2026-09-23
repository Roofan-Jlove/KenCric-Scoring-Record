/**
 * TASK-0040: a stand-in for the shared/ Kotlin Multiplatform core's
 * compiled JS bundle (technology-stack.md: "One Kotlin source -> native
 * on Android, JS/wasm on web. Web consumes a generated JS bundle.").
 *
 * THIS IS A STUB, NOT THE REAL THING -- flagged explicitly, not
 * silently passed off as a real integration. No Kotlin/Gradle toolchain
 * has ever been available anywhere in this session (confirmed since
 * TASK-0016), so there has never been a way to actually produce that
 * bundle. Everything below re-declares just enough of the ALREADY-BUILT
 * Kotlin shape (IdPort, TASK-0016; the offline-command-execution model,
 * TASK-0034) for this screen's own logic to compose against, with the
 * exact same method signatures the real bundle would eventually expose
 * -- so swapping this file for a real generated import is the only
 * change a future task needs to make, not a redesign of the screen.
 */

/** Mirrors shared/'s IdPort (TASK-0016) -- "the only sanctioned way commonMain code creates a new id." */
export interface IdPort {
  newId(): string;
}

/** A real adapter uses the platform's UUID generator; this default stub does the same, since crypto.randomUUID() is a real browser API, not a Kotlin-core concern -- only the PORT SHAPE is what's stubbed here, not id generation itself. */
export const browserIdPort: IdPort = {
  newId: () => crypto.randomUUID(),
};
