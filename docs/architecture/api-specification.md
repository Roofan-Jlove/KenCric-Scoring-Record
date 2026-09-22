# Cricket Scoring Book — API Specification

| | |
|---|---|
| **Document** | API Specification |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-22 |
| **Upstream** | `docs/specs/software-requirements-specification.md` v0.1.0 (`FR-/NFR-/SEC-/OFF-/SYNC-/AUD-`) · `docs/domain/domain-model.md` v0.1.0 (`CMD-/QRY-/EVT-/SVC-`) · `docs/architecture/system-architecture.md` v0.1.0 (§3.9/3.10, `ADR-T07`) · `docs/specs/live-scoring.md` v0.1.0 (event payload shape) · `docs/architecture/offline-first-specification.md` v0.1.0 (sync protocol semantics) · `docs/architecture/data-specification.md` v0.1.0 (resource schemas) |
| **Downstream** | OpenAPI/JSON-Schema authoring, client SDK generation (`system-architecture.md §4.7/4.8`) |
| **Status** | A **complete API contract specification** — every endpoint, method, request/response field shape, status code, and trace. **No implementation** — no OpenAPI/YAML, no route-handler code, no literal request/response JSON. Where this document's job overlaps an already-specified behavior (the sync protocol's exact semantics, `offline-first-specification.md §7`; the event payload shape, `live-scoring.md §16`), it **cross-references rather than re-derives** — this document fixes the *surface* (paths, methods, schemas, status codes), not the *behavior*, which those documents already own. Fulfils the `api-contracts.md` item already listed as planned in `docs/README.md`. |

> Every endpoint below traces to at least one SRS requirement and at least one domain command/query/event. The reverse is **not** true by design: most of the ~168 functional requirements are satisfied entirely client-side or via the generic sync/event-ingest endpoints (§12), not a bespoke endpoint each — inventing one endpoint per requirement would contradict the offline-first, event-sourced architecture this API exposes.

---

## 1. Purpose, scope, and how to read this document

### 1.1 The endpoint taxonomy

Five kinds of endpoint exist, matching `system-architecture.md §3.10`/`ADR-T07`'s hybrid API style and `data-specification.md §1.4`'s two sync models:

| Kind | Style | Examples | §§ |
|---|---|---|---|
| **Generic CRUD resource** | REST, RLS-guarded, idempotent `PUT`-to-create with a client-supplied id (`data-specification.md §1.3`) | organizations, teams, players, matches (header fields), competitions | §10 |
| **Match lifecycle command** | RPC (`POST`), server-side domain logic beyond a simple field upsert | sign-off, dispute adjudication, appearance-claim approval | §11 |
| **Sync (event-sourced)** | RPC, batch, idempotent, cursor-based — the offline-first backbone | push/pull `match_events`, writer-fence | §12 |
| **Event / audit** | Read-only browse of the event/audit history, plus outbound webhooks for integration events | ball-by-ball log, audit trail, reconciliation reports, webhook registration | §13 |
| **Output / export / sharing / admin / public** | Mixed REST + RPC | scorecard, live viewer, exports, share links, admin ops, V2 public API | §14–§18 |

### 1.2 Notation

- **Method + path** is normative; `{param}` is a path parameter.
- **Request schema** / **Response schema** are field tables (`Field | Type | Required | Notes`) — the same style `data-specification.md` uses for storage, deliberately, so the two documents read as one coherent contract from client input to stored row.
- **Trace** cites the SRS requirement(s) and the domain `CMD-`/`QRY-`/`EVT-` this endpoint realises. `(derived)` marks an endpoint synthesised to satisfy a requirement that names no specific interaction shape in the SRS — never an endpoint invented without a requirement basis.
- Every endpoint's **auth** and **authz** are stated per-endpoint but drawn from the fixed rules in §2–§3, not re-explained each time.
- Types reuse `data-specification.md §1.2`'s notation (`uuid`, `text`, `integer`, `timestamptz`, `jsonb`, `enum(...)`) for request/response fields that map directly to stored columns.

### 1.3 Base path and content type

All endpoints (except the public share-link viewer and public V2 API, which are separately versioned, §14.4/§18) are served under a versioned base path (§9); all request/response bodies are JSON unless stated otherwise (export downloads, §15). No further transport detail is specified here — that is `system-architecture.md §3.4`'s concern.

---

## 2. Authentication

### 2.1 Mechanisms

| Mechanism | Used for | Carries |
|---|---|---|
| **Bearer JWT** (`Authorization: Bearer <token>`) | Every authenticated endpoint | `sub` (user id), issued by GoTrue (`ADR-T08`); short TTL, paired with a refresh token the client exchanges out-of-band | 
| **Cached claims snapshot** | Local/offline authorization only (never presented to the server) | Verified on-device within the offline grace window (`offline-first-specification.md §2.1`, `OFF-013`); irrelevant to this document's server-facing contract, noted for completeness |
| **Share token** (opaque, in the path, `GET /viewer/{token}`) | The public read-only viewer surface only | No user identity — the token itself is the capability (`SEC-009`) |
| **API key** (`Authorization: ApiKey <prefix>.<secret>`) | The V2 public read API (§18) only | Organization-scoped (`SEC-017`) |
| **None** | Sign-up, sign-in, magic-link, password-reset-request, the public viewer, health checks | — |

### 2.2 What "authenticated" does *not* imply

A valid JWT proves *who* the caller is; it proves nothing about *what* they may do — that is exclusively §3's concern, enforced primarily by RLS, never by the presence of a token alone (`SEC-003`).

### 2.3 Guest requests

A request against a **guest** match (`organization_id IS NULL`, `data-specification.md §5.1`) carries **no** organization-scoped authorization at all — access is instead scoped to the originating `device_id`, asserted by the client and checked against `matches.origin_device_id`. A guest match is invisible to every other identity, authenticated or not, until claimed (`SEC-016`, `MINV-15`).

---

## 3. Authorization

### 3.1 Enforcement layering (restated from `system-architecture.md §3.9` as this document's binding contract)

1. **Client** — advisory only (hides/disables UI); never trusted by this API.
2. **`SVC-AUTHORIZER`**, inside the command/RPC handler — checks command-level and state-machine-level rules (e.g. "is the match in a state where sign-off is legal") that RLS's row-level model cannot express on its own.
3. **RLS** — the hard boundary, on every table, keyed on `organization_id` + role (`memberships.roles`) or match-scorer-role for `match_events` writes. A request that would violate RLS is refused **regardless of what the application code intended** — this is stated here because it is what makes every "Authz" line below a real guarantee, not a convention.

