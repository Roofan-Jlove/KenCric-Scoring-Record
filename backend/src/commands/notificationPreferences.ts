/**
 * TASK-0130: generic CRUD for `notification_preferences`
 * (`data-specification.md §3.5`) -- resolves a scope gap `TASK-0089`'s
 * own mint note already anticipated ("a per-channel/per-event
 * preference model") but left unbuilt, since `FR-158`'s own
 * dependency (`FR-141`, push delivery) remains unbuilt itself.
 *
 * **A deliberate, explicitly-scoped STORAGE-ONLY slice, not the full
 * feature:** this module stores a user's preference per `(channel,
 * eventType)` pair. It delivers nothing -- no push/email transport
 * exists anywhere in this codebase -- and does not implement the
 * offline "will sync" queuing behavior `ux-specification.md UX-27`'s
 * own Error-handling text describes (`TASK-0089`'s own honest scope
 * gap, still open). A preference row with no corresponding delivery
 * mechanism is inert data until `FR-141` exists.
 *
 * **A real, necessary simplification, flagged rather than silently
 * narrowed:** neither `channel` nor `eventType` has a canonical value
 * list anywhere in this corpus (see `§3.5`'s own note for the full
 * reasoning) -- both are plain strings, validated only for presence,
 * never checked against an invented enum the way `memberships.roles`
 * is checked against `VALID_ROLES`.
 *
 * `addSquadMember`'s own shape (`TASK-0097`) is the closest precedent
 * -- an idempotent upsert with no `row_version`/stale-version concept,
 * the same "low-stakes, owner-only write" reasoning applied here.
 */

import { schemaValidationError, type ProblemDetails } from "../authz/errors.js";

export interface NotificationPreferenceRow {
  userId: string;
  channel: string;
  eventType: string;
  enabled: boolean;
  updatedAt: string;
}

export interface NotificationPreferenceStore {
  get(userId: string, channel: string, eventType: string): NotificationPreferenceRow | null;
  upsert(row: NotificationPreferenceRow): void;
  /** Every preference row for one user -- backs `listNotificationPreferences`. */
  listByUser(userId: string): NotificationPreferenceRow[];
}

export type SetNotificationPreferenceResult =
  | { outcome: "set"; row: NotificationPreferenceRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/**
 * `PUT /users/me/notification-preferences/{channel}/{eventType}`.
 * Idempotent upsert -- no `row_version`, never a `409`, the same
 * shape `addSquadMember` already established.
 */
export function setNotificationPreference(
  userId: string,
  channel: string,
  eventType: string,
  enabled: boolean | undefined,
  store: NotificationPreferenceStore,
  nowIso: string,
  instance: string,
): SetNotificationPreferenceResult {
  if (!userId) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: userId", instance) };
  }
  if (!channel) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: channel", instance) };
  }
  if (!eventType) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: eventType", instance) };
  }
  if (enabled === undefined) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: enabled", instance) };
  }

  const row: NotificationPreferenceRow = { userId, channel, eventType, enabled, updatedAt: nowIso };
  store.upsert(row);
  return { outcome: "set", row };
}

/** `GET /users/me/notification-preferences`. No keyset pagination -- a user's own preference set is small by nature, the same simplification `squad_members`'s own `listSquadMembers` already made for a bounded-size list. */
export function listNotificationPreferences(userId: string, store: NotificationPreferenceStore): NotificationPreferenceRow[] {
  return store.listByUser(userId);
}

/** An in-memory NotificationPreferenceStore for tests -- not a production adapter. */
export class InMemoryNotificationPreferenceStore implements NotificationPreferenceStore {
  private readonly rows = new Map<string, NotificationPreferenceRow>();

  private key(userId: string, channel: string, eventType: string): string {
    return `${userId}::${channel}::${eventType}`;
  }

  get(userId: string, channel: string, eventType: string): NotificationPreferenceRow | null {
    return this.rows.get(this.key(userId, channel, eventType)) ?? null;
  }

  upsert(row: NotificationPreferenceRow): void {
    this.rows.set(this.key(row.userId, row.channel, row.eventType), row);
  }

  listByUser(userId: string): NotificationPreferenceRow[] {
    return Array.from(this.rows.values()).filter((r) => r.userId === userId);
  }
}
