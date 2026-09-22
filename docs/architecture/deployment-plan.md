# Cricket Scoring Book — Production Deployment Plan

| | |
|---|---|
| **Document** | Production Deployment Plan |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-23 |
| **Upstream** | `docs/architecture/system-architecture.md §3.13–3.18` (observability, backup/recovery, security boundaries, scaling, failure model), `docs/architecture/technology-stack.md ADR-T10/T11/T13` (hosting, CI/CD, monitoring choices), `docs/architecture/repository-structure.md §11–12` (`infrastructure/`, `.github/workflows/`), `docs/architecture/security-specification.md §13–15` (`SR-K*`/`SR-L*`, incident-response verification table) |
| **Downstream** | `.github/workflows/*.yml` (not created by this document), `infrastructure/*` configuration (not created by this document), `docs/release-readiness-assessment.md §2` row 15 (Deployment) and row 16 (Rollback — this document is that row's first real specification) |
| **Status** | A **deployment plan and procedure**, not a deployment. Nothing in this repository is deployed, provisioned, or configured by this document. It defines what a deployment consists of, in what order, with what verification, and how to reverse it — for whenever deployment is actually authorized. |

> **This document performs no deployment action.** No infrastructure is provisioned, no secret is created, no environment is touched. Every imperative sentence below ("the pipeline deploys X") describes the *procedure to be followed*, not an action taken while writing this document.

---

## 0. Scope and relationship to the rest of the corpus

This plan does not re-derive architecture — it sequences and operationalizes decisions already made: the hosting stack (`ADR-T10`: Supabase Cloud, Cloudflare Pages, Google Play, PowerSync Cloud), the CI/CD platform (`ADR-T11`: GitHub Actions), the monitoring stack (`ADR-T13`: Sentry, Grafana Cloud/OTel, Checkly, PostHog), and the observability/backup design already specified in full at `system-architecture.md §3.13–§3.14`. Where this document states a mechanism, it cites that source rather than re-inventing it; where it adds new content — principally **§14 Rollback**, which no document in the corpus specified before this one (`release-readiness-assessment.md RRQ-2`) — that is stated explicitly.

Nothing here may be executed before `release-readiness-assessment.md §7`'s NO-GO verdict changes to GO for the relevant tier, and before the CI/CD workflow files this plan describes (`repository-structure.md §12`) actually exist.

---

## 1. Environments

Four environments, matching `infrastructure/environments/` (`repository-structure.md §11`) and the release-stage structure in `product-roadmap.md §4`:

| Environment | Purpose | Maps to release stage | Config source |
|---|---|---|---|
| **dev** | Local/CI development and PR validation | Every PR (`pr.yml`) | `infrastructure/environments/dev.env.example` |
| **staging** | Integration environment, production-shaped but synthetic data only | Merge to `main` (`main.yml`) | `infrastructure/environments/staging.env.example` |
| **pilot** | The closed-pilot environment real accredited scorers use | Version 1, gated by `pre-pilot.yml` | A distinct Supabase project + Cloudflare Pages deployment + Play internal/closed track, not merely a flag on staging |
| **production** | GA and beyond | Version 2+, gated by `pre-ga.yml`, deployed by `release.yml` | `infrastructure/environments/prod.env.example` |

**Promotion is one-directional and gate-controlled**: dev → staging happens on every merge to `main` automatically; staging → pilot and pilot → production are **manually triggered** (`repository-structure.md §12`: `pre-pilot.yml`/`pre-ga.yml` are "manually triggered"), never automatic — this is a deliberate human gate (`ai-development-harness.md §8` Gate `G2`-class approval), not a pipeline default.

**Data isolation**: pilot and production are separate Supabase projects (`infrastructure/supabase-projects/`, one config per environment, "no keys, only project refs" per `repository-structure.md §11`) — pilot data never flows into production, and production never seeds from pilot.

---

## 2. Infrastructure

Four managed platforms, per `ADR-T10`, each with a documented self-host exit (not exercised by this plan, only noted as the reversibility property `ADR-T10` already established):

| Platform | Hosts | Config lives at |
|---|---|---|
| **Supabase Cloud** | Postgres (primary datastore), GoTrue (auth), Edge Functions (API/command handlers), Storage (exports, backup archives) | `infrastructure/supabase-projects/` |
| **Cloudflare Pages** | The Web PWA static build + edge functions for redirects/headers | `infrastructure/cloudflare/` |
| **Google Play** | The Android app, staged-rollout tracks | Play Console (release track config, not repo-stored) |
| **PowerSync Cloud** | The sync substrate (`ADR-T09`) | Provisioned per Supabase project, config alongside `infrastructure/supabase-projects/` |

**Infrastructure-as-code discipline** (`repository-structure.md §11`): every one of these is configuration and references only — a secret's *reference* lives in `infrastructure/`, its *value* never does (§8 below).

---

## 3. Database deployment

**Mechanism**: the Supabase CLI applies versioned SQL migrations from `database/supabase/migrations/` (`repository-structure.md §9`) — **forward-only**, matching `ADR-T11`'s stated convention. There is no "migration rollback" primitive in this design; see §14 for what that means operationally.

**Sequencing** (per `implementation-task-backlog.md §4`'s dependency-ordered foundation tasks — migrations apply in exactly that dependency order: identity/tenancy → teams/players → match/officials/reference-data → event store → read model → sign-off/sync/audit):

1. `staging`: migration applies automatically on merge to `main`, against a database seeded only with synthetic fixture data (`testing-strategy.md §20`, `database/supabase/seed/` — "never real personal data").
2. `pilot`/`production`: migration apply is a **named step inside `pre-pilot.yml`/`release.yml`**, never automatic — run against a database that, by definition once pilot begins, holds real scorer data.
3. **Every migration is dry-run against a prod-like snapshot before it's allowed to apply to `pilot`/`production`** — this is `main.yml`'s own stated job (`repository-structure.md §12`: "migration dry-run against a prod-like snapshot").
4. `match_events` is partitioned (hash or monthly, `system-architecture.md §3.17`) — a migration touching this table's structure carries higher review weight (Gate `G2`, `ai-development-harness.md §8`) given its append-only/hash-chained nature (`ADR-08`).

**Verification**: `database/supabase/tests/` (the pgTAP suite — schema/constraint/RLS-matrix/append-only-grant assertions, `testing-strategy.md §7`) runs and must pass **before** a migration is considered deployed, not after.

---

## 4. API deployment

**Mechanism**: `database/supabase/functions/*/index.ts` (thin entrypoints) deploy via the Supabase CLI's function-deploy command, each importing from `backend/src/` (`repository-structure.md §8–9.3`). The thin-entrypoint split means **API deployment is really two artifacts deployed together**: the entrypoint (a mechanical Edge Function) and the actual logic it imports (`backend/`'s command/sync/authz/projection/exports/outbox modules) — they are versioned and deployed as one unit, never independently, to avoid an entrypoint referencing logic that doesn't match its own contract test.

**Contract verification**: `api-specification.md`'s OpenAPI definition (once authored into `specs/openapi/`, per `repository-structure.md §4`) is the source both the deployed function and its client-generated types must match — a deploy that would break the published contract is a `pr.yml`-stage failure (`testing-strategy.md §21`'s "API contracts" gate), not something discovered post-deploy.

