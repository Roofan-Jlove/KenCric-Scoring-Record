/**
 * TASK-0131: storage for `user_locale_preferences`
 * (`data-specification.md §3.6`) -- resolves SRS `FR-157` ("interface
 * language selection... English at launch and a framework for adding
 * more," `Should·P1`) via the same explicitly-scoped STORAGE-ONLY
 * pattern `TASK-0130` already established for `FR-158`.
 *
 * **This module does NOT build the string-externalization/rendering
 * framework `FR-157`'s own acceptance line implies** ("a second
 * language pack installed... all externalised strings render in that
 * language") -- no i18n infrastructure (translation files, a
 * string-extraction pipeline, a rendering layer that swaps strings by
 * locale) exists anywhere in this codebase, and none is built here. A
 * stored `locale` value with nothing reading it to actually change
 * rendered UI text is inert data until that infrastructure exists.
 *
 * A separate table/module from `users` itself, not a new column there
 * -- `users` is explicitly NOT a `§6.1` generic-CRUD resource in this
 * backlog (`TASK-0104`'s own mint note: "auth/profile fields are
 * Supabase-managed," no generic update command exists for it at all).
 *
 * `locale` is plain text, validated only for presence -- `FR-157`'s
 * own text names no actual second language anywhere in this corpus to
 * validate against, the same "nothing authoritative to constrain
 * against yet" reasoning `notificationPreferences.ts`'s own
 * `channel`/`eventType` fields already used.
 */

import { schemaValidationError, type ProblemDetails } from "../authz/errors.js";

export const DEFAULT_LOCALE = "en";

export interface UserLocalePreferenceRow {
  userId: string;
  locale: string;
  updatedAt: string;
}

export interface UserLocalePreferenceStore {
  get(userId: string): UserLocalePreferenceRow | null;
  upsert(row: UserLocalePreferenceRow): void;
}

export type SetUserLocaleResult =
  | { outcome: "set"; row: UserLocalePreferenceRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** `PUT /users/me/locale-preference`. Idempotent upsert -- no `row_version`, the same low-stakes shape `notificationPreferences.ts`'s own `setNotificationPreference` already established. */
export function setUserLocale(userId: string, locale: string | undefined, store: UserLocalePreferenceStore, nowIso: string, instance: string): SetUserLocaleResult {
  if (!userId) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: userId", instance) };
  }
  if (!locale) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: locale", instance) };
  }

  const row: UserLocalePreferenceRow = { userId, locale, updatedAt: nowIso };
  store.upsert(row);
  return { outcome: "set", row };
}

/**
 * `GET /users/me/locale-preference`. Never `404`s -- an absent row
 * defaults to `DEFAULT_LOCALE` (`FR-157`'s own "English at launch"
 * text), the same "an absent row is itself meaningful" reasoning
 * `§3.6`'s own Soft-deletion note already uses.
 */
export function getUserLocale(userId: string, store: UserLocalePreferenceStore): UserLocalePreferenceRow {
  const existing = store.get(userId);
  if (existing) return existing;
  return { userId, locale: DEFAULT_LOCALE, updatedAt: "" };
}

/** An in-memory UserLocalePreferenceStore for tests -- not a production adapter. */
export class InMemoryUserLocalePreferenceStore implements UserLocalePreferenceStore {
  private readonly rows = new Map<string, UserLocalePreferenceRow>();

  get(userId: string): UserLocalePreferenceRow | null {
    return this.rows.get(userId) ?? null;
  }

  upsert(row: UserLocalePreferenceRow): void {
    this.rows.set(row.userId, row);
  }
}
