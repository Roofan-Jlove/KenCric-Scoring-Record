/**
 * TASK-0138: storage for `status_banners` (`data-specification.md
 * §10.3`) -- resolves `FR-160`'s own "status/maintenance banners"
 * capability, the final `§6.3` item of this round.
 *
 * **The most speculative module of the entire session, flagged
 * explicitly rather than silently treated as equivalent to this
 * round's other storage-only slices:** unlike `notificationPreferences.ts`/
 * `userLocalePreferences.ts`/`featureFlags.ts`, this one has no
 * textual anchor anywhere in this corpus beyond the single phrase
 * "status/maintenance banners" in `FR-160`'s own Description line --
 * no acceptance criterion, no UX-specification text, no domain-model
 * entity. The shape below (`message`/`severity`/`active`/`startsAt`/
 * `endsAt`) is genuinely invented to fit that phrase's plain meaning,
 * not derived from any written requirement detail. The user was told
 * this directly and chose to proceed anyway.
 *
 * `severity` is validated only for presence when supplied (it is
 * itself optional) -- no canonical severity list exists anywhere in
 * this corpus, the same "nothing authoritative to constrain against
 * yet" reasoning `notificationPreferences.ts`/`featureFlags.ts`
 * already used for their own unconstrained fields.
 */
import { notFoundError, schemaValidationError } from "./errors.js";
/** `PUT /admin/status-banners/{id}`. Idempotent upsert -- no `row_version`. */
export function setStatusBanner(id, payload, actorRef, store, nowIso, instance) {
    if (!id) {
        return { outcome: "rejected", problem: schemaValidationError("Missing required field: id", instance) };
    }
    if (!payload.message) {
        return { outcome: "rejected", problem: schemaValidationError("Missing required field: message", instance) };
    }
    if (payload.active === undefined) {
        return { outcome: "rejected", problem: schemaValidationError("Missing required field: active", instance) };
    }
    const row = {
        id,
        message: payload.message,
        severity: payload.severity ?? null,
        active: payload.active,
        startsAt: payload.startsAt ?? null,
        endsAt: payload.endsAt ?? null,
        updatedAt: nowIso,
        updatedBy: actorRef,
    };
    store.upsert(row);
    return { outcome: "set", row };
}
/** `GET /admin/status-banners/{id}`. Unlike `feature_flags`'s own never-404s default, a banner id that was never created has no sensible default to fall back to -- a real `404`. */
export function getStatusBanner(id, store, instance) {
    const row = store.get(id);
    if (!row) {
        return { outcome: "rejected", problem: notFoundError(`No status banner visible with id ${id}`, instance) };
    }
    return { outcome: "found", row };
}
/** `GET /admin/status-banners`. Every banner ever created, unfiltered, no pagination -- an admin-console list, small by nature. */
export function listStatusBanners(store) {
    return store.list();
}
/**
 * The client-facing read: which banners should actually display right
 * now. `active` and the `startsAt`/`endsAt` window are independent --
 * both must hold.
 */
export function listActiveStatusBanners(nowIso, store) {
    return store.list().filter((row) => {
        if (!row.active)
            return false;
        if (row.startsAt && nowIso < row.startsAt)
            return false;
        if (row.endsAt && nowIso > row.endsAt)
            return false;
        return true;
    });
}
/** An in-memory StatusBannerStore for tests -- not a production adapter. */
export class InMemoryStatusBannerStore {
    rows = new Map();
    get(id) {
        return this.rows.get(id) ?? null;
    }
    upsert(row) {
        this.rows.set(row.id, row);
    }
    list() {
        return Array.from(this.rows.values());
    }
}
//# sourceMappingURL=statusBanners.js.map