**Sequencing relative to database**: API deployment always follows database migration apply in the same pipeline run — an Edge Function referencing a column/table a migration hasn't yet created is a startup-time failure, so migration-then-function-deploy is a strict order, never parallel, within `release.yml`.

---

## 5. Web deployment

**Mechanism**: Cloudflare Pages, built via Vite from `apps/web/` (`ADR-T02`), consuming the `shared/` core's Kotlin/JS npm-published package (`repository-structure.md §15.1`'s one build-time seam) and the OpenAPI-generated client (§4 above).

**The one Web-specific deployment hazard, stated explicitly**: this is an **installable, offline-capable PWA** (`C-1`). A naive deploy that force-updates the service worker mid-match would violate the offline-first constitution (`ai-context-pack.md C-1`) for any scorer actively using the app when a new version ships. The deployment procedure (§16) therefore requires: the service worker (`apps/web/src/service-worker/`, `repository-structure.md §6`) uses a versioned-cache, prompt-to-update pattern — a new deploy is downloaded in the background and only activates on the user's next app launch or explicit "update available" acceptance, **never** while a match is actively being scored. This is a deployment-procedure requirement, not yet a stated `offline-first-specification.md` rule — flagged as `DPQ-1` (§19) for whether it needs to be promoted into that document.

**Verification**: Cloudflare Pages' preview-deployment mechanism serves every PR build at a unique URL before merge (standard platform capability, not a custom build) — `pr.yml`'s "changed-screen UI suites" (`testing-strategy.md §21`) run against that preview URL, not against production.