### 3.2 Role-requirement summary by endpoint kind

| Endpoint kind | Minimum requirement |
|---|---|
| Read a resource scoped to organization `O` | Membership in `O` (any role), or a valid share token scoped to the specific match, or (guest) matching `device_id` |
| Write to `match_events` for match `M` | Head Scorer or Assistant Scorer role **on `M` specifically** (`BR-003`, `SEC-006`) — an org-wide role is insufficient by itself; the scorer assignment is checked |
| Sign off `M` | Head Scorer role on `M`, **and** reconciliation pass or an authorised override (`BR-005/007`) |
| Org admin actions (invite, role change, branding, templates) | Org-admin role in `O` |
| Platform admin actions (§17) | Platform-admin role, **and** MFA on the session (`ADR-T08`) |
| Impersonation | Platform-admin role, **and** a stored, unexpired `impersonation_consents` row for the target user (`SEC-011`) |
| Public viewer (`GET /viewer/{token}`) | The token alone; no role concept applies |
| V2 public read API | A valid, unrevoked API key scoped to the requested organization's data (`SEC-017`) |

Every endpoint's own **Authz** line in §10–§18 cites the specific role from this table, plus any endpoint-specific state check (e.g. "match must be `IN_PROGRESS`").

---

## 4. Validation

### 4.1 Three layers, deliberately distinct (do not conflate)

