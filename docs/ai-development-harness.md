# Cricket Scoring Book — AI Development Harness

| | |
|---|---|
| **Document** | AI Development Harness |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-22 |
| **Upstream** | `docs/ai-context-pack.md` v0.1.0 and, through it, `docs/master-specification.md` v0.1.0 and all 18 constituents it assembles. This document invents no engineering decision — it defines *process* only. |
| **Downstream** | Every future AI coding session's actual task-by-task workflow, once implementation is authorized. `TASK-*` and `RCR-*` records this process produces. |
| **Status** | A **repeatable workflow specification** — the procedure an AI session follows for any unit of work on this repository, from picking up a task to updating the spec corpus afterward. No implementation code. No task-tracking tooling built. |

> **Relationship to the AI Context Pack:** `ai-context-pack.md` is *what* an AI session must know before touching this repository. This document is *how* it uses that knowledge, task by task. Load both; this one governs process, that one governs content.

---

## 0. Purpose and scope

This repository has no application code yet (`ai-context-pack.md §0.4`). This document exists so that when implementation *is* authorized, every task — the first and the thousandth — goes through the same repeatable loop, with the same evidence produced, the same gates enforced, and the same guarantee: **an AI session never silently changes an approved requirement.** §11 makes that guarantee precise; every other section exists to make it operationally enforceable rather than aspirational.

The loop is eight stages, always in this order, always closing back on itself:

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                                                                        │
   ▼                                                                        │
Context → Prompt → Plan → Implement → Test → Verify → Review → Update Context
            ▲         │                                            │
            │         └── Gate G1: Plan approval ────► Implement    │
            │                                                       │
            └── Gate G2: Review approval ────► merge ────────────────┘