---

## 6. Android release

**Mechanism**: Google Play, staged rollout tracks — **internal** (Alpha, `product-roadmap.md §4.1`, "team + 1–2 friendly scorers") → **closed** (Version 1 pilot, `§4.2`, "closed pilot grade") → **open/production** (Version 2, `§4.3`, "open beta → GA"). This mapping is not arbitrary — it's the same three-tier structure `product-roadmap.md` already uses for the whole release plan, applied to Play's own track model.

**Build**: part of the same Gradle multi-project build as `shared/` (`repository-structure.md §7`, §15.1) — Android and the scoring core are never built or versioned independently of each other, closing off a class of parity drift by construction.

**Staged percentage rollout within a track**: production releases (Version 2+) roll out at an increasing percentage (e.g., 5% → 25% → 100%) rather than 100% at once — this is what makes §14's Android rollback path (a halt, not a true revert) meaningful: catching a bad release at 5% affects far fewer devices than at 100%.

**Verification**: `pre-ga.yml`'s device-lab chaos/perf/TalkBack instrumented suite (`repository-structure.md §7`, `apps/android/src/androidTest/`) runs against the release-candidate build before it's promoted to the next rollout percentage.

---

## 7. Configuration

**Environment configuration**: `infrastructure/environments/{dev,staging,prod}.env.example` templates (§1) — actual values injected by the CI/CD platform's own secret/variable store per environment, never committed.

**Reference-data configuration is a different, higher-stakes category**: playing-conditions profiles and DLS tables (`cricket-rules-reference.md §0`, `data-specification.md §5.4 reference_data`) are versioned and **pinned per match at creation** (`ADR-11`). A configuration deploy that publishes a new reference-data version **must not** retroactively change a match already in progress — `system-architecture.md §3.14`'s recovery-scenarios table states this precisely: "Bad reference-data publish → Central hot-fix; in-progress matches keep the pinned version." This is the one configuration category where "deploy the new config" and "every client immediately uses it" are **not** the same thing, by design — new matches pick up the new version; existing matches do not.

**Feature flags**: `system-architecture.md §3.14`'s "Bad client release" row establishes feature-flag-off as one of the two mechanisms (alongside staged rollback, §14) for containing a bad release — flag configuration is deploy-independent (can change without a new build), and is the fastest of the two available levers.

---

## 8. Secrets

**No client-side service-role keys**, ever (`SR-D07`, `security-specification.md §4`) — the risk register's `R-S3` ("leaked service-role key") is mitigated specifically by this rule plus rotation capability.

**Storage**: a secrets manager, referenced (never valued) from `infrastructure/*` config, per §2's infrastructure-as-code discipline. `security-specification.md B10` (the CI/CD & secrets trust boundary): "Service keys never in client bundles; secrets in a manager; build provenance / SBOM."