| Layer | Checks | Enforced by | Failure status |
|---|---|---|---|
| **Schema validation** | Field presence, type, format (e.g. a `uuid` is a well-formed UUID) | The request-schema contract itself, checked before any domain logic runs | `400 Bad Request` |
| **Business-rule validation** | Domain rules that don't depend on concurrent state — field-level and cross-field checks already fully specified in `live-scoring.md §5` (for delivery/event payloads) and per-resource in `data-specification.md`'s `CK` constraints | The domain layer / `SVC-*` services, run server-side even though the client already ran the identical checks locally (`offline-first-specification.md §5.1`'s "two distinct guarantees") | `422 Unprocessable Entity` |
| **State-dependent / conflict validation** | Checks only the *server's* merged, multi-device view can make — a stale writer-fence, a `device_seq` gap, a hash-chain break, an optimistic-concurrency `row_version` mismatch | The server exclusively; a client can never pre-empt this locally (`offline-first-specification.md §5.2`) | `409 Conflict` |

### 4.2 Why the distinction matters at the API level

A `400` means "you sent something malformed — fix the request." A `422` means "the request is well-formed but violates a domain rule — fix the *content*." A `409` means "the request would have been fine a moment ago, but the world has moved on — re-read current state and retry." Client retry logic (`offline-first-specification.md §8`) depends on telling these apart: only `409`-class conditions are meaningfully retryable by resubmitting after a re-pull; `400`/`422` require a *changed* request, never a bare retry.

---

## 5. Error codes

### 5.1 Response shape

Every error response is **RFC 7807** `application/problem+json` (`ADR-T07`): `type` (a stable URI identifying the error kind), `title` (human-readable summary), `status` (the HTTP status, duplicated in the body for clients that don't inspect headers), `detail` (specific, request-scoped explanation — never a raw stack trace or internal identifier), and `instance` (a correlation id for support/audit lookup). A batch endpoint (§12.1) additionally returns a per-item array using the same shape for each item's outcome.

### 5.2 Canonical error-code registry

| Code (`type` suffix) | HTTP status | Meaning | Retryable? |
|---|---|---|---|
| `validation/schema` | 400 | Malformed request body/params | No — fix the request |
| `validation/business-rule` | 422 | A domain rule was violated (`live-scoring.md §5`'s V1–V11 or a resource's `CK` constraint) | No — fix the content |
| `auth/unauthenticated` | 401 | No or invalid credential | No — re-authenticate |
| `auth/forbidden` | 403 | Authenticated, but not authorized for this action (§3) | No — requires a role/consent change |
| `sync/stale-fence` | 409 | Writer-fence conflict (`offline-first-specification.md §10.1`) | Only after §11's/UX-25's take-over-or-discard resolution |
| `sync/sequence-gap` | 409 | `device_seq` gap (`offline-first-specification.md §10.3`) | Yes — self-healing on the client's own next retry |
| `sync/hash-chain-break` | 409 | Integrity/tamper-evidence failure (`offline-first-specification.md §10.3/§17.4`) | No — routes to an operational investigation, never auto-retried |
| `sync/duplicate` | 200 *(not an error)* | An already-accepted `event_id`/idempotency key resubmitted | N/A — defined as success (§8) |
| `concurrency/stale-version` | 409 | A CRUD resource's `row_version` didn't match on write | Yes — re-pull, re-apply, retry |
| `state/invalid-transition` | 409 | The requested action is illegal in the resource's current state (e.g. sign-off on an already-`Final` match without the elevated-correction path) | Only via the correct alternate path, never a bare retry |
| `reconciliation/blocked` | 422 | Sign-off attempted while reconciliation fails without an override (`BR-007`) | Only after correcting the flagged items or supplying an authorised override |
| `rate-limited` | 429 | `SEC-010` throttling | Yes, after the `Retry-After` interval |
| `not-found` | 404 | Resource doesn't exist, or exists but RLS makes it invisible to this caller — **the response is identical in both cases**, deliberately, to avoid leaking existence across tenants | No |
| `server-error` | 500 | Unexpected failure | Yes, per §8's transient-failure backoff |

---

## 6. Pagination

Two distinct conventions, matched to the shape of what's being paged — never conflated:

| Convention | Used by | Mechanics |
|---|---|---|
| **Keyset pagination** | Every ordinary list endpoint (§10's generic `GET /{resource}` list, match history, audit-trail browse) | Query params `after` (an opaque cursor encoding the last-seen sort key) and `limit` (`[DEFAULT] 50`, `[DEFAULT] max 200`); response includes `nextCursor` (null when exhausted) and `hasMore`. Never offset/page-number — offset pagination drifts under concurrent writes, which this system has constantly (`offline-first-specification.md`'s whole premise). |
| **Watermark/cursor pagination** | The sync pull endpoint (`GET /sync/changes`, §12.2) only | A per-stream `event_ordinal`/opaque server cursor, exactly as already specified in `offline-first-specification.md §7.3` — restated here only as "this is the same mechanism as keyset pagination, applied to the event stream specifically," not a third distinct scheme. |

**Response envelope** for a keyset-paginated list: `{ "items": [...], "nextCursor": string|null, "hasMore": boolean }`. No endpoint returns a total count by default (an expensive, often-inconsistent-under-concurrency number); a `GET /{resource}?count=exact` opt-in is available where a UI genuinely needs it (e.g. an admin dashboard), clearly marked as a more expensive query.

## 7. Filtering

Every list endpoint accepts filters as query parameters, named after the field they filter, with a fixed set of operators:

| Operator suffix | Meaning | Example |
|---|---|---|
| *(none)* | Exact match | `?state=IN_PROGRESS` |
| `_in` | Match any of a comma-separated list | `?format_in=T20,ODI` |
| `_from` / `_to` | Inclusive range (dates/timestamps/numbers) | `?scheduledStart_from=2026-01-01&scheduledStart_to=2026-03-31` |
| `_search` | Full-text/trigram search on a designated searchable field | `?name_search=riverside` |

Every filterable field is named explicitly in that endpoint's own spec (§10–§18) — there is no implicit "filter by anything" behaviour, both for predictability and because it bounds what must be indexed (`data-specification.md`'s `IX` entries are chosen to cover exactly the filters this section commits to). Combining filters is always an implicit AND; there is no OR-across-fields query support in this version of the API.

## 8. Idempotency

### 8.1 Two mechanisms, matched to the two sync models (`data-specification.md §1.4`)

| Mechanism | Applies to | Key | Scope/TTL |
|---|---|---|---|
| **`event_id`** | The sync push endpoint (§12.1) | The client-generated `uuid` already carried on every domain event (`live-scoring.md §16.2`) | No expiry — enforced for as long as the event exists (`offline-first-specification.md §9.5`) |
| **`Idempotency-Key` header** | Every command/RPC endpoint that has a side effect (§11, §14.3's export creation, §16's share-link creation) | A client-generated opaque string, one per logical attempt (reused verbatim on retry, freshly generated for a genuinely new attempt) | `[DEFAULT]` retained and honoured for 24 hours from first use, after which a repeated key **may** be treated as a new request — long enough to cover any realistic offline-then-reconnect retry window for a non-scoring action |

### 8.2 Behavior, precisely

A request presenting a key (either kind) that has **already produced a successful result** returns that **identical** prior result (same status code, same body) — never a duplicate side effect, never a distinct error (`live-scoring.md §9.1`'s no-op-on-replay rule, restated at the API contract level). A request presenting a key that previously **failed** is processed fresh (a failed attempt never "poisons" the key). Idempotency is **per-endpoint**: the same key value used against two different endpoints is not linked in any way.

### 8.3 CRUD resources use a different, lighter mechanism

Generic CRUD `PUT` endpoints (§10) do not use an `Idempotency-Key` at all — `PUT` is naturally idempotent (the same body, resubmitted, produces the same resulting state), and conflicting concurrent writes are caught by `row_version` (§4.1's `409 concurrency/stale-version`), not by a key.

## 9. Versioning

### 9.1 Three distinct version concepts — disambiguated, as `data-specification.md §1.6` did for storage

| Concept | What it versions | Where it lives | Who bumps it |
|---|---|---|---|
| **API contract version** | The shape of this API itself | The base path, `/api/v{n}/...` | This document, on a breaking change |
| **Event schema version** | The shape of one event `type`'s `payload` | `match_events.event_version` (`live-scoring.md §16.2`) | The core, per event type, independent of the API version |
| **Resource row version** | Optimistic concurrency on one CRUD row | `row_version` (`data-specification.md §1.6`) | Every write, automatically |

An API contract version bump is **not** required merely because an event schema gains a new field via an upcaster (`system-architecture.md §4.8`) — the sync endpoints (§12) are deliberately schema-version-agnostic at the transport level; they carry whatever `event_version` the payload declares and let the core's upcasters handle it.

### 9.2 Compatibility policy

Within one API contract version, only **additive** changes are permitted (a new optional field, a new endpoint, a new enum value that old clients can ignore) — matching `system-architecture.md §3.10`'s compatibility rule. A field removal, a field type change, or a required-field addition is a new contract version. Two contract versions are supported concurrently for a `[DEFAULT]` minimum deprecation window of one full release cycle (`docs/roadmap/product-roadmap.md`'s stage cadence) before an old version is retired, communicated via a `Deprecation`/`Sunset` response header on every call to the outgoing version.

---

## 10. Generic CRUD resource endpoints

### 10.1 The one pattern

Every resource in §10.2's table exposes **exactly these four operations**, with no per-resource deviation in shape (only in field content and validation, captured in §10.2):

| Method + path | Purpose | Idempotent? | Auth/authz |
|---|---|---|---|
| `GET /{resource}` | Keyset-paginated list (§6), filterable (§7) | — | Membership/role per §3.2, scoped by `organization_id` (RLS) |
| `GET /{resource}/{id}` | Fetch one | — | As above; `404` (indistinguishable from non-existent, §5.2) if RLS excludes it |
| `PUT /{resource}/{id}` | **Create-or-update.** `{id}` is always **client-supplied** (`data-specification.md §1.3`) — there is no server-assigning `POST /{resource}` for any table in this section. Request carries the full resource representation plus, for an update, the `row_version` last read; a mismatch is `409 concurrency/stale-version` (§4.1) | Yes, naturally (§8.3) | Write role per §3.2 |
| `DELETE /{resource}/{id}` | Remove | Yes (a repeat delete of an already-gone id is `204`, not `404`) | Write role per §3.2; behavior (hard vs. soft) follows that resource's `data-specification.md §1.7` policy exactly — a "delete" call against a policy-2 resource performs the soft-deactivate/merge/status-change that table defines, never a row removal |

**Request/response schema** for every resource: the field table is the corresponding table's field list in `data-specification.md` **minus** the pure-storage/internal fields (`prev_hash`/`hash`, provenance-internal fields on tables that have them) **plus** `row_version` (required on `PUT` for an update; absent/ignored on create). This is stated once, here, rather than reprinted per resource, to keep this document from duplicating `data-specification.md` verbatim — where a resource's request shape deviates from its stored shape (a field that's write-once, or server-computed and response-only), §10.2's table says so explicitly.

### 10.2 Resources covered by this pattern

| Resource | Path | Storage source | Request-shape deviations from storage | Trace |
|---|---|---|---|---|
| Organizations | `/organizations` | `data-specification.md §3.2` | — | `FR-005`; `CMD-CREATE-ORGANIZATION` |
| Memberships | `/organizations/{orgId}/memberships` | `§3.3` | `status` is response-only on create (always starts `ACTIVE`); use §11.3 to deactivate, not a `PUT` with `status=DEACTIVATED` directly, so a deactivation is always explicit and auditable | `FR-007`; `CMD-ASSIGN-ROLE` |
| Teams | `/teams` | `§4.1` | — | `FR-030`; `CMD-CREATE-TEAM` |
| Players | `/players` | `§4.2` | `merged_into_player_id`/`status=MERGED` are response-only — a merge is a dedicated command (§11.6), never a plain field edit, because it redirects historical references (`BR-044`) | `FR-033/039`; `CMD-REGISTER-PLAYER` |
| Squad membership | `/teams/{teamId}/squad-members` | `§4.3` | Composite-key resource; `{id}` in the generic pattern is `{playerId}` under this nested path | `FR-030`; `CMD-ADD-TO-SQUAD` |
| Officials | `/officials` | `§5.2` | — | `FR-025`; `CMD-REGISTER-OFFICIAL` |
| Match officials | `/matches/{matchId}/officials` | `§5.3` | `{id}` is `{officialId}` under this nested path | `FR-025`; `CMD-ASSIGN-MATCH-OFFICIAL` |
| Matches (header) | `/matches` | `§5.1`, header fields only — **not** the ball-by-ball facts, which never appear via this resource | `home_xi`/`away_xi`/`toss_*`/`conditions_profile*` are write-**once**-then-locked: a `PUT` that attempts to change a frozen field after first ball is `422 validation/business-rule` (`BR-017`, `MINV-05`) — the amendment path (`live-scoring.md`) is the only way to change it after that point, and it goes through §12, not this endpoint | `FR-016…029`; `CMD-CREATE-MATCH`, `CMD-CONFIGURE-MATCH`, `CMD-RECORD-TOSS` |
| Condition templates | `/organizations/{orgId}/condition-templates` | `§5.4` (`reference_data`, `kind=CONDITIONS_PROFILE`) | Publishing a template is platform/org-admin only (§3.2); a template is **immutable once published** — a "change" is always a new `version`, per `data-specification.md §5.4`'s immutability rule, so `PUT` against an existing `{id}` after publish is `409 state/invalid-transition`, not a silent overwrite | `FR-016/028`; `CMD-PUBLISH-CONDITIONS-PROFILE` |
| Competitions *(V2)* | `/organizations/{orgId}/competitions` | — *(not in `data-specification.md`'s 28-table catalogue; scoped there as future work, `system-architecture.md §4.6`)* | — | `FR-123`; `CMD-CREATE-COMPETITION` |
| Fixtures *(V2)* | `/competitions/{competitionId}/fixtures` | — *(as above)* | — | `FR-124/141`; `CMD-CREATE-FIXTURE` |

**Filterable fields**, per §7, for the list (`GET /{resource}`) form of each: `matches` → `organizationId`, `state`, `format_in`, `scheduledStart_from/_to`, `homeTeamId`, `awayTeamId`; `teams`/`players` → `organizationId`, `name_search`; `memberships` → `organizationId`, `userId`, `status`; `officials`/`match_officials` → `matchId`; `competitions`/`fixtures` → `organizationId`/`competitionId`, `scheduledStart_from/_to`.

---

## 11. Match lifecycle command endpoints

Every endpoint in this section performs server-side domain logic beyond a field upsert; each requires an `Idempotency-Key` (§8.1) since each has a real side effect.

### 11.1 `POST /matches/{matchId}/sign-off`

*Trace:* `FR-106`, `BR-005/007`, `CMD-SIGN-OFF-MATCH`.
*Authz:* Head Scorer on `matchId` (§3.2).

**Request:** `{ asOfEventOrdinal: numeric, overrideReason: text|null }` — `overrideReason` required iff the caller is knowingly overriding a reconciliation failure (`BR-007`); omitting it while reconciliation fails is `422 reconciliation/blocked` naming the specific failing `INV-*` checks.
**Response `201`:** the new `sign_offs` row (`data-specification.md §8.1`): `{ id, matchId, version, signedBy, reconciliationState, signedAt }`.
**Errors:** `422 reconciliation/blocked` (no override supplied); `409 state/invalid-transition` (match not in a signable state, or `asOfEventOrdinal` is behind the server's current view — re-pull and retry); `403` (not Head Scorer on this match).
**Note:** this endpoint is a *materialisation trigger* over the already-synced `match_events` — it re-runs `SVC-RECONCILER`/`SVC-RESULT-DERIVER` server-side (`system-architecture.md §4.5`'s `signoff` function) and does not itself carry ball-by-ball content; the underlying sign-off *fact* is also recorded as a domain event via §12's sync path when the client is offline (`OFF-002/018`) — this endpoint is the **online-triggered** variant, used when the client is connected at the moment of signing; the offline path produces an equivalent event that this same server logic processes on ingest.

### 11.2 `POST /matches/{matchId}/counter-sign` *(V2)*

*Trace:* `FR-107`, `CMD-COUNTER-SIGN-MATCH`.
*Authz:* Assistant Scorer or assigned Umpire on `matchId`.
**Request:** `{ signOffVersion: integer }`. **Response `200`:** the updated `sign_offs` row with `counterSignatures` appended. **Errors:** `409 state/invalid-transition` if `signOffVersion` is no longer current.

### 11.3 `POST /organizations/{orgId}/memberships/{membershipId}/deactivate`

*Trace:* `FR-009`, `BR-024`, `CMD-DEACTIVATE-MEMBER`.
*Authz:* Org-admin.
**Request:** `{}` (no body fields — the action is the whole request). **Response `200`:** the membership with `status=DEACTIVATED`. **Note:** deliberately a dedicated endpoint, not a `PUT` field edit (§10.2), so deactivation is always an explicit, auditable act, never an incidental side effect of an unrelated update.

### 11.4 `POST /matches/{matchId}/dispute` and `POST /matches/{matchId}/dispute/adjudicate`

*Trace:* `FR-112`, `BR-016`, `CMD-LOCK-MATCH-FOR-DISPUTE` / `CMD-ADJUDICATE-DISPUTE`.
*Authz:* Org-admin.
**Lock request:** `{ reason: text }`. **Response `200`:** `matches.state` transition reflected; scoring writes to this match are refused (`409 state/invalid-transition`) until adjudicated.
**Adjudicate request:** `{ ruling: text, resultingCorrections: [uuid]|null }` — an optional list of `match_events` correction event ids the adjudication authorises (processed through §12's normal correction path, not created here). **Response `200`:** the match unlocked, `audit_log` entry created (`data-specification.md §10.1`, `category=DISPUTE`).

### 11.5 `POST /organizations/{orgId}/invitations` and `POST /invitations/{token}/accept`

*Trace:* `FR-008`, `CMD-INVITE-MEMBER`.
*Authz (send):* org-admin. *Authz (accept):* authenticated as the invited email, or triggers §11.10's sign-up flow first if the invitee has no account yet.
**Send request:** `{ email: text, roles: text[], expiresAt: timestamptz }`. **Response `201`:** `{ id, token, expiresAt }` (token delivered out-of-band by email, not returned to a caller other than the inviter in a UI-visible form — the response here is for the sending admin's confirmation view).
**Accept request:** `{}` (token is the path parameter). **Response `200`:** the new `memberships` row. **Errors:** `410 Gone` (a distinct, explicit status for an expired invitation, not folded into `404`, since the two cases warrant different user-facing copy per `docs/ux/ux-specification.md UX-02`).

### 11.6 `POST /players/{playerId}/merge`

*Trace:* `FR-039/040`, `BR-044`, `CMD-MERGE-PLAYERS`.
*Authz:* Org-admin or platform-admin.
**Request:** `{ losingPlayerId: uuid, reason: text }` — `playerId` in the path is the **surviving** id. **Response `200`:** the surviving player row; the losing player's row now has `status=MERGED, merged_into_player_id={playerId}` (`data-specification.md §4.2`). **Errors:** `422 validation/business-rule` if the losing player has appearances that would conflict (overlapping matches on the same date needing manual review, `system-architecture.md §4.5` note) — surfaced with the specific conflicting matches listed, never silently merged through.

### 11.7 `POST /matches/{matchId}/claim`

*Trace:* `FR-004`, `BR-022`, `CMD-CLAIM-GUEST-MATCH`, `EVT-GUEST-MATCH-CLAIMED`.
*Authz:* Authenticated user; no prior role required (claiming *establishes* the role — the claimant becomes the match's owner).
**Request:** `{ organizationId: uuid|null }` — null claims it as a personal (non-org) match owned by the user alone. **Response `200`:** the updated `matches` row with `claim_status=CLAIMED`, `organization_id` set. **Note:** this is the one write in this section that is **also** representable purely as a synced event (`EVT-GUEST-MATCH-CLAIMED` via §12) when the claiming device is the same one that scored the match offline and is simply reconnecting — this REST form exists for the case of claiming *from a different device* than the one that scored it (e.g. claiming via the web after scoring on Android), where there is no local event stream to sync from.

### 11.8 `POST /appearance-claims` and `POST /appearance-claims/{id}/approve` *(V2)*

*Trace:* `FR-152`, `BR-014`, `CMD-CLAIM-APPEARANCE` / `CMD-APPROVE-APPEARANCE-CLAIM`.
*Authz (create):* the claiming player's own user account. *Authz (approve):* org-admin.
**Create request:** `{ playerId: uuid, matchId: uuid }`. **Response `201`:** `{ id, status: 'PENDING' }`.
**Approve request:** `{}`. **Response `200`:** `{ id, status: 'APPROVED' }` — only from this point does the appearance count toward career aggregates (`MINV-17`).

### 11.9 `POST /users/me/export` and `DELETE /users/me`

*Trace:* `FR-010/011`, `BR-025`, `NFR-032`, `AUD-014`.
*Authz:* the user themselves only.
**Export response `202`:** `{ exportId }` (an async job, tracked via §15.2 — personal-data export reuses the same export-job mechanism as a match scorecard export). **Delete response `202`:** `{ status: 'PROCESSING' }` — deletion is asynchronous (anonymisation across every `actor_ref` this user has, `data-specification.md §3.1`'s `anonymized_at`); the account is unusable immediately, but the anonymisation sweep completing is eventually-consistent, communicated to the user by email on completion, not by polling this endpoint.

### 11.10 Auth endpoints

*Trace:* `FR-002/003/012`, `SEC-002`.

| Method + path | Request | Response | Auth |
|---|---|---|---|
| `POST /auth/sign-up` | `{ email, password, displayName, inviteToken? }` | `201 { userId }` + verification email sent | None |
| `POST /auth/sign-in` | `{ email, password }` | `200 { accessToken, refreshToken, expiresIn }` | None |
| `POST /auth/sign-in/magic-link` | `{ email }` | `202` (email sent) | None |
| `POST /auth/refresh` | `{ refreshToken }` | `200 { accessToken, refreshToken, expiresIn }` | Refresh token |
| `POST /auth/sign-out` | `{}` | `204`, revokes the refresh token server-side | Bearer |
| `POST /auth/password-reset/request` | `{ email }` | `202` (always — never reveals whether the email exists) | None |
| `POST /auth/password-reset/confirm` | `{ token, newPassword }` | `200` | None |
| `POST /auth/mfa/enroll` / `POST /auth/mfa/verify` | provider-specific TOTP payload | `200` | Bearer (enroll); None (verify, part of sign-in) |

---

## 12. Sync endpoints (event-sourced protocol)

The **exact behavior** of every endpoint in this section — batch composition, ordering, acknowledgment semantics, retry classification, conflict detection — is fully specified in `offline-first-specification.md §7–§11` and is not restated here; this section fixes only the **wire contract** those rules operate over.

### 12.1 `POST /sync/events` — push

*Trace:* `SYNC-001…008`, `OFF-003/006/015`, `CMD-RECORD-DELIVERY` and every other `CMD-*` that produces a `match_events` row (`live-scoring.md §16`), `offline-first-specification.md §7.1`.
*Authz:* Head/Assistant Scorer on the match owning `matchId` (§3.2), checked per-event against `scorer_stream_id`.

**Request:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `matchId` | `uuid` | yes | |
| `scorerStreamId` | `uuid` | yes | |
| `deviceId` | `uuid` | yes | |
| `fenceValue` | `bigint` | yes | This device's believed-current writer-fence value (§12.3) |
| `events` | array, ≤ `[DEFAULT] 200` | yes | Each element is exactly `live-scoring.md §16.2`'s `EVT-*` shape: `{ eventId, deviceSeq, hlc, eventOrdinal, type, eventVersion, payload, supersedes?, voids?, actorRef, provenance, recordedAt, prevHash, hash }` |

**Response `200`** (note: `200` even when some events are rejected — the batch call itself succeeded; per-item outcomes carry the real result, per `offline-first-specification.md §7.2`'s "no HTTP-level acknowledgment shortcut" rule):

| Field | Type | Notes |
|---|---|---|
| `results` | array, same length/order as `events` | Each: `{ eventId, outcome: 'ACCEPTED'|'REJECTED', newHighWaterSeq?, errorCode?, errorDetail? }` — `errorCode` is one of §5.2's `sync/*` codes |
| `confirmedThroughSeq` | `bigint` | The contiguous-prefix watermark (`offline-first-specification.md §7.1` step 4) — the client advances its outbox exactly to here, never further |

**Errors (batch-level, before any per-event processing):** `401`/`403` (auth); `400` (malformed batch shape); `429` (rate-limited). **Per-event errors** are carried in the `results` array, not as HTTP-level errors, by design — a partially-accepted batch is a normal `200`, not a `207 Multi-Status` or an HTTP error, to keep client handling uniform (always inspect `results`, never branch on HTTP status for this endpoint beyond the batch-level cases).

### 12.2 `GET /sync/changes` — pull

*Trace:* `SYNC-001/004`, `OFF-007/021`, `QRY-STREAM-CHANGES` *(derived — no discovery-level requirement names the pull shape specifically; synthesised to realise `OFF-007`'s "access previously loaded... data while offline" once reconnected)*.
*Authz:* as §12.1; additionally, a caller may only request streams they are entitled to read (their own prior sessions, or — dual-scorer — the other scorer's stream on a match they are also assigned to, or — organizer/viewer contexts — the server-materialised projection only, never a raw stream they aren't a scorer on).

**Request (query params):** `matchId` (required), `streamId` (optional — omit to receive every stream this caller may read on the match), `since` (opaque cursor, omit for the first pull), `limit` (`[DEFAULT] 500` events).
**Response `200`:** `{ events: [...same shape as §12.1's array...], nextCursor: string|null, hasMore: boolean }` — keyset-paginated exactly per §6, specialised to the event stream.
**Errors:** `403` (requesting a stream not entitled to read — never silently filtered, always an explicit error so a client bug is visible); `400` (malformed cursor).

### 12.3 `POST /sync/fence` — writer-fence acquire/renew

*Trace:* `SYNC-*` (substrate), `offline-first-specification.md §7.6/§10.1/§11.1`, `CMD-ACQUIRE-WRITER-FENCE`.
*Authz:* Head/Assistant Scorer on the match.

**Request:** `{ matchId: uuid, scorerStreamId: uuid, deviceId: uuid }`.
**Response `200`:** `{ fenceValue: bigint, heldByDeviceId: uuid, grantedAt: timestamptz }` — `heldByDeviceId` always echoes the **caller's** `deviceId` on success (a successful call always grants/renews *to the caller*; it never merely reports someone else's lease — querying who currently holds it, for the take-over UI, is a separate read, §12.4).
**Errors:** none in the ordinary sense — acquiring a fence always succeeds for an authorised caller (it forcibly invalidates any prior holder, per `offline-first-specification.md §7.6`); the *consequence* of having done so (the previous holder's next push failing with `sync/stale-fence`) is where the conflict actually surfaces, on that other device's own subsequent §12.1 call.

### 12.4 `GET /matches/{matchId}/fence-status`

*Trace:* supports `docs/ux/ux-specification.md UX-25`'s fence-conflict UI *(derived)*.
*Authz:* Head/Assistant Scorer on the match.
**Response `200`:** `{ scorerStreamId, fenceValue, heldByDeviceId, grantedAt }` per stream on the match — a read-only view of current lease state, used to render "another device is scoring this match" before the caller attempts (and would be rejected on) a push.

---

## 13. Event endpoints

Deliberately distinct from §12: **sync** endpoints move raw events between a device and the server as part of the durability/convergence mechanism; **event endpoints** are read-only, human/UI-facing ways to *browse* the already-synced history, plus the outbound mechanism for **integration events** (a different, coarser event plane, `system-architecture.md §3.11`) reaching external consumers.

### 13.1 `GET /matches/{matchId}/events` — raw event/ball-by-ball browse

*Trace:* `AUD-013`, `docs/ux/ux-specification.md UX-21`, `QRY-DELIVERY-LOG` *(derived from the domain model's read-side `QRY-*` catalogue, `docs/domain/domain-model.md §11`)*.
*Authz:* any member with read access to the match (§3.2), or a valid share token scoped to it.
**Request (query params):** `overFrom`/`overTo`, `bowlerId`, `batterId`, `type_in` (filter to specific `EVT-*` types), plus §6's keyset pagination.
**Response `200`:** `{ items: [...match_events rows, minus prevHash/hash which are integrity-internal, not user-facing...], nextCursor, hasMore }`.
**Note:** this reads the **active** event set only (`MINV-02`) by default; superseded/voided events are visible only via §13.2's full audit trail, not here — this endpoint mirrors the linear scoresheet (`UX-21`), the audit trail mirrors the full corrections history (`UX-17`).

### 13.2 `GET /matches/{matchId}/audit-trail`

*Trace:* `AUD-004/013`, `QRY-AUDIT-TRAIL`.
*Authz:* Head/Assistant Scorer, org-admin, or platform-admin on the match's organization — **not** a general viewer/share-token (the audit trail exposes actor identity and correction reasons, a narrower audience than the public scorecard).
**Request:** §6 pagination; `includeSuperseded=true|false` (`[DEFAULT] true` — this is precisely the endpoint where superseded events matter).
**Response `200`:** `{ items: [{ event, supersededBy?, voidedBy?, actor: {displayName, deviceModel, appVersion}, reasonIfAny }], nextCursor, hasMore }` — the human-readable who/what/when/before→after view (`UX-17`'s cascade summary, `UX-24`'s "why did this change" link both read from here).
**Also:** `GET /matches/{matchId}/audit-trail/export` — same authz, returns a signed download URL for a full JSON + rendered-PDF export (`AUD-013`), following the async-export pattern in §15.2 rather than a synchronous large payload.

### 13.3 `GET /matches/{matchId}/reconciliation-reports`

*Trace:* `AUD-006`, `QRY-RECONCILIATION-HISTORY`.
*Authz:* as §13.2.
**Response `200`:** `{ items: [data-specification.md §8.2's reconciliation_reports rows], nextCursor, hasMore }` — every interval checkpoint and sign-off report, in order.

### 13.4 Webhooks *(V2 — integration events)*

*Trace:* `FR-177/178` (`(derived)` — the SRS names a read API/realtime channel; webhooks are the push-delivery complement for consumers who can't poll), `system-architecture.md §3.11`'s transactional outbox, `EVT-*` → integration-event mapping (`MatchFinalised`, `AppearanceClaimApproved`, `StandingsRecomputed`, `ShareLinkRevoked`).

| Method + path | Purpose | Request | Response |
|---|---|---|---|
| `POST /organizations/{orgId}/webhooks` | Register a webhook | `{ url, eventTypes: text[], secret }` | `201 { id, url, eventTypes }` |
| `GET /organizations/{orgId}/webhooks` | List | §6 pagination | `200 { items, nextCursor, hasMore }` |
| `DELETE /organizations/{orgId}/webhooks/{id}` | Deregister | — | `204` |
| `POST /organizations/{orgId}/webhooks/{id}/test` | Send a synthetic test delivery | `{}` | `202` |

*Authz:* org-admin. **Delivery contract** (outbound, not an endpoint of this API but its counterpart): each delivery is `POST`ed to the registered `url` with body `{ id, eventType, occurredAt, payload }`, HMAC-signed over the raw body using the registered `secret` (header `X-Webhook-Signature`), retried with the same transient/terminal classification and backoff as §8/`offline-first-specification.md §8`, and carries an idempotency `id` the receiver should dedupe on — **at-least-once** delivery, exactly mirroring the outbox dispatcher's own guarantee (`ADR-09`), never exactly-once at the transport level (the receiver's own idempotent handling closes that gap, same principle as §8.2).

---

## 14. Scoring output endpoints

*Trace:* `FR-112…122/138`, `QRY-SCORECARD-AT`, `QRY-LIVE-STATE`.
*Authz:* member with read access, or a valid share token; the viewer (§14.4) needs neither.

| Method + path | Purpose | Response shape |
|---|---|---|
| `GET /matches/{matchId}/scorecard` | Full scorecard (both innings) | `{ innings: [{ battingCard: [batter_card_lines], bowlingCard: [bowler_card_lines], extras, fallOfWickets: [wickets], partnerships }], result, reconciliationStatus, asOfEventOrdinal }` — sourced from the read model (`data-specification.md §7`), not a raw event replay per request |
| `GET /matches/{matchId}/scorecard?asOf={ordinal}` | A historical scorecard state at a specific point (`QRY-SCORECARD-AT`) | Same shape, computed as of that ordinal |
| `GET /matches/{matchId}/ball-by-ball` | The rendered linear sheet (distinct from §13.1's raw event browse — this is pre-formatted for display, e.g. commentary text composed in) | `{ overs: [{ overNumber, bowler, deliveries: [...] }], nextCursor, hasMore }`, keyset-paginated by over |
| `GET /matches/{matchId}/live` | The hot `live_state` projection (`data-specification.md §5.1`'s note on `matches.state` plus current score) for a live-updating viewer | `{ score, wickets, overs, striker, nonStriker, bowler, runRate, requiredRunRate, target, dlsPar?, lastUpdated }` |

### 14.4 `GET /viewer/{token}` — the public share-link surface

*Trace:* `FR-137/138`, `BR-023`, `SEC-009`.
*Authz:* the token alone (§2.3); **no** account, **no** organization context.
**Response `200`:** the same shape as `GET /matches/{matchId}/live` plus a static `GET /viewer/{token}/scorecard` for the full card — both served from `match_snapshots`/`live_state` exclusively (never raw `match_events`, so a viewer never sees more than the match's owner intended to publish). **Errors:** `404` for an unknown or **revoked** token — identical response in both cases, deliberately (§5.2's not-found-indistinguishability principle, applied here specifically so a revoked link cannot be distinguished from one that never existed).

## 15. Export endpoints

*Trace:* `FR-143…146/149/150`, `OFR-010`, `NFR-030` (rate-limited — exports are comparatively expensive).

### 15.1 `POST /matches/{matchId}/exports`

*Authz:* member with read access to the match.
**Request:** `{ format: 'PDF'|'CSV'|'CRICSHEET', includeBranding: boolean }` (`Idempotency-Key` required, §8.1).
**Response `202`:** `{ exportId, status: 'QUEUED' }` — always asynchronous, even for a small match, so the contract is uniform regardless of size (`system-architecture.md AQ-10`).

### 15.2 `GET /exports/{exportId}`

**Response `200`:** `{ exportId, status: 'QUEUED'|'PROCESSING'|'READY'|'FAILED', downloadUrl?: text, expiresAt?: timestamptz, failureReason?: text }` — `downloadUrl` is a short-lived signed Storage URL, present only when `status=READY`. Polled or, if the client is online, pushed via the realtime channel (`system-architecture.md §3.4`) as a nudge to re-check.

## 16. Sharing endpoints

*Trace:* `FR-137`, `BR-023`, `SEC-009`.
*Authz:* the match's owner (Head Scorer or org-admin).

| Method + path | Purpose | Request | Response |
|---|---|---|---|
| `POST /matches/{matchId}/share-links` | Create | `{}` (`Idempotency-Key` required) | `201 { id, url, createdAt }` — the token itself is high-entropy and appears only in `url`, never echoed separately |
| `GET /matches/{matchId}/share-links` | List active links for a match | §6 pagination | `200 { items: [{id, createdAt, revokedAt}], nextCursor, hasMore }` |
| `DELETE /matches/{matchId}/share-links/{id}` | Revoke | — | `204` — takes effect immediately; §14.4 starts returning `404` for that token on the very next request |

## 17. Admin & platform endpoints

*Trace:* `FR-159…162`, `ADM-*`, `SEC-011/018`.
*Authz:* platform-admin + MFA (§3.2); impersonation additionally requires stored consent.

| Method + path | Purpose | Request | Response |
|---|---|---|---|
| `POST /admin/impersonate` | Start a support-impersonation session | `{ subjectUserId, reason }` | `201 { impersonationToken, expiresAt }` — every subsequent call bearing this token is double-attributed in `audit_log` (`data-specification.md §10.1`) automatically, not by the caller remembering to tag it |
| `DELETE /admin/impersonate` | End the session early | — | `204` |
| `GET /admin/feature-flags` / `PUT /admin/feature-flags/{key}` | Read/toggle a flag | `{ value, scope }` | `200` |
| `POST /admin/reference-data` | Publish a new `reference_data` version | `{ kind, payload }` | `201 { kind, version }` — always a new version, never an overwrite (`data-specification.md §5.4`) |
| `GET /admin/tenants` | List organizations (platform view) | §6/§7 | `200 { items, nextCursor, hasMore }` |
| `POST /admin/rollout` | Staged-rollout / rollback control | `{ target, percentage }` \| `{ rollbackToVersion }` | `202` |

## 18. Public read API *(V2)*

*Trace:* `FR-177/179`, `NFR-052`, `SEC-017`.
*Authz:* API key (§2.1), scoped to one organization's public, non-disputed, Final-match data only — this surface never exposes a guest match, a provisional (pre-sign-off) match, or anything RLS would otherwise hide from an anonymous caller.

| Method + path | Purpose |
|---|---|
| `GET /api/v1/matches/{matchId}` | Public match summary (Final matches only) |
| `GET /api/v1/matches/{matchId}/scorecard` | As §14, read-only, rate-limited harder than the authenticated equivalent |
| `GET /api/v1/competitions/{competitionId}/standings` | Public standings |
| `GET /api/v1/players/{playerId}` | Public profile (redacted for minors, `SEC-013`) |

Identifiers returned here are the **stable external ids** (`NFR-052`) — the same `uuid` primary keys used internally, guaranteed never to be renumbered across releases (`data-specification.md §1.3`'s identity strategy is precisely what makes this promise keepable).

---

## 19. Traceability

### 19.1 Endpoint group → requirement cluster

| Endpoint group | SRS requirements | Domain capability |
|---|---|---|
| §2–§9 (cross-cutting: auth, authz, validation, errors, pagination, filtering, idempotency, versioning) | `SEC-001…018`, `SYNC-005/008`, `NFR-030/052` | `SVC-AUTHORIZER`; no single `CMD`/`QRY` — these are contract-wide properties |
| §10 Generic CRUD | `FR-005…041`, `FR-016…029`, `FR-123/124/141` | `CMD-CREATE-*`/`CMD-CONFIGURE-*` family |
| §11 Match lifecycle commands | `FR-004/008/009/039/040/106/107/112/152`, `BR-005/007/016/022/024/044` | `CMD-SIGN-OFF-MATCH`, `CMD-CLAIM-GUEST-MATCH`, `CMD-MERGE-PLAYERS`, `CMD-*-DISPUTE`, `CMD-INVITE-MEMBER` |
| §12 Sync | `SYNC-001…016`, `OFF-003/006/007/015/021` | Every `CMD-*` that yields a `match_events` row; `MINV-03/14` |
| §13 Event endpoints | `AUD-004/006/013`, `FR-177/178` | `QRY-AUDIT-TRAIL`, `QRY-RECONCILIATION-HISTORY`, `QRY-DELIVERY-LOG` |
| §14 Scoring outputs | `FR-112…122/137/138` | `QRY-SCORECARD-AT`, `QRY-LIVE-STATE` |
| §15 Exports | `FR-143…146/149/150` | `SVC-EXPORT-TRANSLATOR` |
| §16 Sharing | `FR-137`, `BR-023`, `SEC-009` | — |
| §17 Admin/platform | `FR-159…162`, `ADM-*`, `SEC-011/018` | — |
| §18 Public API | `FR-177/179`, `NFR-052`, `SEC-017` | — |

### 19.2 Requirements with **no** dedicated endpoint (by design)

The largest single cluster: `FR-042…072` (live ball-by-ball scoring — every individual scoring action), `FR-059/061/062` (guardrail override, undo, redo), `FR-097…105` (correction), `FR-078…094` (interruptions, DLS revisions), `FR-095…099` (Super Over) — **none of these has a bespoke endpoint.** Each is a local command against the shared scoring core (`live-scoring.md §5–§15`), and reaches the server **only** as one or more rows in a §12.1 push batch. Building a per-action endpoint for any of these would mean re-implementing `live-scoring.md`'s validation and state-transition rules a second time at the API layer — exactly the duplication this architecture is designed to avoid.

---

## 20. Open items

| # | Item | Current default | Resolution path |
|---|---|---|---|
| APQ-1 | Exact contract-version string/scheme (`/api/v1` vs. a header-based scheme) | Path-based `/api/v{n}` (§9.1) | Confirm against the chosen API gateway's conventions during implementation |
| APQ-2 | Whether `GET /sync/changes` should support a `streamId_in` (multiple specific streams in one call) rather than only "all streams" or "one stream" | Two-mode only, per §12.2 | Revisit if dual-scorer (P2) client profiling shows the extra round trips matter |
| APQ-3 | Rate-limit thresholds per endpoint class (`SEC-010`, `NFR-030`) | Not numerically specified in this document | Backend + security, informed by pilot load data (`system-architecture.md §3.17`) |
| APQ-4 | Whether the competitions/fixtures resources (§10.2) need bespoke recompute-trigger endpoints beyond the generic CRUD pattern, once V2 scope is firmed up | Assumed the generic pattern suffices; standings recompute itself is server-triggered by the outbox (`system-architecture.md §3.11`), not client-invoked | Revisit when `docs/roadmap/product-roadmap.md`'s Version 2 competitions work begins |
| APQ-5 | Whether personal-data export (§11.9) should have its own endpoint family distinct from match export (§15), now that both share the async-job pattern | Deliberately unified under one export-job mechanism | Revisit only if the two diverge materially (e.g. different retention/authz needs emerge) |

---

## 21. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-22 | Initial API specification. §1 endpoint taxonomy (generic CRUD / match-lifecycle command / sync / event / output-export-sharing-admin-public) and the asymmetric traceability rule (every endpoint traces to a requirement; not every requirement has an endpoint). §2–§3 authentication mechanisms and the three-layer authorization enforcement model, each with a per-endpoint-kind requirement table. §4 the three validation layers (schema/business-rule/state-dependent) mapped to `400`/`422`/`409` precisely. §5 RFC 7807 error shape and a canonical error-code registry spanning both ordinary API errors and the sync-specific conflict codes from `offline-first-specification.md`. §6–§7 keyset pagination (never offset) and a fixed filter-operator vocabulary. §8 two idempotency mechanisms matched to the two sync models (`event_id` vs. `Idempotency-Key`), with precise replay semantics. §9 three distinct "version" concepts disambiguated (API contract / event schema / row optimistic-concurrency) and a compatibility/deprecation policy. §10 the generic CRUD-resource pattern (one spec, `GET`/`GET`/`PUT`/`DELETE`, client-supplied ids) applied to 11 resources, avoiding dozens of near-duplicate endpoint specs. §11 ten match-lifecycle command endpoints with full request/response schemas (sign-off, counter-sign, deactivation, dispute, invitations, player merge, guest-match claim, appearance claims, account export/deletion, auth). §12 the formal wire contract for the sync protocol (push/pull/fence), cross-referencing rather than re-deriving `offline-first-specification.md §7`'s behavior. §13 event endpoints — explicitly distinguished from sync: read-only ball-by-ball/audit-trail/reconciliation browsing, plus V2 outbound webhooks for integration events with their own delivery contract. §14–§18 scoring outputs, the public viewer, exports, sharing, admin/platform, and the V2 public read API. §19 consolidated traceability including an explicit list of requirement clusters that deliberately have no dedicated endpoint. §20 five open items. No implementation — no OpenAPI/YAML, no route-handler code, no literal request/response JSON. |