```

`Update Context` is not a wrap-up formality — it is what makes `Context` for the *next* task accurate. A task that skips it leaves the next AI session working from a stale picture.

---

## 1. The eight stages, defined

### 1.1 Context

**What happens:** the AI session loads the Required Context Files (§2) for the task at hand — always the minimum set, plus whatever extended set the task's Requirement References (§5) pull in.

**Input:** a task request (a `TASK-*` record, §4, or a raw human ask the session must first formalize into one).
**Output:** a working context set the session can name explicitly (which files, which versions).
**Gate:** none — but if a required file can't be found or is a version the session can't confirm is current, the session stops and says so rather than guessing. This is the first place `FA-*` forbidden assumptions (`ai-context-pack.md §12`) get checked.

### 1.2 Prompt

**What happens:** the task is expressed using a Prompt Template (§3) filled into the Task Format (§4). Either the human issues it already-formatted, or the AI session formalizes a loose request into one before proceeding — and shows the human the formalized version before treating it as authoritative.

**Input:** the raw ask.
**Output:** a `TASK-*` record: requirement references, scope, acceptance criteria, constraints, definition of done.
**Gate:** none directly, but a task with zero requirement references cannot advance past Plan (§5, §8 Gate G1).

### 1.3 Plan

**What happens:** the AI produces a written plan *before writing any code*: which files it will touch (mapped to `repository-structure.md` directories), which requirement/rule IDs it satisfies, which test tier(s) it will add or extend, and — critically — any point where the approved spec is ambiguous, silent, or (rarely) appears wrong for what's being asked. Ambiguities are flagged in the plan, never resolved by silent judgment call.

**Input:** the `TASK-*` record.
**Output:** a Plan document (§6.1 defines its exact shape).
**Gate:** **G1 — Plan approval.** No implementation begins until a human approves the plan. This is the cheapest point to catch a misunderstanding — before a single line of code exists.

### 1.4 Implement

**What happens:** code is written strictly within the approved plan's scope, following Coding Rules, Naming Conventions, and Architecture Rules (`ai-context-pack.md §5–§7`). No drive-by refactors, no scope creep beyond what Plan named — a task that discovers it needs more scope stops and amends the plan (back to §1.3), it doesn't silently expand.

**Input:** the approved plan.
**Output:** a diff. §6.2 defines its exact shape.
**Gate:** none mid-stage, but Implement output is meaningless without passing Test/Verify next — no task is "done" at Implement.

### 1.5 Test

**What happens:** the test tier(s) named in the plan are written and run, per Testing Rules (`ai-context-pack.md §9`) — including a conformance-corpus addition (`live-scoring.md`'s `C*`/`EX-*` catalogue) for anything touching the scoring core, and a co-located test per `repository-structure.md §10.1`'s policy.

**Input:** the implementation diff.
**Output:** test files/changes, and a run result (pass/fail per test).
**Gate:** none directly — a failing test blocks Verify (§1.6), not a separate gate of its own.

### 1.6 Verify

**What happens:** the objective checks in §7 run — traceability, test results, acceptance-criteria satisfaction, scope containment, and the requirement-integrity check (§11). This stage is mechanical wherever possible; it exists to make Review (§1.7) a human judgment call on a pre-verified diff, not a search for basic defects.

**Input:** the diff + test results.
**Output:** a Verification Report (§7.4).
**Gate:** a failed verification check returns the task to Implement or Test — it does not proceed to Review.

### 1.7 Review

**What happens:** a human reviews the diff, the Plan it was built from, and the Verification Report — and either approves or sends it back with specific requested changes.

**Input:** the diff + Verification Report.
**Output:** an approval or a change request.
**Gate:** **G2 — Review approval.** No merge, no commit beyond a local/draft state, without this (and see `ai-context-pack.md §10`: no commit at all without explicit authorization, independent of Review).

### 1.8 Update Context

**What happens:** the documentation-update mechanics in §9 run — change logs, traceability, README wiring, and (if the task surfaced a new durable rule) a proposed addition to `ai-context-pack.md` itself. This is what makes the *next* task's Context stage (§1.1) start from an accurate picture.

**Input:** the merged/approved change.
**Output:** updated spec documents, ready for the next task's Context stage.
**Gate:** none new — but a task is not complete until this stage runs, even if the code itself is already merged.

---

## 2. Required context files

Every task loads a **minimum set**, plus an **extended set** determined by what the task actually touches.

### 2.1 Minimum set — every task, no exception

1. `docs/ai-context-pack.md` — the constitution, rules, and ID legend.
2. `docs/master-specification.md §0` — the precedence rule, and §16.1 for the current constituent manifest/version list.
3. This document (`docs/ai-development-harness.md`).

### 2.2 Extended set — determined by the task's requirement references (§5)

| If the task touches… | Also load |
|---|---|
| Scoring rules/engine behavior | `specs/live-scoring.md`, `specs/cricket-rules-reference.md` |
| Offline/sync behavior | `architecture/offline-first-specification.md` |
| Any schema/table | `architecture/data-specification.md` |
| Any endpoint | `architecture/api-specification.md` |
| Auth, roles, encryption, rate limits | `architecture/security-specification.md` |
| A screen/workflow | `ux/ux-specification.md` |
| File/directory placement | `architecture/repository-structure.md` |
| Test strategy or new test tier | `architecture/testing-strategy.md`, `architecture/acceptance-criteria.md` |
| A requirement's own precise text | `specs/software-requirements-specification.md` |

**Rule:** a task must not proceed past Plan (§1.3) having loaded only the minimum set if its requirement references (§5) fall in any extended-set row above — Plan review checks this.

---

## 3. Prompt templates

Four templates, one per task type. A task's `Type` field (§4) selects which applies. Fill every bracketed field; an empty `Requirement references` field is only valid for `Spec-Clarification` and `Regression-Triage` types.

### T1 — Implementation task (feature, requirement-driven)

```
Type: Feature
Requirement references: [FR-###, DR-##, MINV-##, …]
Summary: [one sentence — what capability this delivers]
Scope — in: [files/directories/behaviors this task covers]
Scope — out: [explicitly excluded, so Plan doesn't silently expand]
Acceptance criteria: [existing AC IDs from acceptance-criteria.md, or "new — to be drafted in Plan"]
Constraints: [any ai-context-pack.md rule ID that specifically binds this task]
Definition of done: [what "complete" looks like, objectively]
```

### T2 — Bug fix / regression task

```
Type: Bugfix | Regression
Requirement references: [the ID(s) the current behavior violates]
Regression record: [REG-#### if this traces to a logged regression, §10]
Symptom: [observed vs. expected, concretely]
Reproduction: [Given/When/Then, acceptance-criteria style]
Scope — in / out: [as T1]
Definition of done: [failing case now passes; regression test added]
```

### T3 — Requirement Change Request (spec change)

```
Type: Spec-Change
Requirement reference (current text): [the ID being changed]
Reason: [what's wrong, ambiguous, or infeasible about the current text — cite where this surfaced]
Proposed new text: [exact replacement]
Impact analysis: [what else in the corpus (other IDs, code already built, tests) does this touch]
Requested approver: [human — this task type cannot self-approve, see Gate G3 (§8) and §11]
```

### T4 — Spec clarification / open-question resolution

```
Type: Spec-Clarification
Open item reference: [an existing *Q-*/SPK-*/A-* ID from ai-context-pack.md §14, or "new"]
Question: [precisely what's unresolved]
Options considered: [if any]
Recommendation: [optional — the task issuer's leaning, clearly marked as non-binding]
```

---

## 4. Task format

The canonical schema every prompt template (§3) fills into. This is what a `TASK-*` record *is* — the unit the rest of this workflow operates on.

```
Task ID:                TASK-####
Title:
Type:                   Feature | Bugfix | Regression | Refactor | Spec-Change | Test-Only | Docs-Only
Requirement references:  [mandatory — see §5]
Scope — in:
Scope — out:
Acceptance criteria references:
Constraints:             [ai-context-pack.md rule IDs, e.g. C-6, SR-B01]
Definition of done:
Approval gate(s) required: G1 (Plan) | G2 (Review) | G1+G2 | G3 (if Spec-Change, §8)
Status:                  Drafted | Plan-approved | Implementing | Testing | Verifying | In-review | Merged | Context-updated
```

`Task ID`s are sequential and never reused, even for an abandoned task — an abandoned `TASK-0042` stays `TASK-0042: abandoned`, it is not recycled. This preserves an honest audit trail.

---

## 5. Requirement references

**Rule:** every task (except `Spec-Clarification`, §3 T4) must cite at least one ID from the legend in `ai-context-pack.md §14`. A task with no citable ID means one of two things, and the task must say which before proceeding:

1. **The requirement exists but the task issuer doesn't know the ID** — resolve by searching the owning document (the legend's right-hand column), not by proceeding without one.
2. **No requirement exists for what's being asked** — this is a spec gap, not an implementation task. It must go through **T3 (Requirement Change Request)** or, if it's genuinely new scope rather than a change to existing text, a new requirement must be proposed and approved into its owning document first (same gate, G3, §8). The AI does not write code against an uncited assumption.

Citing an ID that turns out not to exist (a hallucinated ID) is a Verify-stage failure (§7.2) — this is exactly the class of error the traceability check exists to catch.

---

## 6. Expected AI output

What "done" looks like at each stage that produces AI output. A task that doesn't produce these shapes is not ready for its next gate.

### 6.1 Plan output

- Requirement/rule IDs this task satisfies, and the exact document sections consulted.
- Files/directories to be touched, mapped to `repository-structure.md`.
- Test tier(s) to be added/extended, and whether the conformance corpus needs a new case.
- **Open questions or ambiguities**, explicitly listed — never silently resolved (§11).
- Anything the plan believes the spec gets wrong, filed as a *proposed* T3, not implemented against.

### 6.2 Implement output

- A diff scoped exactly to the approved plan — no unrelated files.
- Code following `ai-context-pack.md §6` (Coding Rules) and §7 (Naming Conventions) without exception.
- No requirement text edited by this stage under any circumstance (§11) — only code, and only spec *change logs* if a G3-approved RCR already exists.

### 6.3 Test output

- New/updated test files at the location `repository-structure.md §10.1` specifies (co-located, unless genuinely cross-cutting).
- A run result per test, not just an aggregate pass/fail.
- For scoring-core changes: a new `C*`/`EX-*` conformance case, not just a bespoke unit test.

### 6.4 Verify output

- The Verification Report, §7.4.

### 6.5 Review output

- Human-authored: approve, or specific requested changes referencing exact lines/files. The AI may pre-fill a review checklist from the Verification Report, but the decision itself is never AI-authored as final.

---

## 7. Verification process

Objective, mechanical checks — the point of this stage is that Review (§1.7) starts from a pre-verified diff, not a blank search for problems.

### 7.1 Scope containment check
Every changed file appears in the approved Plan's file list (§6.1). A file outside that list fails verification — even if the change looks harmless — and the task returns to Plan to either justify the expansion or drop it.

### 7.2 Traceability check
Every requirement/rule ID cited in the task, plan, or code comments actually exists in `ai-context-pack.md §14`'s legend (or its owning document, if newly added there under a G3-approved RCR). A hallucinated ID fails verification.

### 7.3 Requirement-integrity check
No approved requirement's text differs from what's currently in its owning document, *unless* the diff also includes that document's change-log entry citing an approved `RCR-*` (§11). This is the single check that exists specifically to enforce "AI must never silently change approved requirements" — it is not optional and not overridable by any other passing check.

### 7.4 Test/CI results
All test tiers named in the Plan pass, per the CI gate list `testing-strategy.md §21` maps to `.github/workflows/*.yml` (`repository-structure.md §12`). For scoring-core changes, the conformance corpus passes on Web, Android, and backend builds identically (parity check, `ai-context-pack.md C-7`).

### 7.5 Acceptance-criteria check
Every acceptance criterion the task cited (§4) is demonstrably satisfied — and if the task added a new Given/When/Then, it passes the objectivity rule (`acceptance-criteria.md §1`, no banned subjective language).

**Verification Report shape:**

```
Task:                  TASK-####
7.1 Scope containment:  PASS | FAIL — [file(s) outside plan]
7.2 Traceability:       PASS | FAIL — [unresolved ID(s)]
7.3 Requirement integrity: PASS | FAIL — [ID(s) changed without an approved RCR]
7.4 Test/CI results:    PASS | FAIL — [failing tier(s)]
7.5 Acceptance criteria: PASS | FAIL — [unmet AC ID(s)]
Overall:                READY FOR REVIEW | RETURNED TO [stage]
```

A single FAIL anywhere returns the task to the stage that can fix it — never straight to Review with a caveat.

---

## 8. Human approval gates

| Gate | Triggers on | Who approves | Unlocks |
|---|---|---|---|
| **G1 — Plan approval** | Every task, after §1.3 | A human | Implement (§1.4) |
| **G2 — Review approval** | Every task, after Verify passes (§1.6) | A human | Merge, and Update Context (§1.8) |
| **G3 — Requirement Change Request approval** | Any `Spec-Change` task (T3, §3), or any plan that flags the spec as wrong (§6.1) | A human, explicitly — never inferred from silence or from a passing test suite | Editing the requirement's own text (§11) |
| **G4 — Destructive git operation approval** | Force-push, history rewrite, hard reset, branch deletion — per `ai-context-pack.md §10.2` | A human, per-instance — a prior approval does not carry forward | The specific operation requested, that instance only |
| **G5 — Blocking-regression severity confirmation** | A regression classified `Blocking` (§10.3) | A human | Whether the regression halts the current release gate (`product-roadmap.md`) |

No gate is satisfied by an AI session's own assessment that the work "looks right" — every row above requires a human decision, recorded against the `TASK-*` or `REG-*` it applies to.

---

## 9. Documentation update process

The mechanics of Update Context (§1.8), run for every merged task without exception:

1. **Change log.** Every spec document the task actually touched gets a change-log entry (its own §-numbered change-log section, per `ai-context-pack.md §11.3`), citing the `TASK-*` (and `RCR-*`, if applicable).
2. **Manifest sync.** If a constituent document's version changed, `master-specification.md §16.1` is updated in the same change (`ai-context-pack.md §11.7`).
3. **Traceability sync.** If the task added a new ID of any kind (a `TASK-*`, a test case, an ADR, a requirement via an approved RCR), the relevant traceability matrix (`master-specification.md §12`, or the owning document's own) is updated to include it.
4. **README wiring.** If the task created a new top-level document, it is added to `docs/README.md` (table + reading order) and the root `README.md` in the same change — never deferred to a later task.
5. **Context Pack evolution.** If the task surfaced a durable rule, convention, or forbidden assumption that wasn't already in `ai-context-pack.md`, a proposed addition to the relevant section (§1, §6, §7, or §12 of that document) is drafted as part of this stage — not left as tribal knowledge in a closed task.
6. **Commit discipline.** All of the above follows `ai-context-pack.md §10` — committed only on explicit authorization, with the established message style, never bundled with an unrelated change.

A task's `Status` (§4) does not read `Context-updated` until all five applicable steps above are done.

---

## 10. Regression process

### 10.1 Detection
A regression surfaces from one of: a CI gate failure on a previously-passing suite, a conformance-corpus case that starts failing, a manual QA finding, or a production/pilot report.

### 10.2 Logging
Every regression gets a `REG-####` record:

```
Regression ID:      REG-####
Detected via:        CI | Conformance corpus | Manual QA | Production report
Symptom:              [observed behavior]
Requirement(s) violated: [ID(s) — a regression with no identifiable violated requirement is itself a spec-gap, route to T3/T4]
Severity:             Blocking | Non-blocking
Suspected cause:       Implementation defect | Spec defect | Test defect
Linked task/commit:    [what introduced it, if known]
```

### 10.3 Triage
- **Blocking** regressions require Gate G5 (§8) before the current release proceeds past its next roadmap gate (`product-roadmap.md`).
- **Non-blocking** regressions are scheduled as a normal `TASK-*` (Type: `Regression`, T2 template, §3).

### 10.4 Root-cause routing — this is where regressions intersect §11
- **Implementation defect** (code doesn't match the approved spec): a normal Bugfix/Regression task, full eight-stage loop, no RCR needed.
- **Spec defect** (the spec itself is wrong or the implementation correctly follows a spec that turns out to be a mistake): **must** go through a T3 Requirement Change Request and Gate G3 before any code changes — the fix is not "make the code match what we now think is right," it is "get the spec corrected and approved, then make the code match the corrected spec." Skipping straight to a code fix here is exactly the silent-requirement-change failure §11 exists to prevent.
- **Test defect** (the test itself was wrong): a `Test-Only` task, still through full Review (G2) — a wrong test is itself a spec-interpretation error and gets the same scrutiny as a code error.

### 10.5 Closure
A `REG-*` closes only when its linked task reaches `Context-updated` (§9) **and** a regression test exists that would have caught it — for scoring-core regressions, this means a new permanent `C*` case is added to `live-scoring.md §21`, growing the conformance corpus rather than leaving a one-off test as the only guard.

---

## 11. AI must never silently change approved requirements

This is the harness's central guarantee. Every gate, check, and process above exists in service of it.

### 11.1 What counts as an "approved requirement"
Any ID in the legend at `ai-context-pack.md §14` that belongs to a document currently at a released draft version (every constituent is `v0.1.0` as of this document's date — see `master-specification.md §16.1`) and is not itself listed as an open item (`*Q-*`, `SPK-*`) in that document's own open-questions section. An item still marked open is not yet "approved" and is handled via T4 (§3), not this section.

### 11.2 What counts as a "silent change"
Any of the following, without a corresponding G3-approved `RCR-*`:
- Editing a requirement's stated text, value, or acceptance criterion.
- Implementing code whose behavior contradicts a requirement's stated text — even if the code "seems more correct" (this is the spec-defect path in §10.4, not a code-only fix).
- Letting an implementation detail become the de facto spec by never updating the written requirement to match what was actually built, so the two silently diverge over time.
- Resolving a flagged Plan-stage ambiguity (§6.1) by picking an interpretation and proceeding, instead of surfacing it at Gate G1.

### 11.3 The mandatory alternative
1. **Stop.** Do not write code against the deviation.
2. **Flag it** — in the Plan (§6.1) if caught before Implement, or as an immediate task-status change to `Blocked: spec issue` if caught during Implement/Test/Verify.
3. **Draft a Requirement Change Request** (T3, §3) — current text, proposed text, reason, impact analysis.
4. **Route to Gate G3** (§8) — a human, not the AI session, decides whether the requirement changes.
5. **Only on approval:** the requirement's owning document is edited, its change log records the `RCR-*` (§9.1), and *then* implementation may proceed against the new text — as a normal task through the full eight-stage loop.

### 11.4 Why this is non-negotiable
Every other guarantee in this corpus — determinism (`C-3`), law-accuracy (`C-8`), auditability (`C-9`), traceability (§14 of the context pack) — depends on the written requirement and the running system never being allowed to quietly drift apart. A silent change breaks that chain invisibly; an RCR breaks it visibly, with a record, a reason, and a decision-maker. The harness is indifferent to how good the AI's judgment is in a given instance — the process does not grant an exception for confidence.

---

## 12. New ID prefixes this document mints

Per `ai-context-pack.md §7` (Naming Conventions: new traceable-item categories are minted and registered in the ID legend, never left ad hoc or overloaded onto an existing prefix), this document introduces three prefixes, registered back into `ai-context-pack.md §14` in the same change that publishes this document:

| Prefix | Meaning | Owning document |
|---|---|---|
| `TASK-####` | A unit of work through the eight-stage workflow | This document, §4 |
| `RCR-####` | A Requirement Change Request | This document, §3 T3, §11 |
| `REG-####` | A logged regression | This document, §10 |
| `FB-####` | A collected feedback item (post-release) | This document, §13.2 |

---

## 13. The continuous product-development loop (post-release)

### 13.1 The outer loop, and how it contains the inner one

§1's eight stages are what happens *inside one task*. This section is the loop that runs *forever, across all tasks*, once a release exists to observe:

```
Observe → Collect Feedback → Describe → Decompose → Specify → Plan → Implement → Test → Verify → Release → Observe → …
```

The middle four stages — **Plan → Implement → Test → Verify** — are not a new procedure; they *are* §1.3–§1.6 of the eight-stage workflow, unchanged. The outer loop's real content is what wraps them: where a change comes from (**Observe, Collect Feedback**), how it becomes a well-formed task (**Describe, Decompose, Specify**), and how a verified change actually reaches users and starts the cycle again (**Release**, then **Observe** once more).

| Outer stage | What happens | Governed by |
|---|---|---|
| **Observe** | Production telemetry, monitoring, and synthetic checks reveal the real-world effect of the last release — reliability, performance, business/quality metrics | `deployment-plan.md §9–§11` (Monitoring/Logging/Alerts); `system-architecture.md §3.13`'s observability pillars |
| **Collect Feedback** | Scorer-reported issues, opt-in feedback telemetry (`system-architecture.md §3.13`'s "Feedback telemetry" row — time-per-delivery, undo/correction rate, override rate, all privacy-respecting and opt-outable per `NFR-042`), and support/pilot-league input are captured as `FB-####` records (§13.2) | New — this section |
| **Describe** | A `FB-*` item or an internally-identified need is stated as a problem/opportunity, the same way the original product was (`product-foundation.md`'s own role, restated for an increment rather than the whole product) | `product-foundation.md`'s method, reused |
| **Decompose** | Broken into personas/journeys/requirements with IDs, the same way `product-discovery.md` did originally | `product-discovery.md`'s method, reused |
| **Specify** | The owning specification document(s) are updated — this is where 3 of §13.3's eleven per-change steps ("Update specification," "Update architecture if necessary," "Update acceptance criteria") concretely happen | The relevant document, found via `ai-context-pack.md §14`'s ID legend |
| **Plan** | = §1.3. Output: an approved `TASK-*` | §1.3, Gate `G1` |
| **Implement** | = §1.4 | §1.4 |
| **Test** | = §1.5 | §1.5 |
| **Verify** | = §1.6, §7 | §1.6, §7 |
| **Release** | The verified change actually ships | `deployment-plan.md §16`'s procedure, Gate `G2`/`G4` as applicable |
| **Observe** (again) | The loop closes — the just-shipped change's real effect is what the next iteration's Observe stage sees | Back to the top |

**A `FB-*` item that turns out to require changing an already-approved requirement's text does not skip straight to Specify** — it routes through §11's Requirement Change Request process first (`RCR-*`), exactly as any other proposed requirement change does. Feedback is an *input* to Describe/Decompose, never a shortcut around the RCR gate.

### 13.2 Collecting feedback — what's specified, what's still open

`FB-####` records the raw input to this loop:

```
Feedback ID:     FB-####
Source:          Scorer-reported | Opt-in feedback telemetry | Pilot-league input | Support | Internal observation
Observed at:     [Observe-stage metric/event that surfaced it, if applicable]
Description:
Linked to:       [TASK-*/RCR-*/REG-* it was decomposed into, once triaged]
```

What already exists to feed this: `system-architecture.md §3.13`'s feedback-telemetry metrics (quantitative), the pilot dashboard ("feeds Build→Verify→Feedback→Improve," same source). **What does not yet exist**: a specified channel or process for a scorer to directly *report* an issue (as opposed to it showing up in telemetry) — this is a real, currently-open gap, not silently assumed; see `HQ-6` (§16).

### 13.3 The eleven-step per-change checklist, mapped

Every change moving through Specify→…→Release performs these eleven steps, each already governed by an existing mechanism — this is a checklist, not new process:

| # | Step | Maps to |
|---|---|---|
| 1 | Create/change requirement | **Describe/Decompose** (§13.1). Changing an *existing approved* requirement is always an `RCR-*` (§11) — never a direct edit. |
| 2 | Update specification | **Specify**; the owning document per `ai-context-pack.md §14`. |
| 3 | Update architecture if necessary | **Specify**; requires Gate `G3` (§8) if it's a genuine architectural change, not merely additive detail. |
| 4 | Update acceptance criteria | **Specify**; `acceptance-criteria.md`, its objectivity rule (§1.1–1.2 of that document) applies unchanged. |
| 5 | Create implementation task | **Plan** (§1.3); a `TASK-*` per §4. |
| 6 | Implement | §1.4. |
| 7 | Test | §1.5. |
| 8 | Verify | §1.6, §7. |
| 9 | Update documentation | §9 (Documentation update process) — already fully specified, applied here without modification. |
| 10 | Record decision | **New systematic requirement**, see §13.4. |
| 11 | Release | `deployment-plan.md §16`. |

### 13.4 "Record decision" — the one step this loop adds new weight to

Every prior deliverable in this corpus recorded architecture/technology decisions as ADRs (`system-architecture.md §8`, `technology-stack.md §4`), but did so per-document, at authoring time — not as a standing per-change habit. Going forward: **any change that crosses Gate `G3`** (an architecture-affecting change, §8) or **resolves an `RCR-*`** produces a new ADR entry in the relevant list, and `master-specification.md §13`'s consolidated ADR index is updated in the same change (§9's Documentation Update Process, applied to this specific artifact type). A change that stays within existing architecture and doesn't touch an approved requirement's text does **not** need a new ADR — this is scoped to genuinely significant decisions, matching the existing ADR sets' own bar, not every change indiscriminately.

### 13.5 Two closing instructions, confirmed already enforced, not new

- **"The Master Specification remains the source of truth"** — this is `master-specification.md §0`'s own precedence rule, already standing; this loop does not alter it, it operates entirely within it.
- **"AI must never introduce undocumented behavior"** — this is `§11` of this document (never silently change approved requirements) combined with `ai-context-pack.md §6` Coding Rule 1 (every unit of code must trace to a rule ID): behavior with no traceable spec ID is, by definition, undocumented, and both rules already forbid writing it. Stated here as a restatement, confirmed consistent with the rest of the corpus rather than adding new content.

---

## 14. Standing enforcement rules

Twenty rules, given as standing instructions for every future request on this project. Cross-referenced below to where each is already enforced in this corpus — the large majority are not new; two (marked) needed the systematization added in §13.4 and §15.

| # | Rule | Already enforced by |
|---|---|---|
| 1 | Specification before implementation | `ai-context-pack.md C-10`; this document's own Plan-before-Implement ordering (§1.3–1.4) |
| 2 | Context before prompting | §1.1–1.2, §2 (Required context files) |
| 3 | Small tasks before large changes | §1's sizing rule (`implementation-task-backlog.md §1`) |
| 4 | Requirements must have IDs | `ai-context-pack.md §14`; §5 (Requirement references) |
| 5 | Code must map to requirements | `ai-context-pack.md §6` Coding Rule 1 |
| 6 | Code must have tests | `ai-context-pack.md §6` Coding Rule 10; §1.5 |
| 7 | Tests must map to acceptance criteria | `ai-context-pack.md §9` Testing Rules; §7.5 |
| 8 | Cricket rules must be deterministic | `ai-context-pack.md C-3`; `live-scoring.md §1` |
| 9 | Offline behavior must be explicitly specified | `ai-context-pack.md C-1`; `offline-first-specification.md`, entire document |
| 10 | Synchronization must be explicitly specified | `offline-first-specification.md §7–§11` |
| 11 | Security must be considered before implementation | `ai-context-pack.md §8` Security Rules |
| 12 | AI must not invent requirements | `ai-context-pack.md FA-9`; §11 of this document |
| 13 | AI must identify uncertainty | §6.1 (Plan output: open questions/ambiguities explicitly listed, never silently resolved) |
| 14 | Architecture changes require explicit approval | Gate `G3` (§8) |
| 15 | Every significant decision becomes an ADR | **Systematized in §13.4** — previously per-document at authoring time, not a standing per-change habit |
| 16 | Every completed task must be verified | §7 |
| 17 | Every defect must produce a reproducible test | §10.5 (regression closure) |
| 18 | The Master Specification is the source of truth | `master-specification.md §0`; restated §13.5 |
| 19 | Human approval is required at defined gates | §8, gates `G1…G5` |
| 20 | Follow the 4Ds + 4 Layers + SDD + Prompt/Context/Harness/Loop methodology throughout | This entire corpus's structure; formalized end-to-end by this document (harness) plus §13 (loop) |

No rule above contradicts anything already standing in the corpus — this table is a confirmation pass, not a new policy layer.

---

## 15. Standing operating instruction — identify before proposing

### 15.1 The role this section operates under

**AI Product Architect** is the standing role for any AI session working on this project — adopted, not merely described, from the point this section was added. It is not a new persona layered on top of everything else in this corpus; it is a name for what §14's twenty rules and this section's five-part preamble already require of the session: hold the Master Specification as authoritative (`ai-context-pack.md §4`, `master-specification.md §0`), refuse to invent requirements (`FA-9`, §11), and require human approval at the defined gates (§8) rather than acting unilaterally on architecture or requirement changes. Adopting the role changes nothing about *what* is enforced — §14 already enforced all twenty rules — it commits to *always* enforcing it, on every future request in this project, not only when a request happens to ask for it.

### 15.2 The five-part preamble

**From adoption of this section forward, for every task given on this project**, before proposing an implementation approach, the first response identifies, explicitly and in this order:

1. **Specification** — which document/section governs this task, cited by ID where one exists.
2. **Context** — which files were loaded (§2's minimum + extended set, applied).
3. **Dependencies** — what must already exist or be true (other `TASK-*`, other documents).
4. **Acceptance criteria** — which existing criteria apply, or that new ones need drafting.
5. **Verification method** — which of §7's checks, and which test tier(s) (`ai-context-pack.md §9`).

This is not new process — it is §1.2 (Prompt) and §1.3 (Plan) made mandatory and front-loaded rather than optional structure a task might skip under time pressure. A task that cannot state all five before proposing implementation is a task that isn't ready for Plan yet, and says so rather than proceeding anyway.

---

## 16. Open items

| ID | Question |
|---|---|
| `HQ-1` | Where do `TASK-*`/`RCR-*`/`REG-*` records physically live once implementation starts — a `tasks/` directory, an issue tracker, or a database table? This document assumes the schema (§4, §10.2) but not the storage mechanism. |
| `HQ-2` | Who holds Gate G1/G2/G3 authority in practice — a single maintainer, or a named reviewer role from the security spec's actor set (`security-specification.md §4.2`)? |
| `HQ-3` | Should `Docs-Only` tasks (§4) require Gate G1 (Plan), or only G2 (Review), given they can't fail the requirement-integrity check (§7.3) the same way code can? |
| `HQ-4` | Does a `Test-Only` task that only *adds* conformance cases (no behavior change) need the full plan-approval ceremony, or a lighter variant? |
| `HQ-5` | How does this harness interact with `SPK-01…06` (blocking spikes) — does a spike itself run through this workflow, or is it explicitly outside it until it resolves into a normal requirement? |
| `HQ-6` | §13.2 flags that no channel/process exists yet for a scorer to *directly report* feedback (as opposed to it showing up in telemetry) — new UX screen, an existing support channel, or explicitly out of scope for MVP/V1? |
| `HQ-7` | Where do `FB-*` records live — same storage mechanism as `HQ-1`'s `TASK-*`/`RCR-*`/`REG-*`, or a separate feedback-tracking system entirely? |
| `HQ-8` | §13.4's ADR-per-significant-decision rule needs a bar for "significant" beyond "crossed Gate G3 or resolved an RCR" — is that bar sufficient, or should some G1-only decisions (e.g., a non-architectural but still consequential product choice) also warrant an ADR? |

---

## 17. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-22 | Initial draft. Defines the eight-stage Context→Prompt→Plan→Implement→Test→Verify→Review→Update Context workflow; required context files; four prompt templates; the task schema; the requirement-reference rule; expected AI output per stage; the five-check verification process; five human approval gates; the regression process with explicit spec-defect routing; the documentation-update mechanics; and the central "never silently change an approved requirement" guarantee with its mandatory RCR alternative. Mints `TASK-*`, `RCR-*`, `REG-*`. |
| 0.1.0 | 2026-09-23 | Adds §13 (the continuous post-release product-development loop: Observe→Collect Feedback→Describe→Decompose→Specify→Plan→Implement→Test→Verify→Release→Observe, containing the original eight-stage loop as its middle four stages; the eleven-step per-change checklist, mapped to existing mechanisms; systematizes ADR recording as a per-significant-decision habit), §14 (the twenty standing enforcement rules, cross-referenced — confirmation, not new policy), and §15 (the standing operating instruction to identify specification/context/dependencies/acceptance-criteria/verification-method before proposing implementation on every future task). Mints `FB-*`. Renumbers former §13–14 to §16–17. |
| 0.1.0 | 2026-09-23 | §15.1 added: names and formally adopts **AI Product Architect** as the standing role for every AI session on this project, binding §14's twenty rules and §15.2's preamble as an always-on commitment rather than content invoked only on request. No new enforcement content — a naming and adoption of what already existed. |
