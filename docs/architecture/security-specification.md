# Cricket Scoring Book — Security Specification

| | |
|---|---|
| **Document** | Security Specification |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-22 |
| **Upstream** | `docs/specs/software-requirements-specification.md` v0.1.0 (`SEC-001…018`, `OFF-*`, `SYNC-*`, `AUD-001…015`) · `docs/architecture/system-architecture.md` v0.1.0 (§3.8/3.9/3.15, threat→control map) · `docs/architecture/api-specification.md` v0.1.0 (§2–§5) · `docs/architecture/data-specification.md` v0.1.0 · `docs/architecture/offline-first-specification.md` v0.1.0 · `docs/specs/live-scoring.md` v0.1.0 (§17) · `docs/foundation/product-foundation.md` v0.1.0 (§4 roles, §10 risk 15/16) |
| **Downstream** | Security review process (`security-review` skill), penetration-test scope, the shared scoring core's auth/authz adapters |
| **Status** | Security requirements and acceptance criteria, plus a threat model. **No implementation.** Extends, and does not renumber or contradict, the SRS's existing `SEC-001…018`/`AUD-001…015` — this document's own `SR-XXX` catalog is the detailed specification those summary-level requirements are drawn from; cross-referenced throughout rather than restated where already complete. |

> Governing principle, restated from `system-architecture.md §1.2`/`A-10`: this system holds **low-sensitivity, high-integrity** data — a wrong or tampered scorecard does far more damage than a leaked one. Every control below is weighted accordingly: authorization, tamper-evidence, and attribution are treated as the primary security surface; confidentiality controls are present, standard, and never skipped, but are not where this specification's engineering effort concentrates.

---

## 1. Purpose, scope, and method

### 1.1 Relationship to prior documents

| Already fully specified elsewhere | This document's role |
|---|---|
| RLS as the hard authorization boundary, the three-layer enforcement model | Cross-referenced (§4); not re-derived |
| The append-only, hash-chained `match_events`/`audit_log` tamper-evidence mechanism | Cross-referenced (§11); this document adds the security-specific acceptance criteria (verification cadence, alerting) |
| The event/sync validation pipeline (`live-scoring.md §5`, `offline-first-specification.md §5`) | Cross-referenced (§9) as the input-validation security control |
| `SEC-001…018` (SRS) | Each is either elaborated into several `SR-*` requirements here, or cited directly where already sufficient — never contradicted |

**Genuinely new ground covered here, not previously detailed:** the full role/permission matrix (§4.2), session and token lifecycle specifics (§5–§6), concrete encryption and local-device controls (§7–§8), numeric rate-limit tiers (§10), backup security (§13), the security dimension of device/account recovery (§14), and a formal threat model (§2).

### 1.2 Requirement ID scheme and template

`SR-XXX`, clustered by domain (A–L, §3–§14). Every requirement carries the same six fields as the SRS (`software-requirements-specification.md §1.5`): **Description**, **Rationale**, **Priority** (`MoSCoW · Phase`), **Dependencies**, **Trace**, **Acceptance criteria** (Given/When/Then). Tags, reused from `live-scoring.md §1.3`'s spirit: `[INVARIANT]` (non-negotiable), `[DEFAULT]` (a specific tunable parameter, stated as the working value), `[POLICY]` (a deliberate choice among alternatives), `[OPEN]` (unresolved, needs a decision).

### 1.3 Data classification

| Class | Examples | Primary controls |
|---|---|---|
| **Public** | Final-match scorecards via a share link or the V2 public API, published standings | Integrity + availability controls; no confidentiality control needed by definition |
| **Internal** | In-progress/provisional match data, org rosters, competition config | Tenant isolation (RLS), authenticated access |
| **Restricted** | Audit trail detail, reconciliation reports, override reasons | Role-gated read (§4), never on the public surface |
| **Sensitive personal data** | Email, DOB, minors' data, guardian links | Access-controlled, redacted in public views, subject to the privacy requirements (§12) |
| **Secrets** | Passwords (never stored, only hashed by the auth provider), tokens, API keys, webhook secrets, the service-role key | Never logged, never in a client bundle, rotation-capable (§6) |

---

## 2. Threat model

### 2.1 Asset inventory

| Asset | Why it matters |
|---|---|
| Ball-by-ball scoring data (`match_events`) | The product's core integrity promise; tampering or loss is the top business risk (`foundation` risk 1/15) |
| Audit trail (`audit_log`, event provenance) | The mechanism that makes every other guarantee checkable; its own compromise is catastrophic to trust |
| Authentication credentials and tokens | Compromise here cascades into every other control |
| Personal data (names, email, DOB, photos) | Legal (GDPR-class) and reputational exposure, elevated for minors |
| Local device storage (event log, cached session, local backups) | Physically accessible to whoever holds the device |
| Backend infrastructure (service-role key, database) | A single point of total compromise if exposed |
| Share-link tokens and API keys | Unauthorized-access vector if guessable or leaked |
| Export files and backup archives | Portable copies of otherwise access-controlled data |

### 2.2 Trust boundaries

Reused verbatim from `system-architecture.md §3.15` (B1–B10) — not re-derived here. Each is revisited below only for its STRIDE profile.

### 2.3 STRIDE analysis by boundary

| Boundary | Primary threats | Mitigation | Residual risk |
|---|---|---|---|
| **B1** Device store ↔ app | **T**ampering (a rooted/jailbroken device edits local storage to fabricate a scoring fact before it syncs); **I**nformation disclosure (device theft exposes cached session/match data) | OS sandbox + file encryption; local hash-chain verification on load (§7, §8); server independently re-validates and re-hashes on ingest, never trusting a client assertion (`offline-first-specification.md §17.3`); offline session grace is time-bounded (§5) | A sophisticated on-device attacker with valid scorer credentials could fabricate a *plausible* event the schema/hash-chain checks alone cannot distinguish from genuine — the true backstop here is human reconciliation (dual-scorer comparison, sign-off review), not a purely technical control. Stated honestly, not engineered away. |
| **B2** Client ↔ Backend | **S**poofing (forged/replayed token); **T**ampering (modified request body); **D**enial of service | TLS-only (§7); JWT signature verification (§6); full server-side re-validation of every event regardless of client validation (§9); rate limiting (§10) | Standard network-layer risk, bounded by TLS + token expiry |
| **B3** Auth boundary | **S**poofing (credential stuffing, brute force); **R**epudiation (denying an action) | Rate-limited/backoff sign-in (§3), MFA for admin (§3), every write attributed and hash-chained (§11) closes repudiation structurally | Password-reuse-across-services risk is outside this system's control; mitigated by encouraging (not yet mandating) MFA broadly |
| **B4** API/Edge ↔ Postgres (RLS) | **E**levation of privilege (an application-code bug attempts to read/write outside intended scope) | RLS is the **hard** boundary, independent of application-code correctness — the entire reason it exists (`system-architecture.md ADR-04`) | A `SECURITY DEFINER` helper function with a logic error is the one class of bug RLS itself cannot catch — mitigated by keeping that surface minimal and reviewed (§4.4) |
| **B5** Tenant ↔ tenant | **I**nformation disclosure (cross-organization data leak) | `organization_id` RLS on every tenant-scoped row; no cross-tenant joins in any client-reachable view | — |
| **B6** Realtime channel | **S**poofing (unauthorized channel join); **I**nformation disclosure (raw events leaked to an unauthorized viewer) | Channel-join authorization check against membership or a valid share token; viewers receive redacted projections, never raw `match_events` | — |
| **B7** Public/anon surface (share links, V2 public API) | **I**nformation disclosure (token guessing/enumeration); **D**enial of service (scraping) | High-entropy, unguessable tokens (§10.3); rate limiting; `404`-indistinguishable-from-revoked responses (`api-specification.md §5.2/§14.4`) | — |
| **B8** Admin/platform plane | **E**levation of privilege (a compromised admin account); **R**epudiation (an unaudited admin action) | MFA required (§3.4); consented + double-attributed impersonation (§4.5); every admin action audited (§11) | A compromised platform-admin session with a live MFA-authenticated bearer token is the single highest-impact compromise in this system — see the risk register (§2.4) |
| **B9** Backups/exports store | **I**nformation disclosure (exfiltration of an entire historical dataset in one file) | Separate credentials, separate region/account, encryption at rest, access logging (§13) | — |
| **B10** CI/CD & secrets | **T**ampering (supply-chain — a malicious dependency or compromised build); **I**nformation disclosure (a leaked service-role key) | No client-side service keys; secrets manager; SBOM + build provenance; dependency scanning (`technology-stack.md ADR-T11`) | Standard supply-chain risk, bounded by the practices cited, never eliminated |

