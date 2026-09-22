# Cricket Scoring Book — UX Specification

| | |
|---|---|
| **Document** | UX Specification |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-21 |
| **Upstream** | `docs/specs/software-requirements-specification.md` v0.1.0 · `docs/architecture/system-architecture.md` v0.1.0 · `docs/architecture/technology-stack.md` v0.1.0 · `docs/roadmap/product-roadmap.md` v0.1.0 · `docs/domain/glossary.md` v0.1.0 |
| **Downstream** | Wireframes / high-fidelity design · component library (Radix + Tailwind per `ADR-T02`) · client implementation |
| **Status** | Interaction and information-architecture specification. **No UI code, no markup, no component code.** Layout is described in words (zones, groupings, priority) so a designer or an AI-assisted implementer can build the screen without this document prescribing pixels or markup. |

> Defines every screen and cross-screen workflow needed to deliver the MVP → Version 1 scoring experience (plus the Version 2 surfaces — dual-scorer conflict resolution, administration — specified now so the substrate doesn't need rework). Each screen has **Purpose, Inputs, Actions, Validation, States, Error handling, Empty states, Offline behavior, Accessibility requirements**, plus a one-line **Trace** to the SRS requirements it realises so nothing here is invented without a source.

---

## 1. How to read this document

### 1.1 Scope and non-scope

**In scope:** the interaction model, information architecture, screen-by-screen behaviour, state machines, error/empty/offline handling, and accessibility requirements for the Web PWA and Android clients.

**Out of scope:** visual design (colour, type, spacing tokens — see the `dataviz`/`artifact-design` design language separately if a marketing surface is ever built), component markup or code (`ADR-T02`/`ADR-T03` chose the frameworks; this document does not write against them), pixel-level layout, and copywriting (example strings below are illustrative, not final UX writing).

### 1.2 Platform notes

Two clients share one **scoring core** (`ADR-T01`) and are expected to feel like the same product with platform-appropriate ergonomics:

| | Web (PWA) | Android |
|---|---|---|
| Primary posture | Two-handed, often at a desk/laptop, sometimes tablet in a scorebox | **One-handed**, standing, in the field (`NFR-020`) |
| Primary input | Keyboard-first with mouse/touch fallback (`WEB-003`) | Touch, large gloved-use targets (`NFR-021`) |
| Layout | Can use a multi-pane layout on large screens (`FR-164`) | Single-column, thumb-zone-first (`AND-002`) |
| Distinguishing affordance | Hotkeys, print stylesheets, browser back/forward | Haptics (optional), OS share sheet, hardware back button |

Every screen below is written platform-neutral; where a platform materially changes **Inputs**, **Actions**, or **Accessibility**, it is called out inline as **(Web)** / **(Android)**.

### 1.3 The screen catalogue

28 screens, grouped into six flows, each carrying a `UX-##` id:

| Group | Screens |
|---|---|
| **A. Identity & Access** | UX-01 Login · UX-02 Registration |
| **B. Home** | UX-03 Dashboard |
| **C. Match Setup** | UX-04 Create Match · UX-05 Match Setup · UX-06 Team Selection · UX-07 Playing XI · UX-08 Toss · UX-09 Innings Setup |
| **D. Live Scoring** | UX-10 Live Scoring · UX-11 Ball Entry · UX-12 Wicket Entry · UX-13 Extras · UX-14 Strike Change · UX-15 Bowler Change · UX-16 Over Completion · UX-17 Score Correction · UX-18 Undo · UX-19 Match Pause/Resume |
| **E. Outputs** | UX-20 Scorecard · UX-21 Ball-by-Ball · UX-22 Match Summary |
| **F. Connectivity** | UX-23 Offline Mode · UX-24 Sync Status · UX-25 Conflict Resolution |
| **G. Records & Config** | UX-26 Match History · UX-27 Settings · UX-28 Administration |

### 1.4 Per-screen template

Every screen in §4 uses the same nine fields, in the order the brief specifies, preceded by a one-line **Trace**. Universal conventions that would otherwise repeat 28 times are pulled out into §2 and referenced, not restated.

---

## 2. Cross-cutting UX conventions

Reference these from every screen; a screen's own sections only state what's *specific* to it.

### 2.1 Canonical state model

Every screen instantiates a subset of this taxonomy — screens don't invent new state names:

| State | Meaning | Universal treatment |
|---|---|---|
| **Loading** | Data requested, not yet available | Skeleton placeholders matching final layout shape, not a generic spinner, for anything on screen > 300 ms |
| **Empty** | No data exists (not an error) | See §2.3 |
| **Populated** | Normal, has data | — |
| **Error** | A request failed | See §2.2 |
| **Offline** | No connectivity | See §2.4 |
| **Guardrail-blocked** | A domain rule prevents the action | See §2.5 |
| **Destructive-confirm** | A hard-to-reverse action is pending | Real modal, focus-trapped, explicit confirm phrase for the highest-risk actions (player merge, account deletion) |
| **Read-only / Final** | Editing is closed (e.g. a signed-off match) | A persistent, non-color-only badge ("Official" / "Final"); edit affordances hidden, not just disabled, except the explicit post-Final correction path |

### 2.2 Error-handling conventions

- **Inline field errors** for validation failures: appear next to the field, on blur or on submit attempt, phrased as what to do ("Enter a number between 1 and 50"), never a raw code.
- **Toast/snackbar** for transient, recoverable, non-blocking failures (e.g. "Couldn't save your note — retrying").
- **Banner** for a persistent condition affecting the whole screen (e.g. reconciliation FAIL, offline-with-queue).
- **Modal** only for something that must be resolved before the user can continue (a blocking guardrail, a destructive confirm).
- **Every error state names the next action.** No dead ends: retry, undo, override-with-reason, or "view detail" is always present.
- Network failures and domain-rule rejections are **never conflated** — different copy, because the user's next action differs (wait/retry vs. change your input).

### 2.3 Empty-state conventions

Every empty state has: (1) a plain-language explanation of *why* it's empty (first use vs. filtered-to-nothing vs. genuinely nothing yet), (2) one primary call-to-action, (3) no dead-end — a filtered-empty state always offers "clear filters."

### 2.4 Offline-first visual language

Per `OFF-021/022` and `system-architecture.md §3.6`:

- A **persistent connectivity indicator** is visible from every screen during an active match (not just a settings sub-page): online-synced / online-syncing / offline-with-queue / offline-caught-up / backend-degraded (§2.5's guardrail styling does **not** apply here — this is informational, not blocking).
- Any data being viewed that is **not guaranteed fresh** (a cached list, a viewer snapshot) carries a "last updated X ago" label (`FR-138`).
- **Scoring inputs are never disabled by connectivity.** If a screen's action requires the network (account creation, publishing a share link), the control stays visible but is clearly marked "requires connection" with the reason, rather than silently failing after submission.
- Queued/pending items (unsynced events, a proposed divergence resolution, a pending invite) are visually distinguished from confirmed ones with a consistent "pending" treatment (icon + label), never hidden.

### 2.5 Guardrail & override pattern

Domain guardrails (`BR-027/028`, over-limits, XI validation, free-hit restrictions) follow one pattern everywhere:

1. **Prevent where possible** — disable/hide the invalid option with a reason, rather than allow-then-reject.
2. **Where prevention isn't possible or an override is legitimate** (`FR-057/059`), block with a modal: state the rule being broken in plain language, require a non-empty **reason**, and log the action (`AUD-005`).
3. **Never silently allow** a guardrail-breaking action with no trace.

### 2.6 Undo vs. Correction

**Undo** (UX-18) reverses only the single most recent action, instantly, with no reason required — it is the low-friction safety net for a mis-tap. **Score Correction** (UX-17) is the deliberate, reasoned, fully-audited edit of *any* prior delivery. Every screen that records an event surfaces Undo as an ambient, always-visible control; only the dedicated correction flow asks for a reason and shows a cascade.

### 2.7 Accessibility baseline (applies to every screen; screen sections add only what's *additional*)

Per `NFR-019…024`, `NFR-037…045`, `AND-021`, `WEB-012`:

- **WCAG 2.2 AA** on all core flows (both platforms' equivalent standard: AA-level contrast, focus visibility, target size).
- **Never color-alone** for state (pair every color cue with an icon and/or text label).
- **Minimum touch target** per `NFR-021`, usable with thin gloves, on all primary scoring controls.
- **Screen-reader / TalkBack labels** on every control describe the action and its object ("Record four runs", not "4"); dynamic content changes use a **polite** live region, batched, never spamming an announcement per keystroke.
- **Focus management**: opening a modal traps focus and returns it to the invoking control on close; a validation failure moves focus to the first error; a multi-step flow (e.g. Wicket Entry) keeps focus order matching the visual/logical order.
- **Keyboard-complete on Web**: every action reachable and operable without a pointer, with documented, remappable hotkeys for the highest-frequency scoring actions (`WEB-003`).
- **High-contrast / large-text / sunlight mode**: a device-wide toggle (Settings, UX-27) that every screen must render correctly against, verified live rather than requiring app restart.
- **Locale-aware**: dates, times and numbers render per the user's locale and the *match* time zone specifically for match data (`NFR-044/045`).

### 2.8 Sync/offline label vocabulary (used consistently across screens)

| Label | Meaning |
|---|---|
| "Saved on this device" | Durably written locally; not yet uploaded |
| "Synced" | Confirmed received and accepted by the backend |
| "Syncing…" | Upload in progress |
| "Couldn't sync — see detail" | Rejected; needs attention (→ UX-24) |
| "Offline" | No connectivity right now |
| "Last updated Xago" | Freshness of a *read* (not a write you made) |

---

## 3. Information architecture & navigation map

```
                                   ┌───────────────┐
                                   │  UX-01 Login   │──── forgot / register ───▶ UX-02 Registration
                                   └───────┬────────┘                                 │
                       continue as guest ──┤◀────────────────────────────────────────┘
                                           ▼
                                   ┌───────────────┐
                        ┌──────────│ UX-03 Dashboard│──────────┐
                        │          └───────┬───────┘           │
                 view history      create match          settings / admin
                        │                  │                    │
                        ▼                  ▼                    ▼
               UX-26 Match History   UX-04 Create Match   UX-27 Settings
                        │                  │              UX-28 Administration
             open match │                  ▼
           (final/live) │          UX-05 Match Setup
                        │                  │
                        │                  ▼
                        │          UX-06 Team Selection
                        │                  │
                        │                  ▼
                        │           UX-07 Playing XI
                        │                  │
                        │                  ▼
                        │              UX-08 Toss
                        │                  │
                        │                  ▼
                        │          UX-09 Innings Setup
                        │                  │
                        │                  ▼
                        └────────▶ UX-10 Live Scoring ◀────────────────────┐
                                    │   │    │    │    │    │              │
                          ┌─────────┘   │    │    │    │    └────────┐     │
                          ▼             ▼    ▼    ▼    ▼             ▼     │
                  UX-11 Ball    UX-12 Wicket │ UX-15  UX-16     UX-19 Pause│
                  Entry          Entry       │ Bowler Over                │
                          │             │    │ Change Completion          │
                          │             │    ▼                           │
                          │             │  UX-13 Extras          UX-14 Strike
                          │             │    │                    Change   │
                          └─────────────┴────┴────────────────────────────┘
                          (all return to Live Scoring; UX-17 Score Correction
                           and UX-18 Undo are reachable from Live Scoring and
                           from UX-20/21 at any time during/after the match)
                                           │
                     innings ends ×2 (or Super Over loop) │
                                           ▼
                                   UX-22 Match Summary ── sign off ──▶ UX-20 Scorecard
                                           │                                 │
                                           │                          UX-21 Ball-by-Ball
                                           ▼
                                (P2) UX-25 Conflict Resolution ◀──── UX-24 Sync Status
                                                                            ▲
                        UX-23 Offline Mode (persistent indicator, ─────────┘
                        every screen) ── expand ──▶ UX-24 Sync Status
```

**Always-reachable, non-modal:** UX-23 (indicator strip, every screen with match data) and UX-18 Undo (ambient control, every scoring screen). **Deep-linkable:** a shared match link opens directly into a read-only variant of UX-20/UX-21/UX-10 with no login required (`FR-137/138`).

---

## 4. Screen specifications

### 4.A Identity & Access

#### UX-01 — Login

**Trace:** `FR-002/003/012`, `SEC-002`, `OFF-013`

**Purpose.** Authenticate a returning user, or route to guest/offline scoring with no account at all.

**Inputs.** Email, password, "keep me signed in" toggle; **(Android)** biometric unlock affordance when a cached session exists.

**Actions.** Sign in · Forgot password · Continue as guest (bypasses login entirely, → UX-03 in local-only mode) · Create account (→ UX-02) · Toggle password visibility · **(Android)** unlock with biometrics.

**Validation.** Email well-formed; password non-empty; both required before Sign in enables; failed-attempt count triggers a progressively worded warning before lockout (never blocks "Continue as guest").

**States.** Idle → Submitting → Success (redirect UX-03) · Error (invalid credential) · Locked-out (rate-limited) · MFA-required (admin accounts) · Offline-with-cached-session (biometric/PIN unlock available) · Offline-no-session (login form disabled, guest path emphasised).

**Error handling.** Invalid credentials show one generic message (no user enumeration); network failure is distinguished from auth failure ("Couldn't reach the server" vs "Email or password is incorrect"); lockout explains the wait or reset path; MFA failure allows retry with a visible attempts-remaining count.

**Empty states.** Not applicable — this is a form-only screen.

**Offline behavior.** With a cached session inside the configured grace window, "Continue offline" bypasses the network entirely (`OFF-013`); with no cached session, only guest mode is offered, and the reason ("You've never signed in on this device") is stated, not just a disabled button.

**Accessibility.** Labels programmatically associated with fields; error text linked via description, not color; focus moves to the first invalid field on submit; password-visibility toggle has a stated accessible name and state; biometric prompt has a text fallback path always visible alongside it.

---

#### UX-02 — Registration

**Trace:** `FR-002/013/014`, `A-12`, `A-15`

**Purpose.** Create a new account, optionally completing an organization invite.

**Inputs.** Name, email, password, confirm password, invite token (pre-filled from a link if present), terms acceptance, guardian-consent flag for a minor registrant.

**Actions.** Create account · Accept invite (auto-applies the pre-assigned role) · Resend verification email · Switch to Sign in.

**Validation.** Email format + server-side uniqueness check; password strength meets policy (live meter); confirm-password match; terms checkbox required; minor flag surfaces the guardian-consent explainer and blocks submission until acknowledged (`NFR-033`).

**States.** Form → Submitting → Success (verify-email prompt shown, not an immediate full session) · Error (email taken / invite expired) · Offline (disabled).

**Error handling.** "Email already registered" offers a direct "Sign in instead" link rather than a dead end; weak password shows the specific unmet rule inline as typed; an expired or already-used invite token explains why and offers "request a new invite" (contacts the inviting org-admin's flow, not a raw error).

**Empty states.** Not applicable.

**Offline behavior.** Account creation requires connectivity (identity is a server concern, `A-12`); when offline the screen states this plainly and offers "Continue as guest instead — claim this account later" (`FR-004`) rather than a disabled form with no explanation.

**Accessibility.** A visible error summary at the top of the form on failed submit, linking to each field; live-region announcement of password-strength changes is throttled (not per-keystroke spam); logical tab order through name → email → password → confirm → consent → submit.

### 4.B Home

#### UX-03 — Dashboard

**Trace:** `FR-157/158`, `FR-138`, `OFF-005/021/022`

**Purpose.** Post-login home: surfaces in-progress/resumable matches, quick actions, and connectivity state; the hub every other flow returns to.

**Inputs.** None entered directly; displays a match list (in-progress, scheduled, recent finals), an organization switcher for multi-org users, and a search field.

**Actions.** Create Match (→ UX-04) · Resume a match (→ UX-10) · Open a final match's scorecard (→ UX-20) · Switch organization · Open Settings (→ UX-27) / Administration (→ UX-28) · Open Match History (→ UX-26) · Pull-to-refresh **(Android)** / refresh control **(Web)**.

**Validation.** Not applicable — display and role-scoped visibility only (an org's matches are shown only to its members).

**States.** Loading (skeleton cards) · Populated · Empty (no matches yet) · Error (fetch failed, falls back to cache) · Offline (locally cached list + persistent indicator, §2.4).

**Error handling.** A failed remote refresh falls back to the last-cached list with a banner ("Showing saved data from [time] — retry") rather than a blank error page; retry is one tap.

**Empty states.** First-time user: "No matches yet" with a single prominent **Create Match** call to action and a short first-run hint pointing at it (supports the guided-first-match target, `NFR-040`).

**Offline behavior.** Guest/local matches are always shown from the local store regardless of connectivity; cloud matches show from the last sync with a freshness label; Create Match and resuming any local match work fully offline.

**Accessibility.** The match list uses list semantics; each card's accessible name summarises state and score in one phrase ("India vs Australia, live, 142 for 3"); a skip-to-content link precedes the list on Web; cards meet the minimum touch target on Android.

### 4.C Match Setup

#### UX-04 — Create Match

**Trace:** `FR-015/016/017/018`, `OFR-001`

**Purpose.** Start a new match: pick a format quickly, or begin from a saved template/competition.

**Inputs.** Match label (auto-suggested, editable), guest-vs-organization ownership toggle, template selector, quick-pick format (T20 / ODI-List A / T10 / The Hundred / Custom).

**Actions.** Start blank · Choose a template · Continue (→ UX-05).

**Validation.** A format must be chosen before Continue enables; if a selected template belongs to a different organization than the current context, it's flagged before use.

**States.** Template list loading · Populated · No templates saved (first-time) · Selection made (Continue enabled).

**Error handling.** Template list fetch failure falls back to the last-synced local cache silently if any exist, otherwise offers "Continue with custom setup" so the flow is never blocked.

**Empty states.** No saved templates: explains that finishing this setup can be saved as a template for next time, and proceeds straight to a blank custom setup.

**Offline behavior.** Fully available offline (`OFR-001`); the template list shows whatever was cached at last sync, clearly labelled as such if offline.

**Accessibility.** Format quick-pick uses grouped radio semantics with a visible legend; the chosen format is announced on selection; Continue's disabled state and the reason are exposed to assistive tech.

---

#### UX-05 — Match Setup

**Trace:** `FR-017/019/020/021/024/025/026/028`, `BR-002`, `BR-017`

**Purpose.** Configure the format's operating parameters — overs, powerplay, bowler cap, tie-breaker rule, venue/date/timezone, officials, minimum overs for a result — and gate scoring until complete.

**Inputs.** Overs per innings, powerplay blocks, per-bowler over cap, tie-breaker rule (Super Over / repeat / boundary count-back / none), venue, date, start time, match time zone, officials (name + role), minimum overs for a valid result, ball type (V1).

**Actions.** Edit any field · Save this setup as a named template · Continue to Team Selection (→ UX-06) · Back.

**Validation.** All numeric fields positive integers within sane bounds; bowler cap consistent with total overs; powerplay overs ≤ total overs; minimum-overs-for-result ≤ total overs; time zone required; **Continue is disabled until every Must-have field is complete**, with a live checklist showing exactly what's missing (`BR-002`).

**States.** Editing → live-validating (as-you-type) → Complete (all green, Continue enabled) · Incomplete (Continue disabled, missing items listed) · Locked (unreachable once first ball is recorded — conditions freeze at first delivery, `BR-017`, edits thereafter route to a reasoned amendment).

**Error handling.** Out-of-range entries show the accepted range inline immediately on blur; a value that conflicts with another field (e.g. powerplay longer than the innings) is flagged on both fields with a shared explanation, not just the second one edited.

**Empty states.** Not applicable — the form always renders with sensible defaults pre-filled.

**Offline behavior.** Entirely local; no network call is needed to configure or proceed (`OFR-001`); the resulting conditions profile syncs later like any other event.

**Accessibility.** Fields grouped by fieldset/legend (Format / Timing / Officials / Result rules); stepper controls fully keyboard-operable; the completeness checklist is a real list with pass/fail per item conveyed by icon + text; validation messages announced politely as they change.

---

#### UX-06 — Team Selection

**Trace:** `FR-030/033`, `A-24`, `OFR-001`

**Purpose.** Choose or create both teams and their squads for the match.

**Inputs.** Team search (organization registry) or quick-add ad-hoc team name; per-team squad list with add/remove; ad-hoc player quick-add (name only).

**Actions.** Search for a team · Select Team A / Team B · Add an ad-hoc player · Remove a player · Swap sides · Continue (→ UX-07).

**Validation.** Two distinct teams required (the same team cannot appear on both sides); squad size ≥ the configured XI size before Continue.

**States.** Search loading · Results populated · No results (offers ad-hoc create) · Team selected, squad editing.

**Error handling.** Selecting the same team on both sides is blocked immediately with an explanation, not deferred to Continue; a search performed offline returns only cached/local matches with a note that results may be incomplete.

**Empty states.** No saved teams yet (first match, per `A-24`): a guided "just add both teams by name" path requires no registry at all.

**Offline behavior.** Full local team/player creation is supported with no connectivity (`FR-030/033`, `OFR-001`); registry search is limited to the last-synced cache and is labelled as such.

**Accessibility.** Team search uses combobox/listbox semantics with results count announced; add/remove-player controls have full descriptive labels including the player's name ("Remove J. Smith from squad"); focus moves sensibly after a list change (to the next item, not lost).

---

#### UX-07 — Playing XI

**Trace:** `FR-031/032/034`, `BR-009/010`

**Purpose.** Select each side's XI (or configured squad size), mark captain and wicket-keeper, and validate before the toss.

**Inputs.** Squad checklist (toggle in/out of the XI), captain picker, wicket-keeper picker, substitute-pool picker, ad-hoc player add.

**Actions.** Toggle a player in/out · Mark captain · Mark keeper · Add an ad-hoc player mid-selection · Continue (→ UX-08).

**Validation.** Exact configured XI count (`BR-009`); exactly one captain and one keeper; no player selected on both sides (`BR-010`); a live "X of 11 selected" counter.

**States.** Selecting (counter incomplete) · Valid (count met + both roles marked → Continue enabled) · Invalid (over/under count or missing role → Continue disabled with the specific reason listed).

**Error handling.** Attempting an over-count selection is blocked at the moment of the extra tap ("XI is full — remove someone first"), not after Continue is pressed; a Continue attempt with no keeper marked shows an inline error and moves focus to the keeper picker.

**Empty states.** Not applicable — the squad list always has content by this point; if it doesn't, the screen routes back to UX-06 with an explanation.

**Offline behavior.** Fully offline-capable — a P1 core requirement.

**Accessibility.** Checkboxes carry the player's name as their accessible label; the selection counter is announced via a polite live region on change; captain/keeper pickers use single-select (radio) semantics; the completeness error links directly to the exact missing item.

---

#### UX-08 — Toss

**Trace:** `FR-023`, `BR-024/026`, `MINV-05`

**Purpose.** Record the toss winner and elected decision, deriving the initial innings order.

**Inputs.** Toss winner (Team A / Team B), decision (Bat / Bowl).

**Actions.** Select winner · Select decision · Confirm · (post-first-ball only) request a reasoned amendment.

**Validation.** Both fields required before Confirm enables; once the first delivery is recorded, the toss becomes locked — the playing-conditions freeze (`MINV-05`) — and further changes require the amendment path with a mandatory reason.

**States.** Unset → Pending-confirm → Confirmed (locked for the match) · Amendment-mode (rare, post-freeze, elevated permission).

**Error handling.** An attempt to edit a frozen toss explains why in plain language and offers the amendment path rather than a flat refusal.

**Empty states.** Not applicable.

**Offline behavior.** Fully offline.

**Accessibility.** Two clearly legended radio groups ("Toss won by" / "Elected to"); Confirm's disabled state and reason are exposed to assistive tech; large, unambiguous selectors rather than relying on a decorative coin-flip animation to convey state.

---

#### UX-09 — Innings Setup

**Trace:** `FR-042`, `DR-10`

**Purpose.** Set the opening striker, non-striker, and opening bowler before the first ball of an innings — used at the start of each innings and before a Super Over.

**Inputs.** Striker picker (from the batting XI), non-striker picker, opening bowler picker (from the bowling XI).

**Actions.** Select each role · Swap striker/non-striker · Confirm & start (→ UX-10).

**Validation.** Three distinct people required; batters must come from the batting side's XI, the bowler from the fielding side's XI (`DR-10`); Confirm stays disabled until all three are set.

**States.** Incomplete (Confirm disabled) · Complete (Confirm enabled) · Reopened for a later innings/Super Over (pre-filled with the correct next-batting side where determinable).

**Error handling.** Selecting the same person as striker and non-striker is blocked inline; picking a bowler from the wrong side is blocked with an explanation naming the correct side.

**Empty states.** Not applicable.

**Offline behavior.** Fully offline.

**Accessibility.** Three clearly labelled single-select pickers; the "swap ends" control's accessible name states its effect explicitly ("Swap striker and non-striker"); Confirm's enabled/disabled transition is announced.

---

### 4.D Live Scoring

#### UX-10 — Live Scoring

**Trace:** `FR-063/065`, `NFR-001/002/012`, `OFF-021/023`

**Purpose.** The persistent scoring hub during an innings: the live-state display and the launch point for every ball-level action. Distinct from UX-11 (the specific run-recording interaction it opens onto).

**Inputs.** None typed here; displays striker, non-striker, bowler, over.ball, score/wickets, extras breakdown, run rate/required run rate, target and balls remaining, DLS par (when a revision is active), a recent-balls strip, and the connectivity indicator.

**Actions.** Score a ball (→ UX-11) · Record a wicket (→ UX-12) · Record an extra (→ UX-13) · Undo last (UX-18, ambient) · Pause (→ UX-19) · Open Ball-by-Ball (→ UX-21) · Open Scorecard (→ UX-20) · Manually review/override strike (→ UX-14) · Respond to the automatic bowler-change prompt (→ UX-15) · Acknowledge the over-completion interstitial (→ UX-16).

**Validation.** Not applicable directly (display + navigation); any blocking guardrail state (e.g. "select a bowler before continuing") surfaces here as an overlay.

**States.** Pre-first-ball (setup complete, awaiting the first delivery) · Active scoring · Between-overs (bowler-select prompt) · Innings break · Paused (rain/drinks/other) · Chasing (target visible) · Reconciliation-blocked (a sign-off attempt failed, banner shown) · Complete (redirects to UX-22).

**Error handling.** A guardrail violation (consecutive over, over-limit) presents as a blocking modal with the rule stated plainly and an override-with-reason path where permitted (§2.5); if the app resumes mid-write, the screen recovers automatically from the durable local log with no user action needed.

**Empty states.** Not reachable before innings setup — navigating here before UX-09 is complete redirects back to it.

**Offline behavior.** The canonical offline-first screen: 100% of its functions work with zero connectivity (`NFR-012`); the connectivity indicator (§2.4) is always visible; no scoring input is ever delayed by a network operation (`OFF-023`).

**Accessibility.** A polite live region announces each ball's outcome concisely ("Dot ball. 45 for 2."); the score display remains legible in sunlight mode; the layout keeps primary actions in the one-handed thumb zone on Android (`AND-002`); documented, remappable keyboard shortcuts on Web.

---

#### UX-11 — Ball Entry

**Trace:** `FR-043/044/048/049/050`, `NFR-001/002/010`, `DR-09`

**Purpose.** Record the outcome of one legal delivery — runs off the bat, boundaries, and overthrow adjustments — as fast as possible.

**Inputs.** Run value (0–6, with overthrow composition for 7+), boundary flag (implicit from the 4/6 controls), optional overthrow add-on, optional free-text commentary note.

**Actions.** Tap a run value (single tap = commit, ≤ 2 interactions per `NFR-001`) · Tap 4/6 boundary shortcuts · Expand for an overthrow addition · Add an optional commentary note (never blocks submission).

**Validation.** Run value within the primary 0–6 range (higher values composed via the overthrow add-on); submission blocked only while an unrelated guardrail modal is open; free-hit state is shown as a read-only badge here (dismissal restriction is enforced in UX-12, not here).

**States.** Ready → just-recorded (brief confirmation + optional haptic on Android) → Undo-available · Guardrail-blocked (rare) · Offline (always available).

**Error handling.** No confirmation dialog on normal runs (speed is the requirement); Undo is always one tap away for the mis-tap case; only rare, higher-consequence entries (a large overthrow) get a lightweight confirm step.

**Empty states.** Not applicable.

**Offline behavior.** Fully offline; input is acknowledged within the performance budget (`NFR-002`) and only **after** the event is durably committed locally (`NFR-010`) — the confirmation itself must never appear ahead of the durable write completing.

**Accessibility.** Large touch targets meeting the glove-usable minimum (`NFR-021`); the recorded value is announced immediately via a live region; haptic feedback is user-togglable; run values remain legible under high-contrast/sunlight mode.

---

#### UX-12 — Wicket Entry

**Trace:** `FR-049/050`, `BR-030/031/032/033`, `DR-17/18/19`

**Purpose.** Record a dismissal with full detail: mode, batter, fielder(s), and correct bowler-credit attribution.

**Inputs.** Dismissal mode (bowled, caught, LBW, run out, stumped, hit wicket, obstructing the field, hit the ball twice, timed out, retired out, non-striker run out); out-batter (defaults to striker, editable for a run out); fielder(s) (mode-dependent); end/who-crossed indicator (run out); incoming batter.

**Actions.** Select a mode · Complete the mode-specific detail form · Confirm the dismissal · Select the incoming batter (chained step) · Cancel back to Ball Entry.

**Validation.** Mode-specific required fields (e.g. caught requires a fielder; run out requires an end); on an active free hit, only run out / obstructing / hit the ball twice are offered, others are not merely disabled but not shown (`BR-033`); a stumping off a no-ball is not offered (`BR-032`); the incoming batter must be a not-yet-out member of the batting XI; confirming the dismissal that ends the innings routes straight to the next-innings/match-end flow.

**States.** Mode-select → detail-entry (dynamic per mode) → confirm-pending → batter-replacement → innings-just-ended (redirects to UX-09 or UX-22).

**Error handling.** Incomplete mode-specific fields block Confirm with inline errors on the missing ones; a mode invalid for the current context is simply not offered, with a one-line reason available on request, rather than offered and then rejected.

**Empty states.** Not applicable.

**Offline behavior.** Fully offline.

**Accessibility.** Each change in the dynamic form is announced; every dismissal-mode control has a full descriptive label, not an icon alone; fielder/batter pickers use combobox/listbox semantics; focus flows through the mode → detail → new-batter sequence in the same order a sighted user reads it.

---

#### UX-13 — Extras

**Trace:** `FR-044/046/047`, `BR-034/035/036`, `DR-11/12/13/14/15/16`

**Purpose.** Record wide, no-ball, bye, leg-bye, or penalty runs — each with its own counting rule.

**Inputs.** Extra type (Wide / No-ball / Bye / Leg-bye / Penalty), additional runs on top of the base, penalty reason and recipient side.

**Actions.** Select the extra type · Adjust the additional-runs value · Confirm.

**Validation.** Wide/no-ball never count as a legal ball (system-derived, not user-set); byes/leg-byes do count as legal balls; a penalty requires a non-empty reason (`BR-036`) and by default does not consume a delivery (config-dependent, `DR-16`); a type disabled by the current playing-conditions profile is shown but not selectable, with the reason available.

**States.** Type-select → detail-entry → confirmed → (no-ball) free-hit-now-active badge shown back on UX-10.

**Error handling.** An attempted extra type disallowed by the profile is greyed with an explanation on tap, not a post-submit rejection.

**Empty states.** Not applicable.

**Offline behavior.** Fully offline.

**Accessibility.** Extra-type controls are grouped with a clear legend; the additional-runs stepper announces its current value on each change; Confirm is visually and semantically distinct from Cancel/Back.

---

#### UX-14 — Strike Change

**Trace:** `DR-10`, `MBR-09`, `STRK-*`

**Purpose.** Display the current striker/non-striker (normally system-derived) and provide the rare, explicit manual-override control — e.g. correcting a running mix-up.

**Inputs.** Current striker/non-striker (display), swap toggle, a mandatory reason field for a manual override outside normal auto-rotation.

**Actions.** Tap "Swap ends" (normal end-of-over/odd-run rotation is automatic and needs no action here) · Confirm an override with a reason.

**Validation.** A manual override requires a non-empty reason, recorded as its own audited event; the system's automatic derivation always resumes on the next delivery unless overridden again.

**States.** Auto (system-derived — the default, no action needed) · Pending-override (reason field open) · Overridden (a visible badge marks this delivery as manually set) · Read-only during the brief over-transition animation.

**Error handling.** An override with no not-out batters available to swap to is not reachable; leaving the reason blank on override blocks confirmation with an inline required-field message.

**Empty states.** Not applicable.

**Offline behavior.** Fully offline; the override is recorded as a local event like any other.

**Accessibility.** The current striker is marked with icon **and** text ("On strike"), never color alone; the swap control's accessible name states its effect; the reason field's required state is announced.

---

#### UX-15 — Bowler Change

**Trace:** `FR-054/055/056/057`, `BR-027/028`

**Purpose.** Select the next bowler at the start of every over, enforcing the consecutive-over and over-limit guardrails.

**Inputs.** Bowler picker (fielding XI, excluding the bowler who just finished), each candidate's current figures shown alongside their name.

**Actions.** Select a bowler · Confirm · Override a guardrail with a reason (where the actor is authorised).

**Validation.** The immediately preceding bowler cannot be reselected unless overridden (`BR-027`); the configured maximum overs per bowler cannot be exceeded unless overridden (`BR-028`); a delivery cannot be recorded until a bowler is confirmed (`FR-054`, a blocking gate).

**States.** Prompt-open (appears automatically at over completion, blocking) · Valid-selection · Guardrail-blocked (selection disabled with an override affordance) · Confirmed (returns to UX-10).

**Error handling.** A guardrail violation states the specific rule ("Same bowler can't bowl consecutive overs") with an override path restricted to an authorised role and a required reason.

**Empty states.** Not applicable; the exceptional case where every remaining bowler is already over their cap is surfaced explicitly and requires an override to proceed rather than silently blocking play.

**Offline behavior.** Fully offline.

**Accessibility.** Each bowler's accessible label includes their current figures (e.g. "J. Smith, 3.2 overs, 0 maidens, 18 runs, 1 wicket"); disabled/guardrailed options are exposed via the disabled-state attribute plus a stated reason, not color alone.

---

#### UX-16 — Over Completion

**Trace:** `FR-063`, `CORR-008`

**Purpose.** A brief end-of-over checkpoint summarising the over just bowled, before the next-bowler prompt.

**Inputs.** None entered; displays the over number, runs conceded, wickets, maiden flag, and the outgoing bowler's updated figures.

**Actions.** Acknowledge/continue (single tap, or configurable auto-advance after a short interval) · Expand for over detail · Jump to Score Correction if an error is spotted here.

**Validation.** Not applicable.

**States.** Shown automatically at every over boundary → dismissed (proceeds to UX-15).

**Error handling.** Display-only; any correction need routes to UX-17.

**Empty states.** Not applicable.

**Offline behavior.** Fully offline — a pure local-projection view.

**Accessibility.** The summary is announced as one coherent message rather than several separate updates; the dismiss control is immediately reachable; a Settings toggle (UX-27) lets an experienced scorer skip this interstitial while keeping it available to those who rely on it.

---

#### UX-17 — Score Correction

**Trace:** `FR-097/098/099/100/101/102/103/108`, `BR-004/006`, `AUD-005/010`

**Purpose.** Navigate to and amend any prior delivery, with automatic cascade recomputation and a full audit trail.

**Inputs.** An over/ball navigator (jump-to field, searchable timeline); the same field set as the original entry (Ball/Wicket/Extras), pre-filled; a mandatory reason.

**Actions.** Search/navigate to a delivery · Open its editor · Change field(s) · Review the cascade (what will change downstream) before committing · Save (creates a superseding event) · Cancel.

**Validation.** A reason is required for every correction (`AUD-005`); the edited values pass the same field-level validation as original entry; a correction that would violate an invariant is blocked or routed to an explicit override; corrections to a Final match additionally require an elevated role and trigger re-sign-off (`BR-006`).

**States.** Browsing/searching → editing (pre-filled form) → reviewing-cascade → saved (confirmation + cascade summary) · Post-Final correction (elevated-permission gate).

**Error handling.** Attempting a correction without the scorer role is blocked with an explanation; a correction that breaks reconciliation is flagged immediately with the specific failing check, not discovered later at sign-off; a post-Final attempt without an elevated role states exactly what's required.

**Empty states.** If the match has no deliveries yet (not normally reachable), states there's nothing to correct.

**Offline behavior.** Fully offline; corrections are recorded as local superseding events and sync later (`OFF-017`).

**Accessibility.** The navigator supports direct keyboard entry ("go to over.ball") alongside scrolling; the cascade summary is presented as structured, readable text, not a visual-only diff; the reason field is reachable by keyboard before Save enables.

---

#### UX-18 — Undo

**Trace:** `FR-059/061/062`

**Purpose.** Instantly reverse the single most recent recorded action. Not a general editor — see UX-17 for that.

**Inputs.** None; acts on the most recent local event.

**Actions.** Undo (single, always-visible control during active scoring) · Redo (restores an undone action if nothing new has been entered since).

**Validation.** Undo is available only when a most-recent action exists to reverse; Redo is available only immediately after an Undo, before any new entry.

**States.** Available · Unavailable (start of innings, or the Redo window has closed) · Just-undone (brief confirmation, Redo becomes available) · Disabled during a blocking guardrail modal.

**Error handling.** Undo *is* the error-recovery mechanism; on the rare event Undo cannot fully reverse a complex multi-part action, it opens that delivery in Score Correction instead, with an explanation, rather than failing silently.

**Empty states.** Nothing to undo: the control shows disabled with an accessible explanation, kept in its usual position rather than hidden, so its location stays predictable during fast entry.

**Offline behavior.** Fully offline, instant, with no network dependency whatsoever.

**Accessibility.** Persistent, unambiguous accessible names ("Undo: revert last ball"); a documented, remappable keyboard shortcut on Web; what was undone is confirmed via a live-region announcement so screen-reader users aren't left uncertain.

---

#### UX-19 — Match Pause/Resume

**Trace:** `FR-064/078`, `DR-06/29`

**Purpose.** Record a stoppage (drinks, rain, bad light, injury, other) with start/end time and reason — distinct from the app simply being backgrounded.

**Inputs.** Pause reason (preset list + free text), start time (auto-captured, editable), end time on resume (auto-captured), an optional link into overs-reduction/manual-target entry if the stoppage affects the game.

**Actions.** Pause (from UX-10) · Select a reason · Confirm pause (disables scoring inputs) · Resume · Confirm resume (re-enables scoring) · Proceed to overs/target adjustment if applicable.

**Validation.** A reason is required to pause; Resume requires an active pause; any resulting overs reduction or manual target uses that sub-flow's own validation (positive integer, ≤ remaining overs).

**States.** Active (default, not paused) · Paused (scoring surface shows a clear banner, entry disabled) · Resuming (confirming return) · Post-pause adjustment (overs/target update).

**Error handling.** An accidental pause has an immediate, no-penalty Resume; if the app is killed while paused, relaunch restores the paused state exactly from durable local storage.

**Empty states.** Not applicable.

**Offline behavior.** Fully offline — interruption recording has no network dependency.

**Accessibility.** The paused state is unmistakable to screen-reader/low-vision users (an explicit "Match paused: Rain" announcement, not just a dimmed screen); every scoring control correctly exposes its disabled state while paused; Resume is the first focusable element when paused.

---

### 4.E Outputs

#### UX-20 — Scorecard

**Trace:** `FR-112/113/114/115/116`, `OFR-009/010`

**Purpose.** The full official output: batting card, bowling card, extras, fall of wickets, partnerships, and result.

**Inputs.** None entered; tab/filter controls for innings and batting/bowling view.

**Actions.** Switch innings tab · Expand a player row for detail · Export (PDF/CSV) · Share a read-only link · Print **(Web)**.

**Validation.** Not applicable (display); a reconciliation-status badge (Reconciled / Pending / Override-noted) is always shown.

**States.** Loading · Populated-provisional (live, watermarked "Provisional" before sign-off) · Final ("Official" badge, post-sign-off) · Reconciliation-FAIL (a visible warning banner linking to detail) · Offline-cached (viewing a synced-earlier snapshot while offline).

**Error handling.** An export failure (e.g. device storage full) shows a clear message with retry; a share-link request made while offline is queued with that state shown, not silently dropped.

**Empty states.** Before scoring starts: "Scoring hasn't started" placeholder rather than an empty table shell.

**Offline behavior.** Fully renderable, exportable and printable offline from the local projection (`OFR-009/010`); only remote link-sharing needs connectivity, and that step alone is queued.

**Accessibility.** Real table semantics (row/column headers) so a screen reader can navigate cell by cell; provisional-vs-final status is conveyed by a text label, not color alone; the print stylesheet preserves legibility **(Web)**.

---

#### UX-21 — Ball-by-Ball

**Trace:** `FR-113`, `OFR-009`

**Purpose.** The linear, chronological delivery-by-delivery log.

**Inputs.** Filters (over range, bowler, batter, phase), a search/jump-to-over.ball field.

**Actions.** Scroll/paginate · Apply/clear filters · Tap a delivery to view or edit it (→ UX-17) · Jump to a specific over.

**Validation.** Not applicable (display + navigation).

**States.** Loading · Populated · Filtered (active-filter chips shown) · Filtered-empty (no deliveries match) · Live-updating (auto-scrolls to the newest ball unless the user has scrolled up, in which case a "new ball ↓" affordance appears instead of yanking scroll position).

**Error handling.** Not applicable beyond the standard load-failure → cached fallback.

**Empty states.** Before first ball, or a filter matching nothing: an explicit message plus a "clear filters" action.

**Offline behavior.** Fully offline (local projection).

**Accessibility.** Each row's accessible name summarises the whole delivery in one phrase ("Over 12.4: Smith to Jones, four runs, boundary"); long/virtualized lists remain keyboard-navigable; live updates are batched into polite announcements, not one per ball.

---

#### UX-22 — Match Summary

**Trace:** `FR-104/105/106/108`, `BR-005/007`, `AUD-006/008`

**Purpose.** The post-match landing view: result headline, reconciliation report, and the sign-off action.

**Inputs.** None until sign-off; then the reconciliation report and, for a reopened Final match, elevated-permission and reason fields.

**Actions.** View result detail · View the reconciliation report · Sign Off (Head Scorer) · Counter-sign *(V2, Assistant/Umpire)* · Share · Export · Return to Dashboard.

**Validation.** Sign Off is disabled until reconciliation passes, or is explicitly overridden with a reason by an authorised role (`BR-007`); Sign Off requires the Head Scorer role (`BR-003/005`).

**States.** Awaiting-signoff (reconciliation shown, action available) · Signed-Final (immutable "Official" badge) · Post-Final-reopened (elevated correction in progress).

**Error handling.** A reconciliation FAIL blocks Sign Off with an itemised list of failing checks, each linking directly into Score Correction; an override path requires a reason and is logged prominently on this same screen once used.

**Empty states.** Not reachable until a result exists.

**Offline behavior.** Sign Off is fully available offline (`OFF-002/018`); publish/notify are deferred and queued until reconnection, with that queued state visible here.

**Accessibility.** The result headline is the primary heading, announced first; the reconciliation checklist uses list semantics with pass/fail conveyed by icon and text; Sign Off is visually and semantically distinct from the secondary Share/Export actions to prevent a mis-tap on such a consequential control.

### 4.F Connectivity

#### UX-23 — Offline Mode

**Trace:** `OFF-021/022`, `NFR-014`

**Purpose.** The persistent connectivity surface — not a destination so much as an ambient indicator with an expandable detail panel: what's cached, what's queued, and current storage usage.

**Inputs.** None typed; displays connectivity state, last-synced time, queued-item count, local storage usage.

**Actions.** Tap the indicator to expand detail · Manually retry a connection check · Jump to Sync Status (→ UX-24) · Manage local storage (→ UX-27's storage section).

**Validation.** Not applicable.

**States.** Online-synced · Online-syncing · Offline-with-queue · Offline-caught-up (nothing pending) · Backend-degraded (server reachable but erroring — distinguished from true offline).

**Error handling.** True offline and backend-degraded use distinct copy, because the right user action differs ("You're offline — carry on, we'll sync later" vs. "We're having trouble reaching the server — your data is safe and queued").

**Empty states.** Nothing queued: a calm "All caught up" state, not an empty list needing explanation.

**Offline behavior.** This screen's entire purpose is representing offline state, so it is itself always available with zero dependency on connectivity.

**Accessibility.** Never color-only (icon + text, e.g. a crossed-out cloud plus "Offline"); state changes are announced via a polite live region without repeating on every micro-change; the expandable panel follows a standard disclosure pattern (expanded/collapsed state exposed).

---

#### UX-24 — Sync Status

**Trace:** `SYNC-001/005/006`, `AUD-013`

**Purpose.** The detailed sync view: what's synced, what's pending, sync history, a manual trigger, and per-event error detail.

**Inputs.** None typed; displays a per-match sync-state list, global queue depth, and last full-sync timestamp.

**Actions.** Trigger a manual sync · View per-match detail (pending vs. confirmed events) · Retry a failed batch · View error detail for a rejected event.

**Validation.** Not applicable (display + trigger actions only).

**States.** Idle-synced · Syncing (progress + event count) · Partial-failure (rejected events itemised) · Fully-offline (queue frozen, explained) · Backend-degraded (distinguished from offline, §2.4).

**Error handling.** Every rejected event shows the specific reason in plain language (e.g. "This correction couldn't be applied — please review it") with a direct link to resolve it, never a raw error code.

**Empty states.** A brand-new or fully-offline/guest user with nothing ever synced: explains the account/cloud-sync feature and offers sign-in.

**Offline behavior.** The whole screen is most meaningful precisely while offline, and renders fully from local state with zero network calls required to display the queue.

**Accessibility.** Progress has a text equivalent (percentage/count), not a spinner alone; each error-list entry's accessible name states the ball reference and the problem plainly and is fully keyboard-navigable.

---

#### UX-25 — Conflict Resolution

**Trace:** `FR-107/108/109/110/111`, `BR-008`, `MINV-14`, `SYNC-011/012/013/014`

**Purpose.** Surface and resolve **dual-scorer divergences** *(V2)* and **device-fence conflicts** *(P1, one scorer/multiple devices)*.

**Inputs.** For divergences: a per-over.ball list with both scorers' recorded values side by side. For a fence conflict: an "another device is scoring this match" notice with device and time information.

**Actions.** Propose an agreed version for a divergent ball · Confirm/accept the other scorer's proposal · Reject and re-propose · View full context of the disputed ball · **(fence)** "Take over scoring on this device" or cancel and keep the original device active.

**Validation.** A divergence resolves only once **both** scorers have confirmed the same agreed version (`BR-008`, `MINV-14`); Sign Off is blocked while any divergence is Open/Proposed, overridable only with a reason plus dual attestation from an authorised role; taking over a fence requires explicit acknowledgement that the other device will be locked out.

**States.** No-conflicts (calm/empty — the common case) · Open-divergence (awaiting a proposal) · Proposed-awaiting-confirmation · Resolved · Fence-conflict-detected · Fence-taken-over.

**Error handling.** Attempting Sign Off with open divergences is blocked with the exact list and a link to resolve each; a proposal made offline syncs and waits for the other scorer's confirmation on their next connection — this pending state is shown clearly, never silently lost.

**Empty states.** No divergences yet: "No conflicts — logs match," a reassurance rather than a blank, confusing screen.

**Offline behavior.** *Detecting* a divergence requires both logs to have been exchanged at some point (needs connectivity); *reviewing* already-detected divergences and *proposing* a resolution work fully offline, queued for the other scorer's confirmation.

**Accessibility.** The side-by-side comparison reads as one coherent phrase per field for a screen reader ("Yours: four runs. Theirs: wide plus one."), not two disconnected cells; accept/reject controls have accessible names naming exactly what will be accepted.

### 4.G Records & Config

#### UX-26 — Match History

**Trace:** `FR-130`, `OFR-007`

**Purpose.** Search and browse past matches — own and organization's — across all states (in-progress, final, abandoned).

**Inputs.** Search (team / competition / venue / date / player), filter chips (date range, format, state), sort order.

**Actions.** Search · Apply/clear filters · Open a match (→ UX-20 if final, → UX-10 if in-progress) · Paginate/infinite-scroll.

**Validation.** Not applicable (read/search only).

**States.** Loading · Populated · Filtered-empty (no matches for current filters) · Unfiltered-empty (genuinely no history) · Offline (search limited to locally cached matches, clearly labelled).

**Error handling.** A search/filter failure falls back to the last-known local list with a banner noting results may be incomplete.

**Empty states.** Brand-new user/org with zero history: explains this is where completed matches will appear, with a Create Match call to action.

**Offline behavior.** Local matches are always searchable; cloud-synced history is searchable from cache with a "results may be incomplete offline" note (`OFR-007`).

**Accessibility.** The search input has a clear label and announces a live result count; filter chips expose a pressed/unpressed state; list virtualization preserves keyboard navigation across long histories.

---

#### UX-27 — Settings

**Trace:** `FR-152/153/154/157/158`, `OFR-016`

**Purpose.** Personal and app preferences: language, date/time format, accessibility modes, input preferences, notifications, storage, and account management.

**Inputs.** Language selector, timezone/date-format, high-contrast/large-text/sunlight toggle, input-confirmation preferences, haptics toggle, per-channel notification toggles, storage usage + purge control, account details (email, password), sign-out.

**Actions.** Change a setting (applied immediately where possible) · Manage storage · Export personal data · Delete account · Sign out.

**Validation.** Destructive actions (delete account, purge storage) require an explicit confirm step; a password change requires the current password.

**States.** Default · Editing (a setting mid-change) · Applied (confirmation toast) · Destructive-confirm (modal) · Offline (cloud-only settings shown disabled with an explanation; local settings remain fully editable).

**Error handling.** A setting that needs connectivity to persist (e.g. a server-side notification preference) queues while offline with a visible "will sync" note rather than silently failing.

**Empty states.** Not applicable — settings always render populated with current or default values.

**Offline behavior.** Local/device preferences (theme, input mode, language) apply and persist immediately with no network dependency; account-level settings that require the server are clearly marked and queued.

**Accessibility.** This screen is itself part of the accessibility surface: every toggle has a clear label and current-state announcement, grouped under section headings, with high-contrast/sunlight mode previewed live as it's toggled so the effect is immediately perceivable.

---

#### UX-28 — Administration

**Trace:** `FR-007/039`, `BR-044`, `SEC-005/011`, `ADM-*`

**Purpose.** Organization-admin console (member/role management, player registry, competitions, branding, disputes) and platform-admin console (tenants, feature flags, impersonation, reference-data publishing).

**Inputs.** Member list + role editor, invite form, player-registry search/merge tool, competition/template config, branding assets, dispute list; *(platform)* tenant list, feature-flag toggles, impersonation-consent flow, reference-data version-publish form.

**Actions.** Invite a member · Change or revoke a role · Deactivate a member · Search/merge duplicate players · Create/edit a competition or template · Upload branding · Lock/adjudicate a dispute · *(platform)* toggle a feature flag · start impersonation (with consent capture) · publish reference data.

**Validation.** Role changes require org-admin permission, enforced at the data layer (`SEC-005`); a player merge requires org/platform-admin and is explained as irreversible before confirming (`BR-044`); impersonation requires explicit stored consent before it can proceed (`SEC-011`); reference-data publishing requires platform-admin and always creates a new version, never overwrites in place.

**States.** Default list views · Editing (a form open) · Destructive-confirm (merge / deactivate / revoke) · Platform-only sections hidden entirely for org-admins — not merely disabled — since visibility itself is role-driven · Impersonation-active (a persistent, unmissable banner for the duration).

**Error handling.** An action without sufficient role is, where possible, not shown at all (least-privilege UI) rather than shown-then-refused, except where explaining the absence is itself useful ("Ask a platform admin to change this"); a merge conflict (both players have overlapping recent matches) is surfaced with detail before confirming, not after.

**Empty states.** No pending invites or disputes: a reassuring per-section empty state rather than a jarring blank admin panel.

**Offline behavior.** Read-heavy views (member list, dispute list) work from cache; role/permission changes, invites, merges, and reference-data publishing are network-required actions and are clearly **disabled offline with an explanatory tooltip**, rather than accepted and silently failing after submission — this is the one screen group where "offline behaviour" is mostly graceful disabling, and that is stated to the user explicitly.

**Accessibility.** An active impersonation session is perceivable by screen-reader users at all times (an announcement on entry plus a persistent labelled region, not a visual banner alone); destructive confirms use a real, focus-trapped modal, with a typed-confirmation pattern (e.g. typing the player's name) for the highest-risk actions such as a merge.

---

## 5. Cross-screen workflows

Six end-to-end walkthroughs stitching the screens together — the brief asks for workflows, not just screens in isolation.

### W-1 — First-time volunteer scorer, first match (guest, fully offline)

```
UX-01 Login ──"Continue as guest"──▶ UX-03 Dashboard (empty state, guided hint)
   ▶ UX-04 Create Match ▶ UX-05 Match Setup ▶ UX-06 Team Selection ▶ UX-07 Playing XI
   ▶ UX-08 Toss ▶ UX-09 Innings Setup ▶ UX-10 Live Scoring
      (loop: UX-11 Ball Entry / UX-12 Wicket / UX-13 Extras / UX-15 Bowler Change /
       UX-16 Over Completion, with UX-18 Undo always available)
   ▶ (2nd innings: back to UX-09) ▶ UX-22 Match Summary ▶ Sign Off ▶ UX-20 Scorecard
```
No network call occurs anywhere in this path (`NFR-012`, `OFF-002`). Success criterion: ≥ 95% guided-first-match task completion with no unrecoverable error (`NFR-040`).

### W-2 — Registered scorer, full-season workflow with sync

```
UX-01 Login (cached session, offline grace) ▶ UX-03 Dashboard ▶ UX-04…UX-09 (as W-1)
   ▶ UX-10 loop, scored fully offline in the field
   ▶ device regains connectivity ▶ UX-23 indicator flips to "Syncing…" ▶ UX-24 Sync Status
   ▶ UX-22 Match Summary ▶ Sign Off (works offline or online) ▶ background sync completes
   ▶ UX-20 Scorecard shows "Official" ▶ (if org competition) standings recompute server-side
```

### W-3 — Reduced-overs / rain interruption

```
UX-10 Live Scoring ▶ UX-19 Match Pause (reason: Rain) ▶ [play stops]
   ▶ UX-19 Resume ▶ overs-reduction / manual-target sub-flow (within UX-19/UX-05 context)
   ▶ UX-10 Live Scoring (target/par now reflects the revision, shown in the live-state panel)
```

### W-4 — Spotting and fixing a mistake mid-innings

```
UX-10 Live Scoring ▶ (scorer notices an error three overs back)
   ▶ UX-21 Ball-by-Ball ▶ locate the delivery ▶ UX-17 Score Correction
   ▶ edit field(s) + reason ▶ review cascade ▶ Save
   ▶ UX-10 Live Scoring (current figures reflect the cascade; UX-20/21 update identically)
```
If the same match is already Final: the same path additionally requires the elevated-role + re-sign-off gate (`BR-006`) before Save is available.

### W-5 — Dual-scorer reconciliation *(V2)*

```
Scorer A: UX-09…UX-10 loop on device A         Scorer B: UX-09…UX-10 loop on device B
   (each scores independently, offline-capable throughout)
                     │                                        │
                     └──────────── both reconnect ─────────────┘
                                       ▼
                     logs exchange ▶ UX-25 Conflict Resolution
                     (divergence list populated if any field differs)
                                       ▼
        A proposes a resolution ▶ B confirms (or rejects → re-propose)
                                       ▼
              all divergences Resolved ▶ UX-22 Match Summary ▶ Sign Off enabled
```

### W-6 — Organization onboarding and role assignment

```
UX-28 Administration (org-admin) ▶ invite a member (email + role)
   ▶ invitee: UX-02 Registration (invite token pre-filled) ▶ role auto-applied
   ▶ UX-03 Dashboard now shows the org's matches per the assigned role
```

### W-7 — Multi-device handoff (P1, single scorer)

```
Device 1: UX-10 Live Scoring, holds the writer fence, battery dies mid-over
Device 2: UX-01 Login (same account) ▶ UX-03 Dashboard ▶ resume the in-progress match
   ▶ UX-10 requests the writer fence ▶ granted ▶ scoring continues on Device 2
Device 1 (later, regains power): attempts to write ▶ stale-fence rejection
   ▶ UX-10 on Device 1 switches to read-only with a "Take over scoring here?" prompt (UX-25)
```

---

## 6. Traceability

Screen → primary SRS requirement clusters. Full per-screen trace is in each screen's **Trace** line (§4); this is the reverse index by requirement area.

| SRS area | Screens |
|---|---|
| Accounts, Identity & Tenancy (`FR-001…014`) | UX-01, UX-02, UX-27, UX-28 |
| Match Setup (`FR-015…029`) | UX-04, UX-05 |
| Squads, Lineups & Roles (`FR-030…041`) | UX-06, UX-07 |
| Live Ball-by-Ball Scoring (`FR-042…070`) | UX-09, UX-10, UX-11, UX-12, UX-13, UX-14, UX-15, UX-16 |
| Innings & Match State (`FR-071…082`) | UX-08, UX-09, UX-19, UX-22 |
| Rain, DLS & Reduced Overs (`FR-083…091`) | UX-19, UX-10 (live par display) |
| Tie-breakers / Super Over (`FR-092…096`) | UX-09 (reopened), UX-10 |
| Corrections, Audit & Sign-off (`FR-097…106`) | UX-17, UX-18, UX-22 |
| Dual-Scorer Reconciliation (`FR-107…111`) | UX-25 |
| Scorecards, Analytics & Commentary (`FR-112…122`) | UX-20, UX-21 |
| Sharing, Notifications & Viewer (`FR-137…142`) | UX-20 (share), UX-23 |
| Settings & Localization (`FR-151…158`) | UX-27 |
| Administration (`FR-159…162`) | UX-28 |
| Offline (`OFF-001…022`) | every screen — see each screen's **Offline behavior** field |
| Synchronization (`SYNC-001…016`) | UX-23, UX-24, UX-25 |
| Audit (`AUD-001…015`) | UX-17, UX-22, UX-24, UX-28 |
| Security & Authorization (`SEC-001…018`) | UX-01, UX-28, and the guardrail pattern (§2.5) applied throughout Group D |
| Accessibility & i18n (`NFR-019…024/037…045`) | every screen — see §2.7 baseline + each screen's **Accessibility requirements** field |

---

## 7. Open items and assumptions carried

| # | Item | Note |
|---|---|---|
| UXQ-1 | High-fidelity visual design (color, type, spacing tokens) is not in this document's scope | Follows in a design pass against `ADR-T02`'s Radix + Tailwind foundation |
| UXQ-2 | Exact copy/microcopy shown here is illustrative | Final UX writing is a separate pass |
| UXQ-3 | Counter-signature (UX-22) and dual-scorer (UX-25) are V2 per the roadmap | Specified now so the P1 substrate (fence tokens, event log) doesn't need rework, per `system-architecture.md ADR-07` |
| UXQ-4 | Wagon-wheel/pitch-map capture screens are not in this catalogue | Deferred to V2/Future per the roadmap; would extend UX-11/UX-20 if built |
| UXQ-5 | Exact keyboard-shortcut bindings (Web) and haptic patterns (Android) | Left to implementation; the requirement (documented, remappable) is fixed here |
| UXQ-6 | Onboarding/guided-tour content for first-time scorers (referenced in UX-03) | Needs its own short spec once usability testing (`NFR-040/041`) begins |
| UXQ-7 | `SPK-01` (DLS licensing) affects whether UX-10's live-par display and UX-19's target-revision sub-flow are DLS-driven or manual-only at launch | Both paths are already described; the manual path is the default per `A-06/A-19` |

---

## 8. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-21 | Initial UX specification. §1 scope, platform notes (Web vs Android), the 28-screen catalogue grouped A–G. §2 cross-cutting conventions (state model, error/empty/offline/guardrail patterns, undo-vs-correction distinction, accessibility baseline, sync-label vocabulary) so they aren't restated 28 times. §3 information-architecture/navigation map. §4 all 28 screens (UX-01…UX-28), each with Purpose, Inputs, Actions, Validation, States, Error handling, Empty states, Offline behavior, Accessibility requirements, and a one-line Trace to the SRS. §5 seven cross-screen workflows (first match offline, full-season sync, rain interruption, mid-innings correction, dual-scorer reconciliation, org onboarding, multi-device handoff). §6 traceability index. §7 open items. No UI code, markup, or visual design — interaction and information-architecture specification only. |

