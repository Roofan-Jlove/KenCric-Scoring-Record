/**
 * TASK-0132: storage for `feature_flags` (`data-specification.md
 * §10.2`) -- resolves `FR-160`'s own "feature flags" capability, the
 * one `UX-28` admin-console piece with an existing UI shell already
 * built (`AdministrationScreen.tsx`'s own `FEATURE_FLAGS` section,
 * `TASK-0091`) but no backend persistence wired.
 *
 * **This module is the storage layer only.** It does NOT wire actual
 * flag-gating logic into any other endpoint -- each future gated
 * feature checks its own flag, not built here -- and does NOT connect
 * to `AdministrationScreen.tsx`'s own existing `featureFlags`/
 * `onToggleFeatureFlag` props; that wiring is future work, not
 * invented here.
 *
 * `key` is plain text, validated only for presence -- no canonical
 * flag-key list exists anywhere in this corpus, the same "nothing
 * authoritative to constrain against yet" reasoning
 * `notificationPreferences.ts`/`userLocalePreferences.ts` already used
 * for their own unconstrained text columns.
 *
 * `Authz: platform-admin` (`FR-160`'s own framing) left to RLS, per
 * `FA-7` -- the default every `§6.1`/`§11` module except
 * `signOffMatch` already uses.
 */

import { schemaValidationError, type ProblemDetails } from "../authz/errors.js";

export interface FeatureFlagRow {
  key: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface FeatureFlagStore {
  get(key: string): FeatureFlagRow | null;
  upsert(row: FeatureFlagRow): void;
  list(): FeatureFlagRow[];
}

export type SetFeatureFlagResult =
  | { outcome: "set"; row: FeatureFlagRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** `PUT /admin/feature-flags/{key}`. Idempotent upsert -- toggles the flag in place, no `row_version`. */
export function setFeatureFlag(key: string, enabled: boolean | undefined, actorRef: string, store: FeatureFlagStore, nowIso: string, instance: string): SetFeatureFlagResult {
  if (!key) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: key", instance) };
  }
  if (enabled === undefined) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: enabled", instance) };
  }

  const row: FeatureFlagRow = { key, enabled, updatedAt: nowIso, updatedBy: actorRef };
  store.upsert(row);
  return { outcome: "set", row };
}

/**
 * `GET /admin/feature-flags/{key}`. Never `404`s -- a flag that was
 * never explicitly created defaults to disabled, the safe direction
 * for an unrecognised feature to default to.
 */
export function getFeatureFlag(key: string, store: FeatureFlagStore): FeatureFlagRow {
  const existing = store.get(key);
  if (existing) return existing;
  return { key, enabled: false, updatedAt: "", updatedBy: "" };
}

/** `GET /admin/feature-flags`. Every flag that has ever been explicitly set -- no pagination, a bounded-size list by nature. */
export function listFeatureFlags(store: FeatureFlagStore): FeatureFlagRow[] {
  return store.list();
}

/** An in-memory FeatureFlagStore for tests -- not a production adapter. */
export class InMemoryFeatureFlagStore implements FeatureFlagStore {
  private readonly rows = new Map<string, FeatureFlagRow>();

  get(key: string): FeatureFlagRow | null {
    return this.rows.get(key) ?? null;
  }

  upsert(row: FeatureFlagRow): void {
    this.rows.set(row.key, row);
  }

  list(): FeatureFlagRow[] {
    return Array.from(this.rows.values());
  }
}