### 2.4 Risk register

Likelihood/Impact carried from `foundation §10` where the risk originates there; new entries scored on the same High/Med/Low scale.

| # | Risk | Likelihood | Impact | Mitigating `SR-*` / prior control | Residual |
|---|---|---|---|---|---|
| R-S1 | Tampered or unauthorized score edits | Low | High | `SR-B01…B05` (RLS, scorer-only writes), `SR-I01…I04` (audit), append-only + hash chain | Low (human-reconciliation backstop, §2.3 B1) |
| R-S2 | Compromised platform-admin session | Low | High | `SR-A04` (MFA), `SR-B08` (impersonation consent), `SR-I02` (admin audit) | Med — a stolen, MFA-authenticated live session remains the highest-impact single compromise; bounded by short session TTL (§5) |
| R-S3 | Leaked service-role key | Low | High | `SR-D07` (no client-side service keys), secrets manager, rotation capability | Low, if rotation is exercised promptly on suspicion |
| R-S4 | Cross-tenant data leak via an RLS policy gap | Low | High | `SR-B05`, pgTAP policy-matrix testing every migration (`technology-stack.md ADR-T12`) | Low |
| R-S5 | Minors' data exposure | Low | Med | `SR-J04/J05` | Low |
| R-S6 | Local device loss/theft exposing cached match/session data | Med | Med | `SR-F01…F03`, `SR-C03` (bounded offline grace) | Med — physical device security is partly outside this system's control |
| R-S7 | Abuse of public share-link/API surface (scraping, enumeration) | Med | Low | `SR-H01…H05` | Low |
| R-S8 | DLS/MCC Laws IP exposure | Low | Med | Licensing gate (`SPK-01/06`), out of this document's scope | — |

---

## 3. Authentication

#### SR-A01 — Transport encryption everywhere
- **Description:** All network traffic between any client and the backend, and between backend components, **shall** use TLS 1.2 or higher (TLS 1.3 preferred); a downgrade attempt **shall** be refused.
- **Rationale:** Baseline confidentiality/integrity in transit; the entry point for every other control. `[INVARIANT]`
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `SEC-001`; `system-architecture.md §3.15 B2`
- **Acceptance:** Given a client attempts a plaintext or TLS<1.2 connection, when it reaches the edge, then it is refused before any application logic runs.

#### SR-A02 — Credential handling delegated to the auth provider
- **Description:** The system **shall not** store or transmit plaintext passwords at any point; credential hashing/storage is the auth provider's responsibility exclusively (`ADR-T08`).
- **Rationale:** Password storage is a specialised, high-consequence problem; delegating it avoids reinventing it. `[INVARIANT]`
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `SEC-002`
- **Acceptance:** Given the application's own code and logs, when audited, then no plaintext password appears anywhere in them, ever.

#### SR-A03 — Brute-force and enumeration resistance on sign-in
- **Description:** Sign-in **shall** be rate-limited per (email, IP) pair with exponential backoff after repeated failures; the failure response for a wrong password and for a non-existent account **shall be identical**.
- **Rationale:** Prevents credential stuffing and account-existence enumeration in one control.
- **Priority:** Must · P1 · **Dependencies:** `SR-H01`
- **Trace:** `api-specification.md §2/§11.10`
- **Acceptance:** Given `[DEFAULT]` 5 failed attempts within 15 minutes, when a 6th is made, then it is rejected with a backoff-until time, and the response body is indistinguishable from a wrong-password response whether or not the email exists.

#### SR-A04 — MFA required for elevated roles
- **Description:** Platform-admin sessions **shall** require an active, verified TOTP second factor; org-admin MFA **should** be offered and encouraged.
- **Rationale:** The admin plane is the single highest-impact compromise target (R-S2). `[INVARIANT]` for platform-admin.
- **Priority:** Must · P1 (platform-admin) / Should · P2 (org-admin) · **Dependencies:** `SR-A02`
- **Trace:** `system-architecture.md §3.9 B8`
- **Acceptance:** Given a platform-admin credential is correct but no verified TOTP is presented, when an admin endpoint is called, then it is refused with `403`.

#### SR-A05 — Magic-link and password-reset tokens are single-use and short-lived
- **Description:** Every out-of-band auth token (magic link, password-reset) **shall** be single-use, expire within `[DEFAULT]` 15 minutes, and be invalidated the instant it is used or superseded by a newer one.
- **Rationale:** Bounds the window a leaked or intercepted email link remains exploitable.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `FR-002/012`, `api-specification.md §11.10`
- **Acceptance:** Given a used or expired token, when presented again, then it is refused, and the failure response does not distinguish "already used" from "expired" from "never existed."

#### SR-A06 — Offline authentication is cryptographically verifiable, not merely cached
- **Description:** The claims snapshot used for offline authorization (`offline-first-specification.md §2.1`) **shall** be signed by the server and verified locally against a shipped public key — never trusted as an unsigned local cache.
- **Rationale:** Without this, a modified local snapshot could grant a device roles/permissions it was never issued, entirely offline and undetectable until the next sync.
- **Priority:** Must · P1 · **Dependencies:** `SR-D01`
- **Trace:** `OFF-013`, `SEC-002`
- **Acceptance:** Given a tampered claims snapshot, when the app verifies its signature on load, then it is rejected and the device falls back to guest-only local capability.