**Rotation**: exercised on suspicion of compromise (`security-specification.md R-S3`'s stated mitigation — "Low [residual risk], if rotation is exercised promptly on suspicion") — this plan does not invent a fixed rotation cadence beyond what's already specified, since none is stated as a hard requirement in `security-specification.md` for ordinary (non-incident) rotation; §15's incident-response procedure **does** mandate rotation as a binding, non-optional step (`SR-L05`) when an incident is confirmed.

**A known, unresolved gap this plan does not silently paper over**: `adversarial-verification-report.md AVF-SEC-01` found that the webhook-secret storage rule (`SR-D06`, hash-only) is structurally incompatible with HMAC-signed webhook delivery, which needs the plaintext retained. This deployment plan **does not decide that question** — it is V2-scoped (webhooks, `api-specification.md §13.4`) and explicitly deferred to the Requirement Change Request `AVF-SEC-01` calls for. No deployment procedure below references webhook-secret handling as if it were settled.

---

## 9. Monitoring

Adopted directly from `system-architecture.md §3.13`'s five observability pillars — not restated in full here, only the deployment-relevant consequence of each:

| Pillar | Deployment-time requirement |
|---|---|
| Logs | Log drains must be provisioned **before** the first deploy to an environment, not added afterward — `pilot`'s go-live checklist (§17) includes verifying log ingestion is live. |
| Metrics | The release-health dashboard ("mapped to roadmap gates," `§3.13`) must reflect the environment being deployed to before that environment's first real match is scored. |
| Traces | OpenTelemetry spans (`score → persist → sync`) — deployed alongside the Edge Functions they instrument, same artifact, not a separate rollout. |
| Dashboards | Per-environment; `pilot`'s dashboard is a distinct one from `staging`'s, provisioned as part of `pre-pilot.yml`, not reused. |
| Synthetic checks | The "score a T20 offline, then sync" canary and the conformance/sync-convergence suites (`§3.13`) run **post-deploy**, as the first item in §17's verification checklist, not only in CI pre-merge. |

**ADR-T13's four tools** (Sentry, Grafana Cloud/OTel, Checkly, PostHog) are provisioned per environment at that environment's first deployment — `dev`/`staging` may share a lighter-weight instance; `pilot`/`production` require their own, per the same data-isolation principle as §1.

---

## 10. Logging

Structured JSON with correlation IDs (`request_id`, `match_id`, `sync_batch_id`, `event_id`) — **no PII** (`NFR-035`, `AUD-015`), per `system-architecture.md §3.13`. Deployment-relevant specifics:

- **Server-side**: Edge Function + Postgres logs flow to log drains configured per environment (§9) — this routing is itself part of what each environment's infrastructure config (§2) provisions, not an application-level concern.
- **Client-side**: an on-device ring buffer, opt-in upload on crash/error only — this means a client release **does not** stream logs continuously; log volume from the client fleet is bounded by crash rate, not by usage volume, which is a deliberate cost/privacy design already fixed by `system-architecture.md §3.13` and simply inherited here.
- **Retention**: bound by the same privacy/retention policy `security-specification.md §12` (`SR-J*`) sets for personal data generally — this plan does not set a separate logging-specific retention period beyond what that document already establishes.

---

## 11. Alerts

Adopted directly from `system-architecture.md §3.13`'s alerting row — every one of these is a **page**, not a dashboard-only signal, and every one must be live and tested (a synthetic trigger, not just "configured") before a deployment to `pilot` or `production` is considered complete:

| Alert | Severity | Trigger |
|---|---|---|
| Event-loss incident | **Page immediately** | Any confirmed event-loss (target is zero, `NFR-009`) |
| Audit chain-verification failure | **Page immediately** | A hash-chain break — per `offline-first-specification.md §15.4`'s own routing of this exact failure class to "an on-call operational investigation" |
| Backup-verification failure | Page | The scheduled restore-and-verify job (§12) fails either restorability or hash-chain continuity (`SR-K03`) |
| SLO burn (availability, sync p95, error rate) | Page (rate-dependent) | Standard SLO burn-rate alerting against `NFR-013`'s ≥99.5% target |
| Replication lag | Page | Backend PITR/replica lag exceeds threshold |
| Storage/quota thresholds | Warn → page | Approaching provisioned storage limits |

**Verification that alerts actually fire is part of the deployment procedure (§16), not assumed** — an alert that's configured but never tested is not verified per `ai-development-harness.md §7`'s standard (a check that can't demonstrably pass or fail isn't a check).

---

## 12. Backup

Adopted directly from `system-architecture.md §3.14`'s backup table — restated here with the deployment-time provisioning step each requires:

| Scope | Mechanism | Deployment-time requirement |
|---|---|---|
| Backend PITR | Continuous WAL archiving, configurable retention | Enabled at environment provisioning (§2), before first real data exists in that environment |
| Backend snapshots | Daily logical export to object storage, **separate region/account** (`SR-K01`) | The separate-account credential itself is provisioned and verified distinct from production access **before** go-live |
| Backup verification | Scheduled restore-and-verify job — checks row counts, hash-chain continuity, a sample projection rebuild (`SR-K03`) | Must run successfully at least once against the target environment before that environment is considered production-ready |
| Client cloud backup | Normal sync, once acknowledged (`ONR-007`) | No separate provisioning — inherits from §4's API deployment |
| Client local backup | Signed archive, restorable offline, lossless round-trip (`FR-149`, `OFF-011`) | Client-side feature, ships with the app build (§5/§6), not environment-specific |
| Backup access | Platform-admin only, logged (`category=ADMIN`, `SR-K02`) | RLS/role config (§3 migrations) must be live before any backup credential is issued to a human |

---

## 13. Disaster recovery

Adopted directly from `system-architecture.md §3.14`'s recovery-scenarios table (RPO/RTO targets) — restated with the deployment/verification consequence:

| Scenario | RPO / RTO | Verified how |
|---|---|---|
| Device lost, match synced | 0 / minutes | Client-side, not a deployment concern |
| Device lost, match **not** synced | ≤ last checkpoint / minutes | Client-side; bounded loss is a documented, accepted limit (`offline-first-specification.md §15.2`) |
| Backend region outage | Minutes (PITR) / hours | Quarterly restore drill (`ADM-110`) exercises this path against a real snapshot |
| Data corruption / bad projection deploy | 0 / minutes–hours | Projection rebuild from `match_events` (§9's synthetic checks include a rebuild verification) |
| Bad reference-data publish | 0 / minutes | Central hot-fix; verified in-progress matches keep the pinned version (§7) |
| Bad client release | 0 / minutes | Feature-flag off or staged rollback (§14) |

**Restoration is platform-admin-only, MFA-gated, and produces a distinct high-visibility audit entry (`SR-L04`)** — no deployment procedure in this plan bypasses that requirement, including an emergency one; §15's incident-response procedure explicitly inherits this constraint rather than granting an exception under pressure.

**Drills**: a quarterly restore drill (`ADM-110`) and an incident-response tabletop exercise "pre-GA, then annually" (`security-specification.md §15`'s verification table, `SR-L05`) are both **scheduled operational commitments this plan inherits**, not new content — restated here so a deployment-readiness reviewer finds them in the deployment document, not only in the security spec.

---

## 14. Rollback — new content, resolving `release-readiness-assessment.md RRQ-2`

No document in the corpus specified a rollback procedure before this one. Rollback is **not one mechanism** — it is four different mechanisms, one per deployable component, because the four components have fundamentally different reversibility properties:

### 14.1 Database — forward-only; "rollback" means a corrective migration, never a revert

Per `repository-structure.md §9`, migrations are forward-only. **There is no database rollback in the sense of undoing an applied migration.** A bad migration is fixed by writing and applying a **new** migration that corrects the problem — the same discipline `live-scoring.md §19`'s Correction model applies at the domain level (supersede, never destructively undo history) applies here at the schema level, for the same reason: `match_events` and `audit_log` are append-only and hash-chained (`ADR-08`); a schema revert that altered already-written rows would be indistinguishable from tampering. **Practical consequence for deployment procedure**: a migration is never applied to `pilot`/`production` without the dry-run-against-a-prod-like-snapshot step (§3) having already caught what a rollback would otherwise need to fix.

### 14.2 API / Backend (Edge Functions) — redeploy the previous versioned artifact

Because the thin-entrypoint + `backend/src/` logic are deployed as one versioned unit (§4), rollback is: redeploy the immediately-prior artifact version via the Supabase CLI. This is safe **only if** no migration between the two versions has made the prior code incompatible with the current schema — which is why §3's migration ordering (migration always precedes function deploy, never the reverse) matters for rollback safety, not just forward deployment safety: a function-only rollback that lands on a schema built for a newer function version is itself a new incident, not a fix.

### 14.3 Web — Cloudflare Pages instant rollback to the previous deployment

Cloudflare Pages retains prior deployments and supports an immediate rollback to any of them (a platform capability, not custom tooling) — this is the fastest rollback path of the four. **The offline-first hazard from §5 applies in reverse here too**: a scorer with a new (bad) service worker version already active mid-match must not be force-downgraded while scoring is in progress; the same versioned-cache, prompt-to-update pattern that governs forward deploys governs rollback deploys identically — the service worker treats "an older version is now the target" exactly like "a newer version is now the target," with the same never-during-an-active-match constraint.

### 14.4 Android — staged-rollout halt, never a true revert

Google Play has no "uninstall and revert" mechanism for devices that already received an update. Android rollback is therefore: **halt the staged rollout** (§6) at its current percentage, preventing further devices from receiving the bad version, while devices that already updated remain on it. This is why §6's staged-percentage rollout is a rollback *precondition*, not just a deployment nicety — catching a bad release at 5% rollout, then halting, limits exposure to that 5%; a 100%-at-once release has no such containment available. **The binding client-side constraint, already stated in `system-architecture.md §3.14`** and restated here as the rule this plan's Android rollback procedure must never violate: *"client downgrade must not lose unsynced local data"* (`OFF-012`, `SEC-018`) — any Android release, including one a rollback halts partway through, must be built so that a device stuck on it, or one that later updates past it, never loses locally-recorded, not-yet-synced match data as a side effect.

### 14.5 What rollback does not cover

None of the four mechanisms above undoes a **data** consequence already synced to the server from a bad client release (a client bug that recorded wrong scoring data, for instance, and that data has already synced) — that is a correction (`live-scoring.md §19`), a domain-level fix, not a deployment-level rollback. Rollback stops a bad *build* from doing more damage; it does not retroactively fix damage a build already did to synced data. This distinction is stated explicitly here because conflating the two is a realistic operational mistake under incident pressure.

---

## 15. Incident response

**Binding requirements already established, inherited without modification**:
- `SR-L05`: a confirmed security incident involving credential/key exposure **shall** trigger forced re-authentication of affected sessions and rotation of any exposed key/secret — not optional, not a judgment call under pressure.
- `SR-L04`: disaster-recovery restoration (§13) during incident response remains platform-admin-only and MFA-gated even under incident pressure — no incident-response exception path bypasses this.
- An incident-response tabletop exercise runs pre-GA, then annually (`security-specification.md §15`).

**New content this plan adds — severity tiers and the response shape, since none existed before**:

| Tier | Example | Response |
|---|---|---|
| **SEV-1** | Event-loss, audit chain break, confirmed credential/key exposure, cross-tenant data leak | Page immediately (§11); incident commander assigned; `SR-L05`'s forced-reauth+rotation triggers if credentials are involved; disaster recovery (§13) invoked if data-level, under `SR-L04`'s gating |
| **SEV-2** | Sync reliability degraded (elevated reject rate), backend region outage | Page; failover/degradation per `system-architecture.md §3.18`'s failure model; rollback (§14) evaluated if traced to a specific release |
| **SEV-3** | Elevated error rate below SLO-burn threshold, a single non-critical alert firing | Standard on-call triage, no forced page escalation |

**Post-incident**: every SEV-1 and SEV-2 incident produces a written retrospective — this plan does not invent a template beyond noting one is required, since the corpus doesn't yet specify incident-retrospective format (flagged as `DPQ-2`, §19).

---

## 16. Deployment procedure

The end-to-end sequence, mapped to the five CI/CD workflow files `repository-structure.md §12` already names:

1. **`pr.yml`** (every pull request): unit + domain tests 100%, parity corpus, RLS matrix, API contract checks, changed-screen UI suites, secret scan, offline-chaos + sync-convergence subsets (`testing-strategy.md §21`). **No deployment occurs at this stage** — Cloudflare Pages preview builds (§5) are the only artifact produced.
2. **`main.yml`** (on merge to `main`): full offline-chaos suite, full sync-convergence sweep, migration dry-run against a prod-like snapshot (§3). **Deploys to `staging` automatically** on success.
3. **`pre-pilot.yml`** (manually triggered, human-gated per §1): conformance suite 100%, accredited-scorer review checklist, WCAG 2.2 AA audit, DLS benchmark or documented fallback, initial penetration test (`repository-structure.md §12`). On success: database migration applies to `pilot` (§3), API deploys (§4), Web deploys to the pilot Cloudflare Pages project (§5), Android promotes to the closed track (§6). Monitoring/alerting (§9/§11) for the `pilot` environment is verified live **before** this step, not after.
4. **`pre-ga.yml`** (manually triggered): parity ≥95%, load test, full penetration test, incident-response tabletop record (`repository-structure.md §12`, `security-specification.md §15`). Gates promotion to `production`.
5. **`release.yml`**: Android → Play production track (staged percentage, §6); Web → Cloudflare Pages production (§5); Database → Supabase CLI migration apply (§3); SBOM + build provenance generated (`repository-structure.md §12`, `security-specification.md B10`).

**Every step above that touches `pilot` or `production` requires the human approval `ai-development-harness.md §8`'s Gate framework already establishes** — this plan does not introduce a new approval mechanism, it applies the existing one to deployment specifically.

---

## 17. Verification checklist

Run **after** every deployment to `pilot` or `production`, before the deployment is considered complete (not merely "shipped"):

- [ ] Migration applied cleanly; pgTAP suite passes against the live environment (§3)
- [ ] API contract check passes against the deployed Edge Functions, not just the CI build artifact (§4)
- [ ] Web: the synthetic "score a T20 offline, then sync" canary (`system-architecture.md §3.13`) completes against the live deployment
- [ ] Web: service-worker update behavior verified non-disruptive to an in-progress match (§5, §14.3) — manually confirmed, not yet automatable per this plan's current scope
- [ ] Android: release-candidate build passed the device-lab chaos/perf/TalkBack suite (§6) before rollout began
- [ ] Log ingestion confirmed live for the target environment (§9, §10)
- [ ] Every alert in §11's table confirmed live via a synthetic trigger, not just "configured"
- [ ] Backup mechanisms (§12) confirmed provisioned and, for a first deployment to an environment, the restore-and-verify job has run at least once successfully
- [ ] Conformance suite 100% pass, parity-matrix score ≥95% (`system-architecture.md §3.13`'s stated business/quality metrics), confirmed against the live deployment's build artifact
- [ ] For `pilot`/`production` specifically: `SR-L04`'s disaster-recovery restore path confirmed reachable (not executed) by the platform-admin who would need it
- [ ] Rollback path for this specific deployment (§14, per-component) confirmed available before the deployment is announced as complete — not confirmed only in the abstract, but for the artifact just shipped

A deployment that fails any checked item here is **not complete** — it is either rolled back (§14) or the failing item is fixed forward with an emergency corrective step, following the same Gate discipline as any other change (`ai-development-harness.md §8`).

---

## 18. Traceability

Every section above cites its source rather than inventing: Environments/Infrastructure (§1–2) trace to `repository-structure.md §11`, `ADR-T10`; Database/API deployment (§3–4) trace to `repository-structure.md §8–9`, `ADR-08/09`; Web/Android (§5–6) trace to `ADR-T02/T03`, `repository-structure.md §6–7/15`; Configuration/Secrets (§7–8) trace to `ADR-11`, `SR-D06/D07`, `AVF-SEC-01`; Monitoring/Logging/Alerts/Backup/Disaster Recovery (§9–13) trace almost entirely to `system-architecture.md §3.13–3.14` and `SR-K*/L*`; Rollback (§14) is new content, cross-referencing `live-scoring.md §19`'s Correction model as the conceptual precedent for "forward-only, never destructive"; Incident Response (§15) extends `SR-L05` with new severity-tier content; the Procedure and Checklist (§16–17) map onto `repository-structure.md §12`'s five workflow files and `ai-development-harness.md §7–8`'s verification/gate framework.

---

## 19. Open items

| ID | Question |
|---|---|
| `DPQ-1` | Should the service-worker never-update-mid-match rule (§5, §14.3) be promoted from this deployment plan into `offline-first-specification.md` as a formal rule, since it's really a client-behavior specification, not a deployment-procedure detail? |
| `DPQ-2` | This plan introduces incident severity tiers (§15) and requires a post-incident retrospective but doesn't specify a retrospective template or its storage location — new document, or a section of this one? |
| `DPQ-3` | §1 defines `pilot` as a fully separate Supabase project/Cloudflare deployment/Play track from `production` — is that isolation level actually necessary given `product-roadmap.md`'s pilot is "closed" and small, or would a flagged subset of the production environment suffice and reduce operational surface? A cost/risk tradeoff for whoever owns infrastructure budget. |
| `DPQ-4` | Should the quarterly restore drill (`ADM-110`) and the pre-GA/annual incident-response tabletop (`SR-L05`) be tracked as recurring `TASK-*` records (`ai-development-harness.md §4`) once implementation begins, so they're not just prose commitments? |

---

## 20. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-23 | Initial draft. Defines environments, infrastructure, database/API/Web/Android deployment, configuration, secrets, monitoring, logging, alerts, backup, disaster recovery, incident response, the end-to-end deployment procedure (mapped to the five named CI/CD workflow files), and a post-deployment verification checklist. §14 (Rollback) is new content — the first specification of a rollback procedure anywhere in the corpus, resolving `release-readiness-assessment.md`'s open item `RRQ-2`. No deployment performed. |