#### SR-A07 — Guest access has no server-side credential surface
- **Description:** Guest scoring **shall** require no credential and **shall** create no server-side identity or exposure until an explicit, authenticated claim occurs (`SEC-016`).
- **Rationale:** Removing the credential surface for the common case removes an entire class of attack against it.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `SEC-016`, `MINV-15`
- **Acceptance:** Given an unclaimed guest match, when queried by any credential whatsoever, then it is not found (§2.3 B7's not-found-indistinguishable pattern applies identically here).

#### SR-A08 — Credential change requires re-proof of the current credential
- **Description:** A password change **shall** require the current password (or an equivalent re-authentication); it **shall not** be possible via a stale session alone.
- **Rationale:** Prevents a hijacked-but-still-valid session from permanently locking out the legitimate owner by changing their password.
- **Priority:** Must · P1 · **Dependencies:** `SR-A02`
- **Trace:** `docs/ux/ux-specification.md UX-27`
- **Acceptance:** Given a valid session with no re-entered current password, when a password-change request is made, then it is refused.

---

## 4. Authorization, Roles & Permissions

### 4.1 Enforcement model (cross-referenced, not re-derived)

Three layers exactly as `system-architecture.md §3.9`/`api-specification.md §3.1` specify: client (advisory only) → `SVC-AUTHORIZER` (command/state checks) → **RLS** (the hard boundary). This document adds the role/permission content those layers enforce.

### 4.2 Role and permission matrix

Fourteen actors: 12 additive, org- or match-scoped roles (`foundation §4`) plus two non-membership access modes. **Additive** means a user's capability set is the union of every role they hold — never a subtraction.

| Capability | Platform Admin | Org Admin | Head Scorer¹ | Assistant Scorer¹ | Umpire¹ | Referee¹ | Captain | Manager | Player | Analyst | Commentator | Competition Organizer | Guest² | Viewer³ |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Score/create a **guest** match | — | — | — | — | — | — | — | — | — | — | — | — | **Y** | — |
| Claim a guest match | — | — | Y (own) | — | — | — | — | — | — | — | — | — | — | — |
| Write `match_events` on match M | — | — | **Y** (if assigned) | **Y** (if assigned) | — | — | — | — | — | — | — | — | Y (own local match) | — |
| Correct/undo on M | — | — | **Y** (if assigned) | **Y** (if assigned) | — | — | — | — | — | — | — | — | Y (own local match) | — |
| Sign off M | — | — | **Y** (if assigned) | — | — | — | — | — | — | — | — | — | Y (own local match) | — |
| Counter-sign M *(V2)* | — | — | — | Y (if assigned) | Y (if assigned) | — | — | — | — | — | — | — | — | — |
| Adjudicate a dispute on M | — | Y | — | — | — | Y (input only, not final ruling) | — | — | — | — | — | — | — | — |
| Read live/final scorecard | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y (own) | **Y** (token-scoped only) |
| Read audit trail / reconciliation reports for M | Y | Y (own org) | Y (if assigned) | Y (if assigned) | — | — | — | — | — | — | — | — | — | — |
| Manage org membership/roles | Y | **Y** | — | — | — | — | — | — | — | — | — | — | — | — |
| Manage org branding/templates | Y | **Y** | — | — | — | — | — | — | — | — | — | — | — | — |
| Manage competition/fixtures | Y | Y | — | — | — | — | — | — | — | — | — | **Y** | — | — |
| Submit/lock a team's Playing XI | — | — | — | — | — | — | **Y** | Y | — | — | — | — | — | — |
| Claim/approve an appearance *(V2)* | Y | Y (approve) | — | — | — | — | — | — | **Y** (claim own) | — | — | — | — | — |
| Merge duplicate players | Y | Y | — | — | — | — | — | — | — | — | — | — | — | — |
| Manage share links for M | — | — | **Y** (owner) | — | — | — | — | — | — | — | — | — | — | — |
| Create an export for M | Y | Y | Y | Y | — | — | — | — | — | Y | Y | — | Y (own) | — |
| Publish reference data (`CFG-REG`, DLS tables) | **Y** | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Toggle feature flags / staged rollout | **Y** | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Impersonate a user (consented) | **Y** | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Register a webhook / API key *(V2)* | — | **Y** | — | — | — | — | — | — | — | — | — | — | — | — |

¹ Match-scoped: the role must be assigned **on that specific match**, not merely held org-wide (`SR-B02`). ² Guest: device-scoped, no account. ³ Viewer: a public share token, no account, no role — capability is exactly what the token exposes, nothing more (`api-specification.md §14.4`).

### 4.3 Requirements

#### SR-B01 — RLS is the enforcement boundary, verified continuously
- **Description:** Every tenant-scoped table **shall** be governed by an RLS policy scoping reads and writes to the caller's organization membership and role; a client or application-code defect **shall not** be able to bypass it.
- **Rationale:** The load-bearing control behind every "Authz" line in every other document. `[INVARIANT]`
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `SEC-004`, `system-architecture.md ADR-04`
- **Acceptance:** Given the pgTAP policy-matrix suite, when run on every migration, then it asserts no row is readable or writable outside the actor's authorized scope, and CI blocks merge on any failure.

#### SR-B02 — Match-scoped roles are distinct from organization-wide roles
- **Description:** Holding an org-wide role **shall not** by itself grant Head/Assistant Scorer capability on any particular match — that requires an explicit assignment (`match_officials`, `data-specification.md §5.3`) on that match specifically.
- **Rationale:** Prevents any org member from writing scoring data on a match they weren't assigned to, even within their own organization.
- **Priority:** Must · P1 · **Dependencies:** `SR-B01`
- **Trace:** `BR-003`, `SEC-006`
- **Acceptance:** Given an org member with no scorer assignment on match M, when they attempt a `match_events` write on M, then it is refused regardless of their other org roles.

#### SR-B03 — Additive-only composition
- **Description:** A user's effective capability set **shall** be exactly the union of every role they hold; no role **shall** ever remove a capability another held role grants.
- **Rationale:** Predictable, auditable permissions — a documented design property, not an emergent one.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `SEC-005`, `foundation §4`
- **Acceptance:** Given a user holding two roles, when their effective permissions are computed, then the result equals the union of each role's individual permission set.

#### SR-B04 — Least-privilege default for new members
- **Description:** A newly accepted org membership **shall** carry zero roles until explicitly assigned; an invitation **shall** carry its pre-assigned role, never a default broad one.
- **Rationale:** New access starts at nothing, not "reasonable defaults" that could be over-broad.
- **Priority:** Must · P1 · **Dependencies:** `SR-B01`
- **Trace:** `FR-007/008`
- **Acceptance:** Given a member who joined with no pre-assigned role, when they attempt any role-gated action, then it is refused until an admin explicitly grants a role.

#### SR-B05 — Cross-tenant isolation
- **Description:** No query path reachable by a client **shall** join or expose data across two organizations.
- **Rationale:** R-S4's direct mitigation. `[INVARIANT]`
- **Priority:** Must · P1 · **Dependencies:** `SR-B01`
- **Trace:** `system-architecture.md §3.15 B5`
- **Acceptance:** Given a request scoped to organization A's token, when it queries any endpoint, then no organization B data appears in the response under any parameter combination.

#### SR-B06 — Guest-to-claimed transition requires authentication and is one-directional
- **Description:** Claiming a guest match **shall** require an authenticated caller and **shall not** be reversible (a claimed match never reverts to guest status).
- **Rationale:** Prevents an unauthenticated actor from ever gaining org-scoped access via a guest match, and prevents ownership ambiguity after claim.
- **Priority:** Must · P1 · **Dependencies:** `SR-A07`
- **Trace:** `BR-022`, `MBR-02`
- **Acceptance:** Given an unauthenticated claim attempt, when made, then it is refused with `401`.

#### SR-B07 — Share-link capability is exactly what the token encodes, nothing more
- **Description:** A share token **shall** grant read-only access to precisely the one match's public projection it was issued for — never write access, never access to another match, never elevation via any request parameter.
- **Rationale:** The public surface's entire security model rests on the token being a complete, non-extensible capability.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `SEC-009`, `BR-023`
- **Acceptance:** Given a valid token for match M, when used against any endpoint for match N or any write endpoint, then it is refused.

#### SR-B08 — Impersonation requires stored consent and is fully double-attributed
- **Description:** Support impersonation **shall** be refused absent a stored, unexpired `impersonation_consents` record; every action taken under impersonation **shall** record both the admin and the impersonated identity.
- **Rationale:** The highest-impact admin capability; must be consented and fully traceable. `[INVARIANT]`
- **Priority:** Must · P1 · **Dependencies:** `SR-A04`
- **Trace:** `SEC-011`, `AUD-007`
- **Acceptance:** Given no consent record, when impersonation is attempted, then it is refused; given an active impersonation session, when any action is taken, then `audit_log` records both identities (`data-specification.md §10.1`).

#### SR-B09 — Minor-data access is role- and relationship-gated
- **Description:** A minor's non-public profile fields **shall** be visible only to the minor's own account, their guardian, and roles with an explicit organizational need (org-admin) — never to a general viewer or another member by default.
- **Rationale:** `NFR-033`'s access-control half, made explicit as an authorization rule.
- **Priority:** Should · P2 · **Dependencies:** `SR-B01`
- **Trace:** `SEC-013`
- **Acceptance:** Given a non-guardian, non-admin member requesting a minor's profile, when served, then only the public-redacted field set is returned.

#### SR-B10 — `SECURITY DEFINER` helper surface is minimal and reviewed
- **Description:** Functions that run with elevated database privilege to support RLS (`my_orgs()`, `has_match_role()`, the audit-insert helper) **shall** be limited to exactly the checks they need, kept in one reviewed location, and covered by their own test cases distinct from the general policy matrix.
- **Rationale:** This is the one class of bug RLS cannot itself catch (§2.3 B4) — the mitigation is keeping the surface small and specifically scrutinised.
- **Priority:** Must · P1 · **Dependencies:** `SR-B01`
- **Trace:** `system-architecture.md §3.9`
- **Acceptance:** Given a code change to any `SECURITY DEFINER` function, when reviewed, then it requires a named security-focused reviewer sign-off, distinct from ordinary code review.

---

## 5. Session Management

#### SR-C01 — Short-lived access tokens, longer-lived refresh tokens
- **Description:** Access tokens **shall** expire within `[DEFAULT]` 60 minutes; refresh tokens **shall** expire within `[DEFAULT]` 30 days of last use.
- **Rationale:** Bounds the exposure window of a leaked access token to a short interval, while avoiding forcing frequent re-logins for an active scorer.
- **Priority:** Must · P1 · **Dependencies:** `SR-A01`
- **Trace:** `system-architecture.md §3.8`
- **Acceptance:** Given an access token older than its TTL, when presented, then it is refused and a refresh is required.

#### SR-C02 — Refresh-token rotation with reuse detection
- **Description:** Each refresh **shall** issue a new refresh token and invalidate the one just used; if an **already-invalidated** refresh token is presented again, the system **shall** treat this as a signal of possible theft and revoke the entire session family, forcing full re-authentication on every device holding it.
- **Rationale:** Rotation limits a stolen refresh token's usable lifetime to one use; reuse detection turns an attempted replay into an active defence rather than a missed signal.
- **Priority:** Must · P1 · **Dependencies:** `SR-C01`
- **Trace:** *(derived — a standard OAuth2/refresh-token security practice, adopted to close the gap `SEC-002` names at summary level)*
- **Acceptance:** Given a refresh token used twice, when the second use is presented, then every token in that session family is revoked and the legitimate holder is prompted to sign in again.

#### SR-C03 — Offline grace window is bounded and explicit
- **Description:** The offline authentication grace period (`offline-first-specification.md §2.1`, `OFF-013`) **shall** be a configurable, bounded duration — `[DEFAULT]` 14 days — after which offline cloud-dependent actions require fresh authentication; local guest-mode scoring remains available indefinitely regardless.
- **Rationale:** Balances the offline-first requirement against the reality that revocation cannot reach a device with no connectivity — the bound is the honest limit on how long a revoked session can still act with cached authority.
- **Priority:** Must · P1 · **Dependencies:** `SR-A06`
- **Trace:** `OFF-013`
- **Acceptance:** Given a claims snapshot older than the grace window, when the device is offline, then cloud-dependent actions are refused locally and only guest-equivalent local scoring proceeds.

#### SR-C04 — Sign-out revokes server-side immediately
- **Description:** Sign-out **shall** invalidate the refresh token server-side immediately; a subsequent refresh attempt with it **shall** fail.
- **Rationale:** The explicit, user-initiated half of revocation, distinct from the passive TTL expiry in `SR-C01`.
- **Priority:** Must · P1 · **Dependencies:** `SR-C01`
- **Trace:** `FR-012`, `SEC-002`
- **Acceptance:** Given a signed-out session's refresh token, when presented, then it is refused with `401`.

#### SR-C05 — Every device holds its own independent session
- **Description:** Signing in on a new device **shall not** invalidate sessions on other devices; each device's session **shall** be independently revocable (`docs/ux/ux-specification.md UX-27`'s "sign out" and, for a lost device, a platform-supported "sign out everywhere").
- **Rationale:** Supports the legitimate multi-device handoff workflow (`offline-first-specification.md §18.4.A`) without conflating it with a security incident, while still giving the user a remedy for a genuinely lost device.
- **Priority:** Must · P1 · **Dependencies:** `SR-C04`
- **Trace:** `docs/ux/ux-specification.md UX-27`
- **Acceptance:** Given a user signs in on device B while already signed in on device A, when device A next makes a request, then it remains valid until its own TTL/explicit sign-out, unaffected by device B.

#### SR-C06 — Session state never grants more than the current role snapshot
- **Description:** Authorization decisions **shall** be evaluated against the **current** `memberships` state at request time (§4.1's RLS layer reading live data), never against a role snapshot cached in the token beyond what's needed for fast UI decisions.
- **Rationale:** A role revoked mid-session must take effect on the very next request, not only after the access token itself expires.
- **Priority:** Must · P1 · **Dependencies:** `SR-B01`
- **Trace:** `system-architecture.md §3.9`
- **Acceptance:** Given a role is revoked while the holder's access token is still technically valid, when they next call an RLS-guarded endpoint, then the revoked capability is refused immediately.

## 6. Token Security

#### SR-D01 — Asymmetric token signing
- **Description:** JWTs **shall** be signed with an asymmetric algorithm (RS256/ES256 or equivalent); the private signing key **shall** never leave the auth service; a public key **shall** be the only key distributed for local/offline verification (`SR-A06`).
- **Rationale:** A symmetric scheme would require the verification secret to exist on every client, making it a client-side secret in practice — an asymmetric scheme lets the verification key be public by design.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `ADR-T08`
- **Acceptance:** Given the token-signing configuration, when inspected, then it uses an asymmetric algorithm and no private key material exists outside the auth service.

#### SR-D02 — Tokens carry an audience restriction
- **Description:** Every issued token **shall** carry an `aud` claim scoping it to this application; a token issued for an unrelated purpose **shall not** validate here, and vice versa.
- **Rationale:** Prevents a token intended for one purpose being replayed against another service that happens to trust the same issuer.
- **Priority:** Must · P1 · **Dependencies:** `SR-D01`
- **Trace:** *(derived — standard JWT hygiene)*
- **Acceptance:** Given a token with a foreign `aud` value, when presented to this API, then it is refused.

#### SR-D03 — Platform-appropriate secure token storage
- **Description:** The refresh token and offline claims snapshot **shall** be stored in the platform's secure storage primitive — Android Keystore-backed encrypted storage; web per the resolved `offline-first-specification.md`/`ADR-T02` open item (`httpOnly` cookie or an equivalently guarded store) — **never** in plain local storage, application logs, or a location any other app/script on the device can trivially read.
- **Rationale:** The access token's short life (`SR-C01`) matters far less if the longer-lived refresh token sits somewhere any local script can read it.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `technology-stack.md ADR-T02/T03/T08`
- **Acceptance:** Given a device with normal (non-rooted) OS protections, when any other installed app attempts to read this app's token storage, then the OS sandbox refuses it.

#### SR-D04 — Tokens never travel in a URL
- **Description:** Access and refresh tokens **shall** be transmitted only via the `Authorization` header (or an equivalently protected channel); they **shall never** appear as a URL query parameter or path segment.
- **Rationale:** URLs are logged by proxies, browsers' history, and referrer headers — a token embedded there leaks far more broadly than one confined to a header.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** *(derived — standard token-handling hygiene)*
- **Acceptance:** Given a code or access-log review, when performed, then no token value appears in any logged URL.

#### SR-D05 — Share tokens and API keys are opaque, high-entropy, and separately revocable
- **Description:** A share-link token and a V2 API key **shall** be generated with at least 122 bits of entropy, **shall not** be derivable from any other identifier (match id, timestamp), and **shall** be individually revocable without affecting any other token.
- **Rationale:** These are long-lived, widely-distributed-by-design capabilities (a link gets forwarded); their security rests entirely on unguessability plus a working revocation path.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `SEC-009/017`, `BR-023`
- **Acceptance:** Given the token-generation function, when its output space is analysed, then brute-forcing a valid token within any practical rate-limited window (`SR-H03`) is computationally infeasible.

#### SR-D06 — API keys and webhook secrets are hashed at rest
- **Description:** An API key's secret portion **shall** be stored only as a salted hash; only a non-secret prefix **shall** be stored/displayed in plaintext for identification. A webhook secret **shall** similarly never be retrievable after creation, only re-rotatable.
- **Rationale:** A database read of the `api_keys`/webhook-config table must never itself be a full compromise of every issued key.
- **Priority:** Must · P2 · **Dependencies:** —
- **Trace:** `SEC-017`, `api-specification.md §13.4`
- **Acceptance:** Given the `api_keys` table, when read directly, then no full, usable secret is recoverable from it.

#### SR-D07 — The service-role key never reaches a client
- **Description:** The backend service-role credential **shall** be used only in server-side Edge Function execution contexts; it **shall never** be embedded in a client bundle, mobile app package, or any artefact a device holds.
- **Rationale:** R-S3's direct mitigation — this single key is a full-database-access credential.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `system-architecture.md §3.4/§4.5`
- **Acceptance:** Given a static scan of every client build artefact, when run in CI, then no service-role key pattern is found; CI fails the build if one is.

---

## 7. Data Encryption

#### SR-E01 — Transport encryption, restated as the encryption-specific requirement
- **Description:** Every network hop carrying application data — client↔backend, backend↔managed-database, backend↔storage, backend↔email/notification provider — **shall** use TLS.
- **Rationale:** `SR-A01` states the boundary rule; this restates it as the encryption inventory item so "data encryption" has one complete answer in one place.
- **Priority:** Must · P1 · **Dependencies:** `SR-A01`
- **Trace:** `SEC-001`
- **Acceptance:** As `SR-A01`.

#### SR-E02 — Server-side encryption at rest
- **Description:** The managed database and object storage **shall** use provider-level encryption at rest for all data, including backups (§13).
- **Rationale:** Baseline protection against physical/storage-layer compromise of the hosting provider, at no engineering cost given the managed-platform choice (`ADR-T04/T10`).
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `technology-stack.md ADR-T04/T10`
- **Acceptance:** Given the hosting configuration, when reviewed, then encryption-at-rest is confirmed enabled for the database, storage buckets, and backup targets.

#### SR-E03 — Device-level encryption is OS-provided, not reinvented
- **Description:** Local application data **shall** rely on the OS's own full-disk/file-based encryption (Android FBE, platform-sandboxed browser storage) as the baseline; the application **shall not** implement its own bespoke encryption of the general local event log.
- **Rationale:** Given the low-sensitivity data classification (§1.3), bespoke field-level encryption of ordinary scoring data would be disproportionate engineering cost for the actual risk it reduces (`[POLICY]`); OS-level protection is appropriate and sufficient.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `SEC-007`
- **Acceptance:** Given a device with OS-level encryption enabled and locked, when its storage is inspected without unlocking, then application data is not readable.

#### SR-E04 — Specific sensitive local fields get defence-in-depth encryption regardless of OS state
- **Description:** The refresh token and the signed claims snapshot **shall** additionally be protected via the platform secure-storage primitive (`SR-D03`) even where OS-level disk encryption is assumed, as a second layer specifically for these highest-value local secrets.
- **Rationale:** These two items are disproportionately valuable if exposed (they grant ongoing access), unlike an ordinary scoring event, warranting the extra layer `SR-E03` otherwise declines to apply broadly.
- **Priority:** Must · P1 · **Dependencies:** `SR-D03`
- **Trace:** `SEC-007`
- **Acceptance:** As `SR-D03`.

#### SR-E05 — Local backup files are encrypted
- **Description:** A local backup archive (`FR-149`, `data-specification.md`'s local-backup feature) **shall** be encrypted with a key derived from the exporting user's authentication (or an explicit user-supplied passphrase), such that possessing the file alone, without the key, does not expose its contents.
- **Rationale:** A backup file is portable by design (intended to be moved to a new device) and therefore a natural exfiltration vector if unencrypted — this closes that gap explicitly; it was not previously stated as a requirement.
- **Priority:** Should · P1 · **Dependencies:** —
- **Trace:** `FR-149`, `OFR-011` *(derived — a genuinely new requirement this document adds)*
- **Acceptance:** Given a backup file opened with a general-purpose archive tool and no key, when inspected, then its contents are not intelligible.

#### SR-E06 — No embedded application encryption keys
- **Description:** No cryptographic key used to protect user data **shall** be hardcoded or embedded in a client application binary; every key used client-side **shall** originate from the platform's secure key store or be derived at the point of use from a user-supplied secret.
- **Rationale:** An embedded key is trivially extractable from any distributed binary and thus provides no real protection — stating this explicitly prevents a well-intentioned but ineffective implementation.
- **Priority:** Must · P1 · **Dependencies:** `SR-E05`
- **Trace:** *(derived — standard cryptographic hygiene)*
- **Acceptance:** Given a static/binary analysis of a released client build, when scanned for embedded key material, then none is found.

#### SR-E07 — Minors' sensitive fields are access-redacted, not separately re-encrypted
- **Description:** `players.dob` and similar minors'-relevant fields **shall** be protected primarily via the access-control redaction already specified (`SR-B09`), not via a distinct encryption scheme — encryption at rest (`SR-E02`) and in transit (`SR-E01`) already cover them; no additional field-level cipher is required.
- **Rationale:** States explicitly that the minors'-data protection story is *access control*, not an extra encryption layer, so implementers don't build a redundant, unspecified mechanism.
- **Priority:** Must · P1 · **Dependencies:** `SR-B09`, `SR-E01`, `SR-E02`
- **Trace:** `NFR-033`, `SEC-013`
- **Acceptance:** As `SR-B09`.

## 8. Local-Device Security

#### SR-F01 — OS sandbox and minimal permissions
- **Description:** The Android application **shall** request only the permissions its enabled features actually require, with no standing access to location, contacts, or other unrelated device data.
- **Rationale:** Reduces the local attack/exposure surface to exactly what's needed.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `SEC-008`, `AND-016`
- **Acceptance:** Given the app's declared permission manifest, when reviewed, then every entry maps to a currently-enabled feature.

#### SR-F02 — No sensitive data in logs or crash reports
- **Description:** Client-side logs and crash-report bundles **shall** be scrubbed of tokens, passwords, and personal data before leaving the device (`system-architecture.md §3.13`'s PII-free logging principle applied client-side).
- **Rationale:** A crash reporter is a data-exfiltration path most teams don't think to audit until it's already leaked something.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `NFR-035`, `AUD-015`
- **Acceptance:** Given a crash report generated during a session with an active token and a player's name entered, when the report is inspected, then neither appears in it.

#### SR-F03 — Root/jailbreak detection informs, never blocks
- **Description:** The application **may** detect a rooted/jailbroken device and surface an informational warning; it **shall not** refuse to function on one.
- **Rationale:** A meaningful fraction of the target market (budget Android devices in developing cricket markets, `NFR-044`) legitimately runs modified OS builds; blocking them would directly contradict the accessibility objective for a marginal security gain, especially given the low-sensitivity data classification. `[POLICY]`, explicitly stated so a future contributor doesn't "helpfully" add a hard block.
- **Priority:** Could · P2 · **Dependencies:** —
- **Trace:** *(derived — a deliberate policy decision, not a named SRS requirement)*
- **Acceptance:** Given a rooted device, when the app is used, then every function remains available, with at most an informational, dismissible notice shown once.

#### SR-F04 — Local storage integrity is verified before use, never assumed
- **Description:** As already specified in `offline-first-specification.md §15.4`: on load, the local event log's hash chain **shall** be verified before folding; a failure **shall** halt normal operation for the affected match and route to recovery, never silently continuing on unverified data.
- **Rationale:** Restated here as the security-specific framing of an already-fully-specified control, so this document's local-device section is self-contained.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `offline-first-specification.md §15.4/§17.2`
- **Acceptance:** As `offline-first-specification.md §15.4`.

#### SR-F05 — Application update integrity relies on platform signing
- **Description:** The Android application **shall** be distributed exclusively via Google Play, relying on the platform's app-signing verification to guarantee update integrity; no out-of-band APK distribution path **shall** be officially supported.
- **Rationale:** Reinventing update-integrity verification would add risk without benefit given a mature platform mechanism already exists.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `AND-017`
- **Acceptance:** Given a build pipeline audit, when reviewed, then release artefacts are published only through the Play Console release process.

#### SR-F06 — Share/export actions expose only the intended content
- **Description:** Invoking the OS share sheet or an export action **shall** include only the specific file/link the user requested — never an incidental bundle of unrelated cached data.
- **Rationale:** A generic "share everything in the app's temp folder" implementation shortcut is a realistic, easy-to-introduce leak; stating the constraint explicitly prevents it.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `AND-013` *(derived)*
- **Acceptance:** Given a share action for one export file, when the share sheet's payload is inspected, then it contains exactly that file and no other application data.

---

## 9. API Security & Input Validation

#### SR-G01 — All client input is untrusted, always re-validated server-side
- **Description:** Every field of every request **shall** be validated server-side against its full schema and business rules, regardless of what the client already validated locally — restating `api-specification.md §4`'s three-layer model as the binding security requirement.
- **Rationale:** A client is not a trust boundary; only the server's own checks are (`SEC-014`). `[INVARIANT]`
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `SEC-014`, `live-scoring.md §5`, `offline-first-specification.md §5.1`
- **Acceptance:** As `api-specification.md §4`'s acceptance criteria for its three validation layers.

#### SR-G02 — No dynamic query construction from user input
- **Description:** Database access **shall** use parameterised queries/an ORM-equivalent exclusively; no request field **shall** ever be concatenated into a query string.
- **Rationale:** Closes SQL-injection as a class, structurally rather than by per-endpoint discipline.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** *(derived — standard secure-coding practice)*
- **Acceptance:** Given a static analysis pass over the data-access layer, when run in CI, then no dynamic SQL construction from a request-derived string is found.

#### SR-G03 — `jsonb` payload fields are schema-validated before use, never interpolated
- **Description:** Every `jsonb` field accepted by an endpoint (event `payload`, `provenance`, `conditions_profile`, etc.) **shall** be validated against its versioned JSON Schema (`api-specification.md §9.1`) before any downstream logic reads it; it **shall never** be passed into a dynamic query or shell context.
- **Rationale:** `jsonb`'s flexibility is exactly what makes unvalidated use of it dangerous; the schema-validation-first rule closes that gap specifically.
- **Priority:** Must · P1 · **Dependencies:** `SR-G02`
- **Trace:** `live-scoring.md §16`, `system-architecture.md §4.8`
- **Acceptance:** Given a malformed or schema-violating `jsonb` payload, when submitted, then it is rejected at the schema-validation layer before any business logic executes on it.

#### SR-G04 — Writable fields are an explicit allow-list per resource (no mass assignment)
- **Description:** A `PUT`/`PATCH` request **shall** be able to set only the fields that resource's specification (`api-specification.md §10.1`) declares writable; any other field present in the body **shall** be ignored or rejected, never silently applied.
- **Rationale:** Prevents a client from setting a server-computed or write-once-then-locked field (e.g. `matches.conditions_profile` after freeze) merely by including it in a request body.
- **Priority:** Must · P1 · **Dependencies:** `SR-G01`
- **Trace:** `data-specification.md §5.1`'s write-once-then-locked note, `MINV-05`
- **Acceptance:** Given a request body including a non-writable field with a new value, when processed, then that field's stored value is unchanged and (`[POLICY]`) the response flags it as ignored rather than silently dropping it.

#### SR-G05 — CORS is restricted to known application origins
- **Description:** Cross-origin requests **shall** be accepted only from the web app's own registered origins (production, staging, preview-deployment patterns); a wildcard origin **shall never** be configured for any authenticated endpoint.
- **Rationale:** An overly permissive CORS policy turns every authenticated user's browser into a potential cross-site request vector.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `technology-stack.md ADR-T10`
- **Acceptance:** Given a request with an `Origin` header not on the allow-list, when it reaches an authenticated endpoint, then the browser's own CORS enforcement (backed by the server's explicit allow-list response) prevents the response from being read by that origin.

#### SR-G06 — Bounded request and batch sizes
- **Description:** Every endpoint **shall** enforce a maximum request body size; the sync push batch **shall** be capped at `maxBatchSize` (`api-specification.md §12.1`, `[DEFAULT]` 200 events).
- **Rationale:** Bounds resource exhaustion from a single oversized request, complementing rate limiting's bound on request *frequency*.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `api-specification.md §12.1`
- **Acceptance:** Given a request exceeding the size/batch cap, when submitted, then it is refused with `400` before full processing begins.

#### SR-G07 — Standard web hardening headers on every response
- **Description:** Web responses **shall** carry `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and an appropriately restrictive `Strict-Transport-Security` header.
- **Rationale:** Baseline browser-enforced defence-in-depth against content-injection and downgrade classes of attack.
- **Priority:** Should · P1 · **Dependencies:** `SR-A01`
- **Trace:** *(derived — standard web hardening practice)*
- **Acceptance:** Given any web response, when its headers are inspected, then all four are present with non-permissive values.

## 10. Rate Limiting & Abuse Prevention

### 10.1 Concrete tiers `[DEFAULT]`

| Endpoint class | Limit | Window | Scope |
|---|---|---|---|
| Sign-in / password-reset-request / magic-link | 5 attempts | 15 min | Per (email, IP) pair |
| Sync push (`POST /sync/events`) | 30 requests | 1 min | Per device — generous, since legitimate offline-catch-up traffic is bursty and high-volume by design |
| Sync pull / fence status | 60 requests | 1 min | Per device |
| Ordinary authenticated resource endpoints | 300 requests | 1 min | Per user |
| Export creation | 10 requests | 1 hour | Per user — deliberately tighter, since exports are comparatively expensive server-side work |
| Public share-link viewer | 60 requests | 1 min | Per (token, IP) pair |
| V2 public API | Per the caller's issued tier | — | Per API key |
| Admin/platform endpoints | 60 requests | 1 min | Per admin session — generous for legitimate use, still bounded against a compromised-session runaway script |

Every limit above is a stated `[DEFAULT]`, tunable against real pilot traffic (`system-architecture.md §3.17`), not a hard architectural constant.

#### SR-H01 — Rate limiting is enforced at the edge, before authentication logic runs where possible
- **Description:** Public and authentication-adjacent endpoints **shall** be rate-limited at the network edge (`technology-stack.md ADR-T10`'s Cloudflare layer) in addition to any application-level limiting, so a flood is absorbed before it reaches application compute.
- **Rationale:** Defence-in-depth against volumetric abuse; an application-only limiter can itself be overwhelmed.
- **Priority:** Should · P2 · **Dependencies:** —
- **Trace:** `NFR-030`, `SEC-010`
- **Acceptance:** Given traffic exceeding the edge-layer threshold for a public endpoint, when observed, then it is throttled before reaching the application.

#### SR-H02 — Rate-limit responses never leak more than necessary
- **Description:** A `429` response **shall** include a `Retry-After` value and **shall not** reveal internal limiter state (exact remaining quota algorithm, per-key thresholds) beyond what a legitimate client needs to back off correctly.
- **Rationale:** Minimises information available to an attacker tuning their request rate to stay just under a limit.
- **Priority:** Should · P2 · **Dependencies:** `SR-H01`
- **Trace:** `api-specification.md §5.2`
- **Acceptance:** Given a throttled request, when the response is inspected, then it carries `Retry-After` and no finer-grained limiter internals.

#### SR-H03 — Share/API tokens are unguessable within any feasible rate-limited window
- **Description:** As `SR-D05`, restated here as the abuse-prevention framing: combined with `SR-H01`'s per-(token,IP) throttling, the token space **shall** make brute-force discovery of a valid, unrevoked token computationally infeasible within any realistic attack timeframe.
- **Rationale:** Rate limiting alone is insufficient if the token space were small; entropy alone is insufficient if there were no rate limit — the two together are the actual guarantee.
- **Priority:** Must · P1 · **Dependencies:** `SR-D05`, `SR-H01`
- **Trace:** `SEC-009`
- **Acceptance:** As `SR-D05`, combined with a throttled-guessing simulation showing no practical success rate within a bounded test window.

#### SR-H04 — Email verification gates full account capability
- **Description:** A newly registered account **shall** be able to send/receive verification but **shall not** gain org-invitation-acceptance or org-creation capability until its email is verified.
- **Rationale:** Reduces the value of mass fake-account creation as an abuse vector.
- **Priority:** Should · P2 · **Dependencies:** —
- **Trace:** `FR-002` *(derived)*
- **Acceptance:** Given an unverified account, when it attempts to accept an org invitation, then it is prompted to verify first.

#### SR-H05 — Public-surface scraping is bounded, not eliminated, and stated honestly
- **Description:** The public viewer and V2 API **shall** be rate-limited and monitored for anomalous per-IP/per-token volume, with an escalation path to a temporary block; this **does not** eliminate scraping of intentionally-public data, only bounds its rate.
- **Rationale:** Match results and standings are deliberately public; the control here is about *rate*, not preventing access to data the product intentionally publishes — stated honestly rather than over-promising a "scraping-proof" guarantee this design does not and should not attempt.
- **Priority:** Should · P2 · **Dependencies:** `SR-H01`
- **Trace:** `NFR-030`
- **Acceptance:** Given sustained anomalous request volume from one source against public endpoints, when detected, then it is throttled or temporarily blocked per the operational runbook (`system-architecture.md §3.14`).

---

## 11. Audit Logging

The mechanism is already exhaustively specified (`AUD-001…015`, `live-scoring.md §17`, `data-specification.md §10.1`, `api-specification.md §13.2`) — not re-derived here. This section states only the requirements genuinely specific to audit logging **as a security control**.

#### SR-I01 — The audit trail is append-only at the grant level, not merely by convention
- **Description:** As already specified: no application role, including admin roles, **shall** hold `UPDATE` or `DELETE` privilege on `match_events` or `audit_log`; append-only **shall** be enforced by database grants, not solely by application logic.
- **Rationale:** Restated here because it is the security property that makes "audit trail" mean something — an audit log an admin can edit is not an audit log.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `AUD-001/003`, `data-specification.md §6.1/§10.1`
- **Acceptance:** As `data-specification.md §6.1`/`§10.1`'s grants statement.

#### SR-I02 — Every admin and impersonated action is audited without exception
- **Description:** There **shall** be no admin-plane or impersonated action that does not produce an `audit_log` entry.
- **Rationale:** The admin plane is the highest-impact compromise target (R-S2); its every action must be reconstructable.
- **Priority:** Must · P1 · **Dependencies:** `SR-B08`
- **Trace:** `AUD-007`
- **Acceptance:** Given every endpoint in `api-specification.md §17`, when exercised, then each produces a corresponding `audit_log` entry.

#### SR-I03 — Audit-chain integrity is verified on a schedule, with hard alerting on failure
- **Description:** A scheduled job **shall** re-verify hash-chain continuity across `match_events` and `audit_log`; a verification failure **shall** page on-call immediately, not merely log a warning.
- **Rationale:** A tamper-evidence mechanism that isn't actually checked provides no real assurance — this makes the checking itself a binding requirement, not an assumed background activity.
- **Priority:** Must · P1 · **Dependencies:** `SR-I01`
- **Trace:** `AUD-003`, `system-architecture.md §3.13`
- **Acceptance:** Given a deliberately induced chain break in a staging environment, when the scheduled verification next runs, then it is detected and an on-call page fires within the job's scheduled interval.

#### SR-I04 — Audit-trail read access is role-gated, distinct from ordinary match read access
- **Description:** As `api-specification.md §13.2`: audit-trail and reconciliation-report endpoints **shall** be restricted to assigned scorers, org-admins, and platform-admins — **not** exposed to a general viewer or share-token holder, even for a Final, publicly-shared match.
- **Rationale:** The audit trail exposes actor identity and correction reasons — a narrower, more sensitive audience than the public scorecard itself.
- **Priority:** Must · P1 · **Dependencies:** `SR-B01`
- **Trace:** `AUD-013`
- **Acceptance:** As `api-specification.md §13.2`'s authz statement.

## 12. Privacy

#### SR-J01 — Data minimisation by default
- **Description:** The system **shall** require only a name to score a match; every additional personal field (email, DOB, photo) **shall** be optional unless a specific feature the user has opted into requires it.
- **Rationale:** The smallest footprint is the safest one — restated here as a binding minimisation rule, not merely a design preference.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `NFR-037`
- **Acceptance:** Given a full match scored end-to-end, when the data it required is audited, then no personal field beyond player names was mandatory.

#### SR-J02 — Documented legal basis and consent for every category of personal-data processing
- **Description:** Each category of personal data collected **shall** have a documented lawful basis (consent, contract necessity, legitimate interest) published in the privacy policy before collection begins.
- **Rationale:** `NFR-032`'s GDPR-class compliance requirement, made concrete as a documentation-and-process obligation, not only a technical one.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `NFR-032`
- **Acceptance:** Given the published privacy policy, when reviewed against the actual data fields collected, then every field maps to a stated basis.

#### SR-J03 — Data-subject rights are self-service where practical
- **Description:** Export (`SR` cross-ref `api-specification.md §11.9`) and erasure **shall** be available to a user without requiring a manual support request in the ordinary case.
- **Rationale:** `FR-010/011` already require these functions; this states the self-service expectation as the security/privacy-team-load requirement it also is.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `FR-010/011`, `NFR-032`
- **Acceptance:** As `api-specification.md §11.9`'s acceptance criteria.

#### SR-J04 — Erasure anonymises in place; it never deletes a Final match's authored record
- **Description:** Account deletion **shall** anonymise the `actor_ref` in place (`data-specification.md §3.1`'s `anonymized_at`) across every event and audit entry the user authored, while a Final match's own record **shall** remain complete and reconciling.
- **Rationale:** The tension between "right to erasure" and "high-integrity permanent record" is resolved the same way throughout this project: anonymise the actor, never the fact (`BR-025`).
- **Priority:** Must · P1 · **Dependencies:** `SR-I01`
- **Trace:** `BR-025`, `AUD-014`
- **Acceptance:** Given a deleted account's authored Final match, when its scorecard and audit trail are viewed after deletion, then figures still reconcile and the actor shows as an anonymised placeholder.

#### SR-J05 — Minors' data receives explicit, documented additional handling
- **Description:** A minor's profile **shall** require guardian-linked consent to create, **shall** default to the reduced-visibility field set (`SR-B09`), and **shall** be included in a specific compliance review pass (GDPR-K/COPPA-class) before the feature ships.
- **Rationale:** `NFR-033`/`A-15`'s requirement, made a concrete pre-ship gate rather than an ambient concern.
- **Priority:** Should · P2 · **Dependencies:** `SR-B09`
- **Trace:** `NFR-033`, `A-15`
- **Acceptance:** Given the minors'-profile feature, when it reaches its pre-ship review, then a named compliance sign-off is on record before the corresponding roadmap gate (`docs/roadmap/product-roadmap.md`) opens.

#### SR-J06 — Third-party data sharing is limited to essential processors, under agreement
- **Description:** Personal data **shall** be shared only with the minimum set of processors necessary to operate the service (hosting, auth, email/notification delivery), each under a data-processing agreement; it **shall never** be sold or shared for advertising purposes.
- **Rationale:** A explicit, auditable boundary on data flow beyond this system's own infrastructure.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `NFR-032` *(derived)*
- **Acceptance:** Given the list of third-party processors in use, when reviewed, then each has a signed DPA on file and none receives data for a purpose beyond operating the service.

#### SR-J07 — Telemetry is privacy-respecting and opt-outable
- **Description:** Feedback/usage telemetry **shall** contain no personal data, **shall** be disclosed in the privacy policy, and **shall** be opt-outable where the target jurisdiction requires it, with the opt-out honoured immediately.
- **Rationale:** Restates `NFR-042` as a binding privacy requirement with a concrete acceptance test.
- **Priority:** Should · P1 · **Dependencies:** —
- **Trace:** `NFR-042`
- **Acceptance:** Given telemetry payloads sampled from production, when inspected, then none contain a personal identifier; given an opt-out toggled, when the next event would have been sent, then it is not.

---

## 13. Backup Security

#### SR-K01 — Backups use separate credentials, separate region/account
- **Description:** Server-side backups (PITR, logical snapshots) **shall** be stored under credentials and, where practical, an account/region distinct from the primary production access path (`system-architecture.md §3.14`).
- **Rationale:** A compromise of production access credentials should not automatically also compromise every historical backup.
- **Priority:** Must · P1 · **Dependencies:** —
- **Trace:** `system-architecture.md §3.14`
- **Acceptance:** Given the backup storage configuration, when audited, then its access credentials are distinct from the primary database's and access to one does not imply access to the other.

#### SR-K02 — Backup access is logged and restricted to platform-admin
- **Description:** Reading, downloading, or restoring from a server-side backup **shall** be restricted to platform-admin role and **shall** produce an `audit_log` entry (`category=ADMIN`).
- **Rationale:** A full historical dataset in one file is the single largest-blast-radius asset in this system (§2.1) and warrants the tightest access control and full accountability.
- **Priority:** Must · P1 · **Dependencies:** `SR-B01`, `SR-I02`
- **Trace:** `ADM-110`
- **Acceptance:** Given a non-platform-admin attempt to access backup storage, when made, then it is refused; given a platform-admin access, when made, then it is audited.

#### SR-K03 — Backup integrity is verified, not merely assumed restorable
- **Description:** The scheduled backup-verification job (`system-architecture.md §3.14`) **shall** confirm both restorability **and** hash-chain continuity of the restored data — a backup that restores syntactically but fails integrity verification **shall** be treated as a failed backup, alerting accordingly.
- **Rationale:** A backup that "restores" but silently carries corrupted or tampered data is worse than an obviously-failed one, because it creates false confidence.
- **Priority:** Must · P1 · **Dependencies:** `SR-I03`
- **Trace:** `ADM-110`, `offline-first-specification.md §17`
- **Acceptance:** Given a scheduled verification run, when it completes, then it reports both restorability and hash-chain-integrity status, and a failure of either pages on-call.

#### SR-K04 — Local backup files require the owning user's key to restore
- **Description:** Restoring a local backup archive (`SR-E05`) **shall** require the same key/authentication that protected it at export time — a backup file found or copied by someone else **shall not** be directly restorable without it.
- **Rationale:** Closes the same exfiltration concern `SR-E05` raises, from the restore side rather than the storage side.
- **Priority:** Should · P1 · **Dependencies:** `SR-E05`
- **Trace:** `OFR-011` *(derived)*
- **Acceptance:** Given a backup file without its protecting key, when a restore is attempted, then it is refused.

## 14. Recovery Security

This section covers the *security* of recovery processes — distinct from `offline-first-specification.md §15`'s treatment of recovery as a **data-loss-bound** question. The two are complementary: that document asks "how much data survives," this one asks "can recovery itself be abused to gain unauthorized access."

#### SR-L01 — Password-reset cannot be used for account takeover
- **Description:** As `SR-A05`: the reset flow **shall not** reveal account existence, **shall** invalidate the reset token on first use, and **shall** require the new credential to meet the same strength policy as sign-up.
- **Rationale:** Password reset is historically the most common account-takeover vector; restated here under "recovery security" specifically because it is exactly that class of process.
- **Priority:** Must · P1 · **Dependencies:** `SR-A05`
- **Trace:** `FR-012`
- **Acceptance:** As `SR-A05`.

#### SR-L02 — New-device continuation requires full re-authentication, never inherited trust
- **Description:** Continuing a match on a new device after a lost/failed device (`offline-first-specification.md §15.3`, `§18.4.A`) **shall** require the new device to independently authenticate — it **shall never** inherit session validity from the lost device (e.g. via a QR-code trust-transfer or similar shortcut that bypasses full sign-in).
- **Rationale:** A device-loss recovery flow that trusts "this device says it's continuing for the lost one" without independent authentication is a direct account-takeover path for anyone who finds or steals the lost device before its session naturally expires.
- **Priority:** Must · P1 · **Dependencies:** `SR-C01`
- **Trace:** `offline-first-specification.md §15.3`
- **Acceptance:** Given a new device attempting to continue a match, when it does so, then it presents its own independently-obtained valid session, never a token or credential copied from the lost device.

#### SR-L03 — A user can revoke a lost device's session remotely
- **Description:** The Settings surface (`docs/ux/ux-specification.md UX-27`) **shall** offer a "sign out this device" / "sign out everywhere" action reachable from any other authenticated device, immediately revoking the target session server-side (`SR-C04`).
- **Rationale:** Gives the legitimate user a concrete remedy the moment they realise a device is lost, rather than relying solely on the passive TTL bound.
- **Priority:** Should · P1 · **Dependencies:** `SR-C04`, `SR-C05`
- **Trace:** `docs/ux/ux-specification.md UX-27`
- **Acceptance:** Given a user signs out a listed device from another device, when that lost device's session is next used, then it is refused.

#### SR-L04 — Disaster-recovery restoration is platform-admin-only, MFA-gated, and logged
- **Description:** Triggering a platform-level disaster-recovery restore (`system-architecture.md §3.14`'s recovery scenarios) **shall** require platform-admin role, an active MFA-verified session, and **shall** produce a distinct, high-visibility `audit_log` entry.
- **Rationale:** The single most consequential operational action in the system; the highest bar of every access control applies simultaneously.
- **Priority:** Must · P1 · **Dependencies:** `SR-A04`, `SR-K02`
- **Trace:** `system-architecture.md §3.14`
- **Acceptance:** Given a restore attempt without MFA or without platform-admin role, when made, then it is refused; given a successful restore, when it completes, then a distinct audit entry is created and (`[POLICY]`) a notification is sent to a defined operations distribution list.

#### SR-L05 — Post-incident response includes forced re-authentication and key rotation
- **Description:** In the event of a confirmed security incident involving credential or key exposure, the incident-response procedure **shall** include forcing re-authentication of all affected sessions (`SR-C02`'s reuse-detection mechanism extended to a manual trigger) and rotating any exposed key or secret (`SR-D06/D07`).
- **Rationale:** States, as a binding process requirement rather than an assumed best practice, that this specific pair of actions is mandatory — not optional — in incident response.
- **Priority:** Must · P1 · **Dependencies:** `SR-C02`, `SR-D06`, `SR-D07`
- **Trace:** *(derived — standard incident-response practice, made explicit for this project)*
- **Acceptance:** Given the documented incident-response runbook (`system-architecture.md §3.14`), when reviewed, then it names both forced re-authentication and key rotation as required steps for a credential/key-exposure incident class.

---

## 15. Security testing and verification

Maps this document's requirements onto the verification gates `technology-stack.md ADR-T12` already establishes, adding the security-specific ones that document didn't fully enumerate:

| Verification | Covers | Cadence |
|---|---|---|
| pgTAP RLS policy matrix | `SR-B01/B02/B05` | Every migration, CI-blocking |
| Static secret/key scan | `SR-D07`, `SR-E06` | Every build, CI-blocking |
| Dependency/SBOM scan | R-S8-adjacent supply-chain risk | Every build |
| Audit-chain verification job | `SR-I03` | Scheduled, continuous |
| Backup restore-and-verify drill | `SR-K03` | Scheduled (quarterly, `ADM-110`) |
| Rate-limit / abuse simulation | `SR-H01…H05` | Pre-beta, pre-GA |
| Token-handling review (storage, transport, entropy) | `SR-D01…D07` | Pre-pilot, on any auth-flow change |
| RLS + auth penetration test | Whole of §3–§4, §9 | Pre-pilot, pre-GA, and on any auth/permission-model change (`system-architecture.md §4.11`) |
| Accessibility + privacy joint review for minors' features | `SR-J05` | Pre-ship gate for that specific feature |
| Incident-response tabletop exercise | `SR-L05` | Pre-GA, then annually |

---

## 16. Traceability

| This document | Source |
|---|---|
| §2 Threat model | `system-architecture.md §3.15`, `foundation §10` |
| §3 Authentication | `SEC-001/002`, `ADR-T08` |
| §4 Authorization/Roles/Permissions | `SEC-004/005/006/009/011/016`, `foundation §4`, `BR-*` |
| §5 Session Management | `OFF-013`, `system-architecture.md §3.8` |
| §6 Token Security | `ADR-T08`, `technology-stack.md ADR-T02/T03` |
| §7 Data Encryption | `SEC-001/007` |
| §8 Local-Device Security | `SEC-008`, `AND-*`, `offline-first-specification.md §15.4` |
| §9 API Security & Input Validation | `SEC-014`, `api-specification.md §4` |
| §10 Rate Limiting & Abuse Prevention | `SEC-009/010/017`, `NFR-030` |
| §11 Audit Logging | `AUD-001…015` |
| §12 Privacy | `NFR-031…036`, `BR-025`, `A-15` |
| §13 Backup Security | `system-architecture.md §3.14`, `ADM-110` |
| §14 Recovery Security | `offline-first-specification.md §15` |

---

## 17. Open items

| # | Item | Current default | Resolution path |
|---|---|---|---|
| SQ-1 | Numeric rate-limit tiers (§10.1) are stated as `[DEFAULT]`, not yet validated against real traffic | Reasonable estimates based on expected pilot scale | Tune post-pilot load data (`system-architecture.md §3.17`) |
| SQ-2 | Whether org-admin MFA should become `Must` rather than `Should` before GA | `Should · P2` (§`SR-A04`) | Revisit at the Version 2 gate once org-admin capability (branding, competitions) carries more consequence |
| SQ-3 | Web refresh-token storage mechanism (`SR-D03`) depends on `technology-stack.md`'s still-open `AQ-8` | Deferred to that decision | Architecture + security, before Version 1 build |
| SQ-4 | Whether the local-backup encryption key (`SR-E05`) should be user-supplied-passphrase or device-derived by default | Not yet decided; either satisfies the requirement | UX + security, balancing usability against a forgotten-passphrase recovery problem |
| SQ-5 | Formal penetration-test scope and vendor selection | Not yet engaged | Pre-pilot, per §15's gate |

---

## 18. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-22 | Initial security specification. §1 purpose, relationship to the SRS's existing `SEC-/AUD-` requirements (extended, not renumbered), the `SR-XXX` scheme, and the data-classification principle (low-sensitivity, high-integrity) that weights every control. §2 a formal threat model: asset inventory, the 10 trust boundaries (reused from `system-architecture.md §3.15`) each given a STRIDE analysis with stated residual risk, and a likelihood/impact risk register. §3–§14: twelve requirement clusters (A–L) covering Authentication, Authorization/Roles/Permissions (including a full 14-actor × 20-capability permission matrix), Session Management, Token Security, Data Encryption, Local-Device Security, API Security & Input Validation, Rate Limiting & Abuse Prevention (with concrete numeric tiers), Audit Logging, Privacy, Backup Security, and Recovery Security — 60 `SR-XXX` requirements total, each with Description/Rationale/Priority/Dependencies/Trace/Acceptance criteria, cross-referencing rather than re-deriving what prior documents already fully specify (RLS enforcement, the event-sourcing audit trail, the sync protocol's own validation layers) and going deep exactly where the prior documents were thin. §15 security testing and verification gates. §16 traceability. §17 five open items. Requirements and acceptance criteria only — no implementation. |

