# Cricket Scoring Book — Product Discovery

| | |
|---|---|
| **Document** | Product Discovery |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-02 |
| **Upstream** | `docs/foundation/product-foundation.md` |
| **Downstream** | `docs/specs/*` (feature specs), `docs/architecture/*` |

Complete discovery organised into the **4Ds**. No implementation design: the *Develop* and *Deliver* sections below are discovery-level planning (prioritisation, traceability, release/verification strategy), not technical design.

### ID scheme

| Prefix | Artefact | Prefix | Artefact |
|---|---|---|---|
| `PER-` | Persona | `OFR-` | Offline requirement |
| `JTBD-` | Job-to-be-done | `WEB-` | Web requirement |
| `JRN-` | User journey | `AND-` | Android requirement |
| `EP-` / `US-` | Epic / User story | `ADM-` | Administrator requirement |
| `FR-` | Functional requirement | `SCR-` | Scorer requirement |
| `NFR-` | Non-functional requirement | `CTR-` | Captain/Team requirement |
| `BR-` | Business rule | `VWR-` | Viewer requirement |
| `CSR-` | Cricket scoring requirement | `OBJ-` | Foundation core objective (trace) |
| `ONR-` | Online requirement | | |

**Priority (MoSCoW):** M=Must · S=Should · C=Could · W=Won't-yet
**Phase:** P1 (pilot/MVP) · P2 (post-pilot) · P3 (later)
**Trace targets (`OBJ-`):** 01 Law-accurate engine · 02 Offline-first · 03 Deterministic sync/dual-scorer · 04 Match mathematics · 05 Complete outputs · 06 Cross-platform parity · 07 Verifiability/trust · 08 Speed of entry · 09 Data ownership/portability · 10 Multi-tenant · 11 Accessibility/i18n

---
---

# 1. DESCRIBE

*Who we serve, what they are trying to get done, and the end-to-end paths they take.*

## 1.1 Personas

### PER-01 — "Val", Club Volunteer Scorer *(Primary)*
- **Context:** retired club member; scores Saturday league T20/40-over from a wooden scorebox with no wifi and patchy 3G. Android phone; occasionally a club Chromebook.
- **Goals:** keep an accurate book without falling behind; produce the official result and card; not be blamed for errors.
- **Frustrations:** messy paper reconciliation; apps that need signal; tiny buttons; losing work when the phone rings.
- **Environment:** Android 11 mid-range; offline ~90% of the match; one-handed, standing.
- **Success:** full match scored solo, reconciles first time, card emailed to both clubs the same evening.
- **JTBD:** 01, 02, 07, 08, 09

### PER-02 — "Priya", Accredited / Professional Scorer *(Primary)*
- **Context:** association-accredited; representative and 2nd-XI matches, sometimes paired, sometimes multi-day. Laptop + phone.
- **Goals:** precision to association standard; dual-scorer reconciliation; clean export to the league feed; defensible audit trail.
- **Frustrations:** desktop-only pro tools; manual DLS; no pairing workflow; re-keying into league systems.
- **Environment:** Windows laptop (web), Android backup; intermittent ground wifi.
- **Success:** paired match reconciled ball-by-ball; DLS handled in-app; export accepted with zero rework.
- **JTBD:** 02, 03, 04, 05, 06, 10, 12

### PER-03 — "Tom", Assistant / Co-Scorer *(Primary)*
- **Context:** second scorer for integrity; scores in parallel with the head scorer.
- **Goals:** stay in sync; catch discrepancies within an over; contribute corrections without overwriting.
- **Frustrations:** no tooling today — done by shouting across the box or comparing at tea.
- **Environment:** own Android phone, offline.
- **Success:** divergences flagged within an over, resolved by mutual confirmation, both sign off.
- **JTBD:** 03, 08, 10

### PER-04 — "Grace", Competition / League Organizer *(Secondary)*
- **Context:** runs a 12-club season; sets playing conditions; publishes fixtures, tables, discipline records.
- **Goals:** consistent rules across matches; automatic standings/NRR; low admin; dispute trail.
- **Frustrations:** chasing scorers for results; recomputing NRR by hand; inconsistent interpretations.
- **Environment:** laptop (web), online.
- **Success:** standings update automatically on sign-off; disputes have an audit trail.
- **JTBD:** 11, 13, 15

### PER-05 — "Dan", Team Manager / Captain *(Secondary)*
- **Context:** manages a club XI; submits team sheets; checks results and form.
- **Goals:** submit XI before the deadline; verify the result; see who's in form.
- **Frustrations:** paper team sheets; disputed results with no record; scattered stats.
- **Environment:** Android phone, mostly online.
- **Success:** XI submitted in 2 minutes; result confirmed/disputed in one tap; stats in one place.
- **JTBD:** 14, 16, 17

### PER-06 — "Aisha", Team Analyst / Coach *(Secondary)*
- **Context:** analyses opposition and own players across a season.
- **Goals:** match-ups, phase analysis, wagon wheels; export to her own tools.
- **Frustrations:** data trapped in other apps; no clean export; manual chart building.
- **Environment:** laptop (web), online.
- **Success:** pulls a season of ball-by-ball data in an open format in minutes.
- **JTBD:** 12, 18

### PER-07 — "Sam", Player *(Secondary)*
- **Context:** club all-rounder who wants a verified personal record.
- **Goals:** claim appearances; see career aggregates and milestones.
- **Frustrations:** stats differ between apps; appearances missing.
- **Environment:** Android phone, online.
- **Success:** career record matches the scorebook; milestones flagged.
- **JTBD:** 16, 19

### PER-08 — "Ravi", Umpire *(Tertiary)*
- **Context:** stands in league matches; cross-checks overs, totals, DLS par at intervals.
- **Goals:** confirm the state matches his count; flag discrepancies; confirm result and sanctions.
- **Frustrations:** no shared view of the scorers' state.
- **Environment:** Android phone, offline; glances between overs.
- **Success:** quick read of over/score/DLS par; confirms result at close.
- **JTBD:** 20

### PER-09 — "Chloe", Commentator / Media *(Secondary)*
- **Context:** club-stream commentary and match reports.
- **Goals:** live card on screen; attach ball commentary; grab stats and a card for the report.
- **Frustrations:** laggy or missing live data; no commentary field.
- **Environment:** laptop (web), online.
- **Success:** near-real-time card; commentary attached to balls; card exported for the report.
- **JTBD:** 11, 21

### PER-10 — "Meera", Organization (Club/League) Admin *(Secondary)*
- **Context:** sets up the club on the platform; invites members; maintains the player registry.
- **Goals:** clean roster with no duplicates; right people in right roles; branding on cards.
- **Frustrations:** duplicate player records; unclear permissions.
- **Environment:** laptop (web), online.
- **Success:** club onboarded in an evening; registry deduped; roles assigned.
- **JTBD:** 13, 15, 22

### PER-11 — "Alex", Platform Administrator *(Internal)*
- **Context:** operates the platform; manages tenants, releases, global reference data (DLS tables, condition templates), support.
- **Goals:** safe rollouts; healthy system; auditable, consented support access; current reference data.
- **Frustrations:** unsupported edits; no audit on support actions.
- **Environment:** laptop (web), online.
- **Success:** tenants isolated; releases staged; every support action logged and consented.
- **JTBD:** 23

### PER-12 — "Jo", Fan / Parent Spectator *(Tertiary)*
- **Context:** follows a child's or club's match from home or the boundary.
- **Goals:** see the live score; get a nudge on wickets and the result.
- **Frustrations:** needing an app or login just to watch; stale scores.
- **Environment:** any phone browser, online; sometimes at the ground offline.
- **Success:** opens a link, sees a live card, optionally follows for alerts.
- **JTBD:** 24

### PER-13 — "Nils", Statistician / Data Consumer / Developer *(Tertiary)*
- **Context:** builds his own cricket stats site; wants machine-readable data.
- **Goals:** standards-aligned export/API; stable identifiers; round-trip fidelity.
- **Frustrations:** proprietary formats; unstable IDs.
- **Environment:** laptop, online, programmatic.
- **Success:** pulls Cricsheet-compatible data via API with consistent IDs.
- **JTBD:** 18, 25

---

## 1.2 Jobs-to-be-Done

**Scoring**
- **JTBD-01** When play is happening in front of me with no signal, I want to record every ball instantly and locally, so I can keep an accurate book without falling behind or losing data.
- **JTBD-02** When an unusual delivery occurs (no-ball free hit, overthrows, double dismissal), I want the tool to know the Laws, so I can record it correctly without memorising every edge case.
- **JTBD-07** When my phone rings or the app closes mid-over, I want to reopen exactly where I was, so I can carry on without reconstructing the over.
- **JTBD-08** When I realise a ball three overs ago was wrong, I want to correct it and have every derived number update, so I can trust the card without erasing history.
- **JTBD-09** When the innings ends, I want a reconciled scorecard, bowling analysis and fall of wickets, so I can hand over an official result the same day.

**Integrity**
- **JTBD-03** When two of us are scoring the same match, I want our books compared continuously, so I can resolve a disagreement within an over instead of at tea.
- **JTBD-10** When the match is signed off, I want a tamper-evident record of who entered and changed what, so I can defend the result if it's disputed.
- **JTBD-20** When there's a break in play, I want a quick read of overs, score and DLS par, so I can confirm it matches my count.

**Match management**
- **JTBD-04** When rain interrupts a limited-overs match, I want revised targets and par scores calculated for me, so I can tell players and umpires the correct situation immediately.
- **JTBD-05** When scores are level at the end, I want the tie-breaker workflow ready, so I can score a Super Over correctly under pressure.
- **JTBD-06** When the match is over, I want to publish, export and share in one step, so I can notify everyone and file it with the league.
- **JTBD-15** When a new season starts, I want to set playing conditions once and reuse them, so every match is scored consistently.

**Competition**
- **JTBD-11** When matches are being played across my league, I want live and final results to flow in automatically, so I can keep standings current without chasing scorers.
- **JTBD-13** When results are signed off, I want NRR, points and bonus points computed to the competition rules, so the table is correct and defensible.

**Team**
- **JTBD-14** When it's match day, I want to submit my playing XI and roles before the deadline, so scorers and opposition have the right names.
- **JTBD-16** When a result is posted, I want to confirm or dispute it quickly, so mistakes are caught while memories are fresh.
- **JTBD-17** When selecting a side, I want current form and head-to-head for my squad, so I can pick on evidence.
- **JTBD-19** When I've played a match, I want my appearance and performance added to my verified career record, so my stats are complete and trusted.
- **JTBD-22** When I onboard my club, I want one clean list of players with no duplicates, so stats aren't split across records.

**Consumption**
- **JTBD-21** When I'm commentating, I want a near-real-time card and a place to attach ball commentary, so my broadcast and report are accurate.
- **JTBD-24** When someone I care about is playing, I want to open a link and see the live score, so I can follow without installing anything.
- **JTBD-12** When I review a match, I want charts and ball-by-ball detail plus an export, so I can analyse in-app or in my own tools.

**Data / Platform**
- **JTBD-18** When I need match data at scale, I want a standards-aligned export/API with stable identifiers, so I can consume it reliably.
- **JTBD-25** When I integrate, I want round-trip fidelity between export and import, so nothing is lost moving data in and out.
- **JTBD-23** When I operate the platform, I want staged releases, tenant isolation and audited support access, so I can run it safely.

---

## 1.3 User Journeys

| ID | Journey | Primary actor(s) | Mode |
|---|---|---|---|
| JRN-01 | Pre-match setup | Scorer | Offline |
| JRN-02 | Live scoring an innings (solo) | Scorer | Offline |
| JRN-03 | Dual-scorer reconciliation | Head + Assistant scorer | Offline / intermittent |
| JRN-04 | Rain interruption + DLS revised target | Scorer, Umpire | Offline |
| JRN-05 | Innings break → 2nd innings → result / Super Over | Scorer | Offline |
| JRN-06 | Post-match sign-off, publish, export, share | Head scorer | Offline sign-off → online publish |
| JRN-07 | Sync on reconnect after fully offline match | Scorer's device | Online |
| JRN-08 | Correcting a scoring error (mid-match & post-final) | Scorer / Admin | Offline / online |
| JRN-09 | Competition setup, fixtures, standings | Organizer | Online |
| JRN-10 | Captain submits playing XI | Captain | Draft offline → submit online |
| JRN-11 | Viewer follows a live match via shared link | Fan | Online |
| JRN-12 | Analyst reviews match & exports data | Analyst | Online (offline for local matches) |
| JRN-13 | Player claims appearance & views career stats | Player, Admin | Online |
| JRN-14 | Multi-day match: day close & resume *(P3)* | Scorer | Offline for days |
| JRN-15 | Club onboarding & member invites | Org admin | Online |
| JRN-16 | Guest local scoring → later account claim | Casual scorer | Offline → online claim |

**JRN-01 Pre-match setup** — 30 min before start: open app offline → create match from competition template (or blank) → confirm two teams, load cached squads → enter playing XI per side, mark captain + keeper, add ad-hoc players if missing → record toss winner and decision → confirm playing conditions (overs, powerplays, bowler limits, tie-breaker) → set officials, venue, start time, ball → validation passes → state = **Ready**. *Nothing synced yet.*

**JRN-02 Live scoring (solo, offline)** — set opening batters + bowler → per delivery: one tap for runs / extra / wicket, secondary detail only when needed → app auto-rotates strike, counts legal balls, ends over, blocks same bowler twice running → on wicket: mode, out batter, new batter, credit rules, FoW → end-of-over checkpoint confirms figures → drinks/interruptions persist on every event → innings auto-ends on overs / all-out / target → confirm close. *Every event written durably before the UI confirms; kill & resume safe at any point.*

**JRN-03 Dual-scorer reconciliation** — both open the same match on separate devices, score independently → devices exchange event logs when briefly connected (or at intervals) → system aligns both ball logs by over/ball and flags any delivery where runs, extras, wicket or striker differ → scorers work a divergence list; one proposes the agreed version → the other confirms → an agreed correction event is appended to both logs (history kept) → discrepancy count must reach zero (or be overridden with a reason) → both sign off → **Reconciled & signed**.

**JRN-04 Rain + DLS** — mark "Interruption – rain" with time → on resumption enter overs lost / new total per umpires → app recomputes revised target, current par, over-by-over par → scorer reads revised target to umpires/captains; par shown live thereafter → further interruptions repeat, each revision versioned with inputs + timestamp → if abandoned, result from par at last valid ball (or "no result" if minimum overs unmet). *DLS runs offline; manual override always available.*

**JRN-05 Break → 2nd innings → result / Super Over** — confirm 1st-innings close, target = total + 1 (or DLS revised) → interval timer → set 2nd-innings batters + bowler → score with live RRR, runs required, balls left, projection → target reached → "won by N wickets"; overs complete short → "won by M runs"; level → tie handling → if competition uses Super Over: nominate 3 batters + 1 bowler per side, 2-wicket max, 1 over each; score both; apply repeat Super Over or configured fallback → record result type + margin, plus any over-rate/penalty adjustments.

**JRN-06 Sign-off & publish** — review full card, linear sheet, bowling analysis, FoW, extras; reconciliation check runs → resolve/override flagged discrepancies with reason → head scorer signs off; assistant/umpire counter-sign where required → state = **Final** → on connectivity: sync to backend, standings recompute → export PDF/CSV/Cricsheet-JSON, share final link → result notifications sent.

**JRN-07 Sync on reconnect** — device regains connectivity hours later → background sync uploads the ordered event log with progress + unsynced count → backend validates, stores, assigns canonical IDs, links to competition → server-side conflicts (e.g. assistant already uploaded) surface for reconciliation → local events marked synced → shareable link active.

**JRN-08 Correcting an error** — find the delivery in the ball log (search by over/ball) → "Correct this delivery"; edit runs/extras/wicket/striker/bowler → app creates a superseding event; original retained and visible → all derived figures recompute (scores, RR, partnerships, bowling figures, FoW, DLS par) → if already signed off: elevated permission + reason + re-sign-off.

**JRN-09 Competition setup** — create season/competition, choose format + condition template → add divisions/teams, generate or import fixtures → configure points model (win/tie/bonus) + NRR rules → assign scorers to fixtures, publish schedule → as matches sign off, results ingest and standings/NRR/bonus recompute → disputes: lock match, review audit, record adjudication.

**JRN-10 Captain submits XI** — open fixture, see XI deadline → pick 11 from squad, set captain + keeper, nominate subs pool (concussion/impact where allowed) → submit; scorers + opposition notified; locked at deadline, late changes flagged. *Draft offline, submit when online.*

**JRN-11 Viewer follows live** — opens shared link in a browser (no account, no install) → live card: score/wickets/overs, batters, bowler, RR/RRR, target, DLS par, last 6 balls → expands full card, partnerships, extras, charts, commentary → optional "Follow" for wicket/innings/result alerts → sees "updated X ago" when the source device is offline.

**JRN-12 Analyst review & export** — open a signed-off match → review charts and ball-by-ball → filter by phase/bowler/batter/partnership → export match or season as Cricsheet-compatible JSON / CSV → join with prior data via stable player/team IDs.

**JRN-13 Player claims appearance** — player sees "you may have played this match" (name match) or enters a claim code from the scorer → org admin or captain approves the link → career aggregates + milestones update from verified matches only.

**JRN-14 Multi-day day close & resume *(P3)*** — at close of play record overs bowled, not-out batters, new-ball status, session/day notes; day locked → next day resume: carry striker/non-striker, bowler ends, over count, new-ball due → handle follow-on, declarations, session boundaries, bad light/weather. *Offline for days without data loss.*

**JRN-15 Club onboarding** — create organization, set branding (name, logo, colours, home ground) → import or add players (dedupe/merge), add teams → invite members, assign roles → create/join competitions.

**JRN-16 Guest → account claim** — "Score without an account" → create a local match, no login → score the full match offline → later create/sign in, choose to upload the local match → optionally attach to a club/competition (needs permission) or keep personal.

---
---

# 2. DECOMPOSE

*Breaking the problem into named, uniquely identified requirements.*

## 2.1 Epics & User Stories

Story format: *As a [persona], I want [capability], so that [benefit].* Acceptance criteria are noted in brief; full Given/When/Then criteria are produced in the spec backlog (§3.3).

### EP-01 — Identity, Accounts & Tenancy
- **US-001** As a casual scorer, I want to score without an account, so that I can start immediately. *(local match, no PII, offline)*
- **US-002** As a new user, I want to create an account with email, so that I can sync and share.
- **US-003** As a returning user, I want to sign in offline using a cached session, so that I can score without connectivity.
- **US-004** As an org admin, I want to invite people by email with a role, so that they get the right access.
- **US-005** As an org admin, I want to deactivate a member, so that they lose access without deleting their history.
- **US-006** As a user, I want to belong to multiple organizations, so that I can score for more than one club.
- **US-007** As a user, I want to export or delete my account data, so that I control my information.

### EP-02 — Match Setup & Configuration
- **US-010** As a scorer, I want to create a match from a competition template, so that playing conditions are pre-set.
- **US-011** As a scorer, I want to create an ad-hoc match with custom conditions, so that I can score friendlies.
- **US-012** As a scorer, I want to set overs, powerplays, bowler limits and the tie-breaker rule, so that scoring matches the competition.
- **US-013** As a scorer, I want to record the toss winner and decision, so that innings order is correct.
- **US-014** As a scorer, I want to set venue, date, start time and ball details, so that the record is complete.
- **US-015** As a scorer, I want scoring blocked until setup is valid, so that I don't start with a bad configuration.
- **US-016** As a scorer, I want to save a setup as a reusable template, so that future matches are faster.

### EP-03 — Squads, Lineups & Roles
- **US-020** As a captain, I want to maintain my squad list, so that lineups are quick to pick.
- **US-021** As a captain, I want to submit a playing XI with captain and keeper marked, so that scorers have the right names and roles.
- **US-022** As a scorer, I want to add a missing player ad-hoc during setup, so that I'm not blocked at the ground.
- **US-023** As an admin, I want to merge duplicate player records, so that stats aren't split.
- **US-024** As a captain, I want to nominate a substitute pool (incl. concussion/impact where allowed), so that in-match substitutions are valid.
- **US-025** As a scorer, I want XI validation (count, keeper, captain), so that lineups are legal before the first ball.

### EP-04 — Live Ball-by-Ball Scoring
- **US-030** As a scorer, I want to record a normal delivery in one or two taps, so that I keep pace with play.
- **US-031** As a scorer, I want to record all extras (wide, no-ball, bye, leg-bye, penalty), so that the total reconciles.
- **US-032** As a scorer, I want no-ball free-hit handling applied automatically, so that next-ball dismissal rules are correct.
- **US-033** As a scorer, I want to record all dismissal modes with the right credit rules, so that batting and bowling figures are correct.
- **US-034** As a scorer, I want automatic strike rotation and over completion, so that I don't track it manually.
- **US-035** As a scorer, I want warnings on illegal bowler changes and over-limit breaches, so that I don't record an invalid over.
- **US-036** As a scorer, I want to record overthrows and boundary-plus-run combinations, so that unusual scoring is captured.
- **US-037** As a scorer, I want to undo my last action instantly, so that slips are cheap to fix.
- **US-038** As a scorer, I want an end-of-over checkpoint, so that I can confirm figures before moving on.
- **US-039** As a scorer, I want to attach optional commentary/notes to a ball, so that context is preserved.
- **US-040** As a scorer, I want the current state always visible (striker, bowler, over, score, wickets, RR/RRR, target, DLS par), so that I never lose situational awareness.

### EP-05 — Innings & Match State
- **US-045** As a scorer, I want the innings to end automatically on overs/all-out/target, so that I don't over-run.
- **US-046** As a scorer, I want to declare an innings, so that first-class matches are supported. *(P3)*
- **US-047** As a scorer, I want to record interruptions with time, so that DLS and over-rate are accurate.
- **US-048** As a scorer, I want to reduce the overs for an innings, so that shortened matches score correctly.
- **US-049** As a scorer, I want to record abandoned/no-result/forfeit outcomes, so that all endings are supported.
- **US-050** As a scorer, I want the target recalculated when the first innings is DLS-adjusted, so that the chase is correct.

### EP-06 — Rain, DLS & Reduced Overs
- **US-055** As a scorer, I want to enter overs lost and get a revised target, so that I can inform players immediately.
- **US-056** As a scorer, I want a live par/DLS score, so that the match situation is always clear.
- **US-057** As a scorer, I want each DLS revision versioned with its inputs, so that the calculation is auditable.
- **US-058** As a scorer, I want to override DLS output with a manual target, so that I can follow an umpire's ruling.
- **US-059** As an umpire, I want to see current DLS par at a break, so that I can confirm the situation.

### EP-07 — Tie-breakers / Super Over
- **US-060** As a scorer, I want a Super Over workflow (3 batters, 1 bowler, 2 wickets, 1 over), so that ties are resolved correctly.
- **US-061** As a scorer, I want repeat Super Overs supported, so that current playing conditions are honoured.
- **US-062** As a scorer, I want a configurable legacy fallback (boundary count-back), so that older competition rules still work.

### EP-08 — Corrections, Audit & Sign-off
- **US-065** As a scorer, I want to correct any prior delivery, so that mistakes don't corrupt the card.
- **US-066** As a scorer, I want corrections to preserve original history, so that the record is tamper-evident.
- **US-067** As a scorer, I want a reconciliation check before sign-off, so that totals are guaranteed to balance.
- **US-068** As a head scorer, I want to sign off the match, so that the result becomes final.
- **US-069** As an assistant scorer/umpire, I want to counter-sign, so that the result has independent attestation.
- **US-070** As an admin, I want post-final corrections to require permission and a reason, so that finalised records are protected.
- **US-071** As anyone with access, I want to view the full audit trail, so that I can see who did what and when.

### EP-09 — Dual-Scorer Reconciliation
- **US-075** As paired scorers, we want to score the same match independently, so that integrity is preserved.
- **US-076** As paired scorers, we want automatic divergence detection by over/ball, so that disagreements surface fast.
- **US-077** As a scorer, I want to propose an agreed version of a disputed ball, so that we converge deterministically.
- **US-078** As a scorer, I want the other scorer to confirm before a reconciliation applies, so that nothing is unilaterally overwritten.
- **US-079** As paired scorers, we want sign-off blocked while discrepancies remain, so that we resolve everything first.

### EP-10 — Scorecards, Analytics & Commentary
- **US-085** As a scorer, I want a full scorecard, linear sheet, bowling analysis and FoW, so that I can produce the official record.
- **US-086** As a viewer, I want a live scorecard, so that I can follow the match.
- **US-087** As an analyst, I want Manhattan, worm, run-rate and partnership charts, so that I can analyse quickly.
- **US-088** As an analyst, I want wagon wheel / pitch maps via manual entry, so that shot and line-length analysis is possible. *(P2/P3)*
- **US-089** As a commentator, I want a ball-by-ball commentary feed, so that my broadcast and report are accurate.
- **US-090** As a viewer, I want milestone highlights (50s, 100s, 5-fors, hat-tricks), so that key moments stand out.

### EP-11 — Competitions, Fixtures & Standings
- **US-095** As an organizer, I want to create a competition with a condition template, so that all matches are consistent.
- **US-096** As an organizer, I want to generate or import fixtures, so that the schedule is set up quickly.
- **US-097** As an organizer, I want standings, NRR and bonus points computed on sign-off, so that the table is always current.
- **US-098** As an organizer, I want to lock a match and record an adjudication, so that disputes have a clear outcome.
- **US-099** As a viewer, I want to see fixtures, results and standings, so that I can follow the competition.

### EP-12 — Profiles, Stats & History
- **US-105** As a player, I want to claim my appearances, so that my career record is complete.
- **US-106** As a player, I want verified career aggregates and milestones, so that my stats are trustworthy.
- **US-107** As a captain, I want squad form and head-to-head, so that I can select on evidence.
- **US-108** As any user, I want to search and browse past matches, so that I can find a record quickly.
- **US-109** As a team, I want our full match history and exports, so that we own our data.

### EP-13 — Sharing, Notifications & Viewer Access
- **US-115** As a scorer, I want to share a live/final match link, so that others can follow without an account.
- **US-116** As a viewer, I want to follow a match for wicket/innings/result alerts, so that I don't have to watch constantly.
- **US-117** As a team/captain, I want a notification when a result is posted, so that I can review it promptly.
- **US-118** As a viewer, I want the card to show "updated X ago" when the source is offline, so that I'm not misled.

### EP-14 — Data Portability & Integration
- **US-125** As an analyst/developer, I want Cricsheet-compatible export, so that data drops into existing tools.
- **US-126** As a developer, I want a read API with stable IDs, so that I can integrate reliably. *(P2)*
- **US-127** As a scorer, I want offline export to PDF/CSV, so that I can share before syncing.
- **US-128** As a user, I want import of an existing match/competition, so that I can migrate from another tool. *(P2)*
- **US-129** As a user, I want export→import round-trip fidelity, so that nothing is lost.

### EP-15 — Administration & Platform Ops
- **US-135** As an org admin, I want role-based access control, so that people only do what they should.
- **US-136** As an org admin, I want club branding on scorecards, so that outputs look official.
- **US-137** As a platform admin, I want tenant isolation, so that clubs can't see each other's data.
- **US-138** As a platform admin, I want staged releases and feature flags, so that I can roll out safely.
- **US-139** As a platform admin, I want to update DLS tables and condition templates centrally, so that reference data stays correct.
- **US-140** As a platform admin, I want audited, consented support impersonation, so that I can help users without hidden access.

---

## 2.2 Functional Requirements

Format: `FR-nnn — requirement. [Priority · Phase · Trace]`

### A. Accounts, Identity & Tenancy
- **FR-001** — Allow fully anonymous, device-local match scoring with no sign-up. [M · P1 · OBJ-02]
- **FR-002** — Support email-based account creation and sign-in. [M · P1 · OBJ-10]
- **FR-003** — Cache an authenticated session for offline use for a configurable period. [M · P1 · OBJ-02]
- **FR-004** — Allow a signed-in user to upload/claim a previously local (guest) match. [M · P1 · OBJ-09]
- **FR-005** — Support organizations (tenants) that own teams, competitions and matches. [M · P1 · OBJ-10]
- **FR-006** — Allow a user to be a member of multiple organizations with distinct roles. [M · P1 · OBJ-10]
- **FR-007** — Provide role assignment/revocation within an organization. [M · P1 · OBJ-10]
- **FR-008** — Support email invitations with a pre-assigned role and expiry. [S · P1 · OBJ-10]
- **FR-009** — Allow deactivation of a member without deleting their authored history. [M · P1 · OBJ-07]
- **FR-010** — Provide user-initiated export of all personal data. [M · P1 · OBJ-09]
- **FR-011** — Provide user-initiated account deletion with defined handling of authored match records. [M · P1 · OBJ-09]
- **FR-012** — Support password reset and session revocation. [M · P1 · OBJ-10]
- **FR-013** — Record the identity of the actor for every write action. [M · P1 · OBJ-07]
- **FR-014** — Allow guardian-consented accounts / restricted profiles for minors. [S · P2 · OBJ-11]
- **FR-015** — Support organization-level API keys for data access. [C · P2 · OBJ-09]

### B. Match Setup & Configuration
- **FR-016** — Create a match from a competition/playing-condition template. [M · P1 · OBJ-01]
- **FR-017** — Create an ad-hoc match with fully custom conditions. [M · P1 · OBJ-01]
- **FR-018** — Configure format (T20, ODI/List A, T10, The Hundred, custom overs). [M · P1 · OBJ-01]
- **FR-019** — Configure multi-day/first-class format (2 innings/side, sessions). [S · P3 · OBJ-01]
- **FR-020** — Configure overs per innings, powerplay blocks, and fielding-restriction rules. [M · P1 · OBJ-01]
- **FR-021** — Configure per-bowler over limits. [M · P1 · OBJ-01]
- **FR-022** — Configure the tie-breaker rule (Super Over / repeat Super Over / boundary count-back / none). [M · P1 · OBJ-01]
- **FR-023** — Configure ball type/brand and new-ball rules. [S · P2 · OBJ-05]
- **FR-024** — Record toss winner and elected decision; derive innings order. [M · P1 · OBJ-01]
- **FR-025** — Record venue, date, scheduled start, and time zone. [M · P1 · OBJ-05]
- **FR-026** — Record match officials (umpires, scorers, referee). [S · P1 · OBJ-07]
- **FR-027** — Validate setup completeness before enabling scoring. [M · P1 · OBJ-01]
- **FR-028** — Save a match setup as a reusable named template. [S · P1 · OBJ-08]
- **FR-029** — Configure minimum overs for a valid result (per format/competition). [M · P1 · OBJ-04]
- **FR-030** — Configure points/bonus-points model and NRR rules at competition level. [S · P2 · OBJ-04]

### C. Squads, Lineups & Roles
- **FR-031** — Maintain a team squad list with player names and basic details. [M · P1 · OBJ-10]
- **FR-032** — Select a playing XI (or configured size) per side. [M · P1 · OBJ-01]
- **FR-033** — Mark captain and wicket-keeper per side. [M · P1 · OBJ-01]
- **FR-034** — Add an ad-hoc player during setup when not in the squad. [M · P1 · OBJ-08]
- **FR-035** — Validate XI: correct count, exactly one keeper, one captain. [M · P1 · OBJ-01]
- **FR-036** — Nominate a substitute pool (substitute fielders). [S · P1 · OBJ-01]
- **FR-037** — Nominate a concussion-substitute pool. [S · P2 · OBJ-01]
- **FR-038** — Nominate an impact/replacement-player pool where competition config enables it. [C · P3 · OBJ-01]
- **FR-039** — Maintain an organization-level canonical player registry. [S · P2 · OBJ-10]
- **FR-040** — Merge duplicate player records, re-pointing historical appearances. [S · P2 · OBJ-09]
- **FR-041** — Submit a playing XI against a fixture with a deadline. [S · P2 · OBJ-10]
- **FR-042** — Lock lineup at deadline; flag and log post-deadline changes. [S · P2 · OBJ-07]

### D. Live Ball-by-Ball Scoring
- **FR-043** — Set opening striker, non-striker and bowler for an innings. [M · P1 · OBJ-01]
- **FR-044** — Record runs off the bat (0–6+) for a delivery. [M · P1 · OBJ-01]
- **FR-045** — Record a wide with associated additional runs. [M · P1 · OBJ-01]
- **FR-046** — Record a no-ball with runs off bat / byes and trigger free-hit state where configured. [M · P1 · OBJ-01]
- **FR-047** — Record byes and leg-byes with runs. [M · P1 · OBJ-01]
- **FR-048** — Record penalty runs (5) to batting or fielding side with a reason. [S · P1 · OBJ-01]
- **FR-049** — Record boundary 4 and 6, including all-run and overthrow boundaries. [M · P1 · OBJ-01]
- **FR-050** — Record overthrows adding runs to a delivery. [M · P1 · OBJ-01]
- **FR-051** — Record every dismissal mode (bowled, caught, LBW, run out, stumped, hit wicket, obstructing the field, hit ball twice, timed out, retired out). [M · P1 · OBJ-01]
- **FR-052** — Capture dismissal detail: out batter, end/who crossed, fielder(s), bowler credit. [M · P1 · OBJ-01]
- **FR-053** — Record retired–not out (hurt/ill) and later resumption. [M · P1 · OBJ-01]
- **FR-054** — Apply automatic strike rotation on odd runs and end of over. [M · P1 · OBJ-01]
- **FR-055** — Count legal deliveries and complete an over at 6 legal balls. [M · P1 · OBJ-01]
- **FR-056** — Prompt for a new bowler at the start of each over. [M · P1 · OBJ-01]
- **FR-057** — Warn/block a bowler bowling consecutive overs. [M · P1 · OBJ-01]
- **FR-058** — Warn/block a bowler exceeding the configured over limit. [M · P1 · OBJ-01]
- **FR-059** — Allow an explicit override of any guardrail with a recorded reason. [M · P1 · OBJ-07]
- **FR-060** — Record a substitute fielder taking the field and any resulting dismissal attribution. [S · P1 · OBJ-01]
- **FR-061** — Undo the last recorded action instantly. [M · P1 · OBJ-08]
- **FR-062** — Redo an undone action. [S · P1 · OBJ-08]
- **FR-063** — Provide an end-of-over checkpoint summarising the over and current figures. [S · P1 · OBJ-07]
- **FR-064** — Attach free-text commentary/notes to any delivery. [S · P1 · OBJ-05]
- **FR-065** — Display persistent live state: striker, non-striker, bowler, over.ball, score/wickets, extras, RR, RRR, runs required, balls remaining, target, DLS par. [M · P1 · OBJ-08]
- **FR-066** — Record drinks breaks and other stoppages with timestamps. [S · P1 · OBJ-04]
- **FR-067** — Record wicket-keeper change and its effect on dismissal options. [C · P2 · OBJ-01]
- **FR-068** — Record a new ball being taken. [S · P2 · OBJ-05]
- **FR-069** — Support "5 penalty runs — ball not counted" vs "penalty + delivery" distinctions. [S · P2 · OBJ-01]
- **FR-070** — Record a dead-ball with reason (no runs, no ball counted). [S · P2 · OBJ-01]
- **FR-071** — Record mankad / run-out at the non-striker's end before delivery. [S · P2 · OBJ-01]
- **FR-072** — Record last-man-stands / one-short calls where competition config allows. [C · P3 · OBJ-01]

### E. Innings & Match State
- **FR-073** — Automatically end an innings on overs complete. [M · P1 · OBJ-01]
- **FR-074** — Automatically end an innings when all out (configurable wickets). [M · P1 · OBJ-01]
- **FR-075** — Automatically end the chase when the target is reached or passed. [M · P1 · OBJ-01]
- **FR-076** — Support innings declaration (multi-day). [S · P3 · OBJ-01]
- **FR-077** — Support innings forfeiture. [C · P3 · OBJ-01]
- **FR-078** — Record match interruptions with start/end time and reason. [M · P1 · OBJ-04]
- **FR-079** — Reduce overs for one or both innings mid-match. [M · P1 · OBJ-01]
- **FR-080** — Compute the target as opposition total + 1, or DLS-revised. [M · P1 · OBJ-04]
- **FR-081** — Record result type: win by runs, win by wickets, tie, no result, abandoned, win (DLS), win (Super Over), awarded, conceded. [M · P1 · OBJ-04]
- **FR-082** — Record margin (runs / wickets / balls remaining) appropriate to the result type. [M · P1 · OBJ-04]
- **FR-083** — Record over-rate/time penalties affecting the result. [C · P2 · OBJ-04]
- **FR-084** — Support the follow-on decision and enforcement (multi-day). [S · P3 · OBJ-01]
- **FR-085** — Model a match state machine (Scheduled → Ready → In progress → Innings break → … → Final / Abandoned). [M · P1 · OBJ-01]

### F. Rain, DLS & Reduced Overs
- **FR-086** — Enter overs lost / revised overs and compute a DLS revised target. [M · P1 · OBJ-04] *(pending licensing — §3.5)*
- **FR-087** — Display a live DLS par score and over-by-over par. [M · P1 · OBJ-04]
- **FR-088** — Recompute par/target on each interruption. [M · P1 · OBJ-04]
- **FR-089** — Version every DLS revision with inputs, timestamp and actor. [M · P1 · OBJ-07]
- **FR-090** — Allow a manual target override with a recorded reason. [M · P1 · OBJ-04]
- **FR-091** — Determine an abandoned-match result from par at the last valid ball, subject to minimum-overs rules. [M · P1 · OBJ-04]
- **FR-092** — Function fully offline for all DLS calculations. [M · P1 · OBJ-02]
- **FR-093** — Support a pluggable rain-method interface (DLS Standard now; others later). [S · P2 · OBJ-01]
- **FR-094** — Show the DLS calculation breakdown for audit/explanation. [S · P2 · OBJ-07]

### G. Tie-breakers / Super Over
- **FR-095** — Provide a Super Over workflow: nominate 3 batters + 1 bowler per side, 2-wicket maximum, 1 over each. [M · P1 · OBJ-01]
- **FR-096** — Support repeated Super Overs until a result. [M · P1 · OBJ-01]
- **FR-097** — Support configurable legacy boundary count-back as a fallback. [S · P1 · OBJ-01]
- **FR-098** — Carry Super Over stats separately from main-match stats. [M · P1 · OBJ-05]
- **FR-099** — Apply the correct batting order rule (loser of the toss / previous Super Over chooses). [S · P2 · OBJ-01]

### H. Corrections, Audit & Sign-off
- **FR-100** — Navigate to any prior delivery via over/ball or timeline search. [M · P1 · OBJ-07]
- **FR-101** — Correct any field of any prior delivery. [M · P1 · OBJ-01]
- **FR-102** — Preserve the original event; corrections are superseding events, never destructive edits. [M · P1 · OBJ-07]
- **FR-103** — Recompute all derived figures after a correction. [M · P1 · OBJ-04]
- **FR-104** — Run a reconciliation check (runs = Σ batter + extras; balls ↔ overs; wickets ≤ max). [M · P1 · OBJ-07]
- **FR-105** — Block sign-off on an unresolved reconciliation failure unless overridden with a reason. [M · P1 · OBJ-07]
- **FR-106** — Head scorer sign-off transitions the match to Final. [M · P1 · OBJ-07]
- **FR-107** — Support counter-signature by assistant scorer and/or umpire. [S · P2 · OBJ-07]
- **FR-108** — Require elevated permission + reason + re-sign-off for post-Final corrections. [M · P1 · OBJ-07]
- **FR-109** — Maintain an append-only, tamper-evident audit trail of all events and corrections. [M · P1 · OBJ-07]
- **FR-110** — Present a human-readable audit view (who, what, when, before/after). [M · P1 · OBJ-07]
- **FR-111** — Record device and app version with each event. [S · P1 · OBJ-07]
- **FR-112** — Allow an organizer/admin to lock a match pending dispute resolution and record an adjudication. [S · P2 · OBJ-07]

### I. Dual-Scorer Reconciliation
- **FR-113** — Allow two or more scorers to be assigned to one match. [M · P2 · OBJ-03]
- **FR-114** — Let each scorer maintain an independent ball log for the same match. [M · P2 · OBJ-03]
- **FR-115** — Exchange event logs between scorer devices when connectivity allows. [M · P2 · OBJ-03]
- **FR-116** — Align logs by over/ball and flag any delivery where runs, extras, wicket or striker differ. [M · P2 · OBJ-03]
- **FR-117** — Present a divergence list with per-ball comparison. [M · P2 · OBJ-03]
- **FR-118** — Let one scorer propose an agreed version and require the other to confirm before it applies. [M · P2 · OBJ-03]
- **FR-119** — Never silently overwrite one scorer's entry with another's. [M · P2 · OBJ-03]
- **FR-120** — Block match sign-off while unresolved divergences remain (override with reason + dual attestation). [M · P2 · OBJ-07]

### J. Scorecards, Analytics & Commentary
- **FR-121** — Produce a full scorecard (batting card, bowling card, extras, total, result). [M · P1 · OBJ-05]
- **FR-122** — Produce a linear/ball-by-ball scoresheet. [M · P1 · OBJ-05]
- **FR-123** — Produce a bowling analysis (overs, maidens, runs, wickets, economy, spells). [M · P1 · OBJ-05]
- **FR-124** — Produce a fall-of-wickets list (score, wicket no., batter, over). [M · P1 · OBJ-05]
- **FR-125** — Produce an over-by-over summary. [M · P1 · OBJ-05]
- **FR-126** — Show partnerships (runs, balls, contribution) per wicket. [M · P1 · OBJ-05]
- **FR-127** — Compute batting metrics (SR, boundary %, dot %, minutes where tracked). [S · P1 · OBJ-05]
- **FR-128** — Compute bowling metrics (economy, SR, average, dot %). [S · P1 · OBJ-05]
- **FR-129** — Flag milestones (fifties, hundreds, 5-fors, 10-wkt match, hat-tricks). [S · P1 · OBJ-05]
- **FR-130** — Render Manhattan (runs per over) chart. [S · P1 · OBJ-05]
- **FR-131** — Render worm / cumulative-runs comparison chart. [S · P1 · OBJ-05]
- **FR-132** — Render run-rate vs required-run-rate chart. [S · P1 · OBJ-05]
- **FR-133** — Render partnership bar chart. [S · P1 · OBJ-05]
- **FR-134** — Capture wagon-wheel shot coordinates via manual entry and render. [C · P2 · OBJ-05]
- **FR-135** — Capture pitch-map / beehive line-length data via manual entry and render. [C · P3 · OBJ-05]
- **FR-136** — Maintain a ball-by-ball commentary feed. [S · P1 · OBJ-05]
- **FR-137** — Add match-level, session-level and day-level notes. [S · P1 · OBJ-05]
- **FR-138** — Render a live scorecard suitable for spectators. [M · P1 · OBJ-05]

### K. Competitions, Fixtures & Standings
- **FR-139** — Create a competition/season with a format and a playing-condition template. [S · P2 · OBJ-10]
- **FR-140** — Organise teams into divisions/groups. [S · P2 · OBJ-10]
- **FR-141** — Generate a round-robin/knockout fixture list. [S · P2 · OBJ-10]
- **FR-142** — Import a fixture list from a file. [C · P2 · OBJ-09]
- **FR-143** — Assign scorers to fixtures. [S · P2 · OBJ-10]
- **FR-144** — Ingest signed-off results into the competition automatically. [S · P2 · OBJ-10]
- **FR-145** — Compute standings from a configurable points model. [S · P2 · OBJ-04]
- **FR-146** — Compute Net Run Rate per competition rules. [S · P2 · OBJ-04]
- **FR-147** — Compute bonus points per competition rules. [C · P2 · OBJ-04]
- **FR-148** — Produce knockout brackets and progression. [C · P3 · OBJ-10]
- **FR-149** — Record disciplinary/penalty entries against a match or team. [C · P2 · OBJ-07]
- **FR-150** — Publish a public competition page (fixtures, results, standings). [S · P2 · OBJ-05]

### L. Profiles, Stats, History & Search
- **FR-151** — Maintain player profiles with a photo and basic bio. [S · P2 · OBJ-10]
- **FR-152** — Let a player claim/link appearances, subject to approval. [S · P2 · OBJ-07]
- **FR-153** — Compute career aggregates from verified matches only. [S · P2 · OBJ-05]
- **FR-154** — Compute team aggregates and records. [S · P2 · OBJ-05]
- **FR-155** — Provide head-to-head (player vs player, team vs team). [C · P2 · OBJ-05]
- **FR-156** — Provide recent-form summaries for a squad. [C · P2 · OBJ-05]
- **FR-157** — Search matches by team, competition, venue, date, player. [S · P1 · OBJ-05]
- **FR-158** — Browse a chronological match history per team/competition. [S · P1 · OBJ-05]
- **FR-159** — Filter a match's ball-by-ball data by phase, bowler, batter, partnership. [S · P2 · OBJ-05]
- **FR-160** — Provide record lists (highest totals, best figures, etc.) per scope. [C · P3 · OBJ-05]

### M. Sharing, Notifications & Viewer Access
- **FR-161** — Generate a shareable read-only link for a live or final match. [M · P1 · OBJ-05]
- **FR-162** — Allow viewing via link with no account and no install (web). [M · P1 · OBJ-05]
- **FR-163** — Update the viewer card in near real time while the source is online. [M · P1 · OBJ-05]
- **FR-164** — Show "last updated X ago" and an offline indicator when the source is disconnected. [M · P1 · OBJ-07]
- **FR-165** — Let a viewer follow a match for wicket/innings/result alerts. [S · P2 · OBJ-05]
- **FR-166** — Notify assigned teams/captains when a result is posted. [S · P2 · OBJ-05]
- **FR-167** — Notify scorers of assignment, XI submission and deadlines. [C · P2 · OBJ-10]
- **FR-168** — Support push notifications on Android and web push where available. [S · P2 · OBJ-05]
- **FR-169** — Provide an embeddable scorecard widget. [C · P3 · OBJ-05]
- **FR-170** — Share a specific moment (e.g. a wicket) as a deep link. [C · P3 · OBJ-05]

### N. Import, Export, API & Backup
- **FR-171** — Export a match as a Cricsheet-compatible JSON/YAML document. [S · P1 · OBJ-09]
- **FR-172** — Export a match scorecard as PDF. [M · P1 · OBJ-09]
- **FR-173** — Export match/innings data as CSV. [M · P1 · OBJ-09]
- **FR-174** — Perform all exports offline for locally held matches. [M · P1 · OBJ-02]
- **FR-175** — Import a match from a Cricsheet-compatible document. [C · P2 · OBJ-09]
- **FR-176** — Guarantee export→import round-trip fidelity for supported fields. [S · P2 · OBJ-09]
- **FR-177** — Provide a read-only REST API for matches, competitions and profiles. [C · P2 · OBJ-09]
- **FR-178** — Provide a real-time subscription channel for live match updates. [C · P2 · OBJ-05]
- **FR-179** — Expose stable, documented identifiers for players, teams, matches and competitions. [S · P2 · OBJ-09]
- **FR-180** — Create a local backup file of one or more matches. [S · P1 · OBJ-02]
- **FR-181** — Restore matches from a local backup file. [S · P1 · OBJ-02]
- **FR-182** — Apply organization branding (name, logo, colours) to exported outputs. [S · P2 · OBJ-05]

### O. Settings, Localization & Preferences
- **FR-183** — Choose interface language (English at launch; framework for more). [S · P1 · OBJ-11]
- **FR-184** — Choose date/time format and match time zone. [M · P1 · OBJ-11]
- **FR-185** — Toggle high-contrast / large-text / sunlight mode for scoring. [M · P1 · OBJ-11]
- **FR-186** — Configure scoring input preferences (button layout, confirmations, haptics). [S · P1 · OBJ-08]
- **FR-187** — Configure default competition/condition template for new matches. [S · P1 · OBJ-08]
- **FR-188** — Manage local storage: view usage, purge synced matches, set retention. [S · P1 · OBJ-02]
- **FR-189** — Configure notification preferences per channel and event type. [S · P2 · OBJ-05]
- **FR-190** — Keep the screen awake while actively scoring. [S · P1 · OBJ-08]

---

## 2.3 Non-Functional Requirements

### Performance & Efficiency
- **NFR-001** — A normal delivery is recorded in ≤ 2 discrete interactions. [M · P1 · OBJ-08]
- **NFR-002** — UI acknowledges a scoring input in ≤ 100 ms on target Android hardware. [M · P1 · OBJ-08]
- **NFR-003** — A single scorer can keep pace with live play for any supported format with no growing backlog. [M · P1 · OBJ-08]
- **NFR-004** — Full scorecard and standard charts render in ≤ 1 s for a completed T20. [S · P1 · OBJ-05]
- **NFR-005** — App cold start to "ready to score" in ≤ 3 s on target hardware. [S · P1 · OBJ-08]
- **NFR-006** — A full offline T20 (≈ 250+ events) syncs in ≤ 30 s on a 3G-class connection. [M · P1 · OBJ-03]
- **NFR-007** — Battery use allows a full day's play (≥ 8 h intermittent scoring) on a mid-range phone, screen dimmed. [S · P1 · OBJ-02]
- **NFR-008** — Local storage per match stays within a documented budget; app functions with years of local history. [S · P1 · OBJ-02]

### Reliability, Durability & Availability
- **NFR-009** — Zero ball-events lost across a defined chaos test (force-kill, battery pull, OS eviction, offline toggling) over ≥ 50 simulated innings. [M · P1 · OBJ-02]
- **NFR-010** — Every scoring event is persisted durably before the UI confirms it. [M · P1 · OBJ-02]
- **NFR-011** — On relaunch after a crash, the match resumes at the exact last confirmed state. [M · P1 · OBJ-02]
- **NFR-012** — No connectivity is required for any part of scoring a match from setup to sign-off. [M · P1 · OBJ-02]
- **NFR-013** — Online services achieve ≥ 99.5% monthly availability. [S · P1 · OBJ-10]
- **NFR-014** — Backend degradation never blocks offline scoring; clients queue and retry. [M · P1 · OBJ-02]
- **NFR-015** — Data retained locally without loss for the full duration of a multi-day match (≥ 5 days). [S · P3 · OBJ-02]

### Sync & Consistency
- **NFR-016** — Sync is deterministic: the same set of events yields the same merged result regardless of arrival order. [M · P2 · OBJ-03]
- **NFR-017** — Conflicts are always surfaced, never silently resolved by last-write-wins. [M · P2 · OBJ-03]
- **NFR-018** — Event ordering is preserved per device via a monotonic sequence and logical clock. [M · P1 · OBJ-03]
- **NFR-019** — Clock skew between devices is detected and flagged, not trusted blindly. [S · P2 · OBJ-03]

### Scalability
- **NFR-020** — Support a defined target of concurrent live matches and per-match viewers without degradation (target set during planning). [S · P2 · OBJ-10]
- **NFR-021** — Viewer fan-out degrades gracefully to periodic polling under load. [S · P2 · OBJ-05]
- **NFR-022** — Tenant data volume scales to multi-season history per organization. [S · P2 · OBJ-10]

### Security & Integrity
- **NFR-023** — All network traffic uses transport encryption. [M · P1 · OBJ-07]
- **NFR-024** — Access is enforced by role at the data layer (a client cannot read/write outside its permissions). [M · P1 · OBJ-07]
- **NFR-025** — The audit trail is append-only and tamper-evident. [M · P1 · OBJ-07]
- **NFR-026** — Only Head Scorer / Assistant Scorer roles can write deliveries to a match. [M · P1 · OBJ-07]
- **NFR-027** — Local data at rest on device is protected (OS-level encryption assumed; sensitive fields minimised). [S · P1 · OBJ-07]
- **NFR-028** — Support impersonation by platform admins requires explicit consent and is fully logged. [M · P1 · OBJ-07]
- **NFR-029** — Public share links are unguessable and revocable. [M · P1 · OBJ-07]
- **NFR-030** — Rate limiting and abuse protection on public and API endpoints. [S · P2 · OBJ-10]

### Privacy & Compliance
- **NFR-031** — Personal data collection is minimised; scoring works with names only. [M · P1 · OBJ-11]
- **NFR-032** — Data-protection compliance for target jurisdictions (GDPR-class), incl. export & erasure. [M · P1 · OBJ-09]
- **NFR-033** — Special handling for minors' data (consent, reduced profile visibility). [S · P2 · OBJ-11]
- **NFR-034** — DLS implementation is used under an appropriate licence/permission; method is swappable if terms change. [M · P1 · OBJ-01]
- **NFR-035** — Laws of Cricket are implemented as logic and cited, not reproduced verbatim without permission. [M · P1 · OBJ-01]
- **NFR-036** — Telemetry is privacy-respecting, disclosed, and opt-outable where required. [S · P1 · OBJ-11]

### Usability & Accessibility
- **NFR-037** — Core web scoring and scorecard flows meet WCAG 2.2 AA. [M · P1 · OBJ-11]
- **NFR-038** — Primary scoring actions are reachable one-handed on phones up to a defined size. [M · P1 · OBJ-08]
- **NFR-039** — Touch targets for scoring controls meet a defined minimum size, usable with thin gloves. [S · P1 · OBJ-08]
- **NFR-040** — A first-time volunteer scorer completes a guided practice match with ≥ 95% task completion and no unrecoverable error. [M · P1 · OBJ-08]
- **NFR-041** — System Usability Scale ≥ 80 with a panel of club scorers. [S · P1 · OBJ-08]
- **NFR-042** — High-contrast, sunlight-readable mode available for outdoor use. [M · P1 · OBJ-11]
- **NFR-043** — All destructive actions are confirmable and/or reversible. [M · P1 · OBJ-07]

### Compatibility & Portability
- **NFR-044** — Android app supports Android 10+ on mid-range hardware and phone screen sizes from small to large; basic tablet support. [M · P1 · OBJ-06]
- **NFR-045** — Web app supports current evergreen browsers on desktop, laptop, tablet and Chromebook. [M · P1 · OBJ-06]
- **NFR-046** — Web app is an installable PWA that works offline. [M · P1 · OBJ-02]
- **NFR-047** — Scoring-core behaviour is identical across Web and Android for identical inputs (contract-tested). [M · P1 · OBJ-06]
- **NFR-048** — Scoring-core feature-parity matrix ≥ 95% Web vs Android. [M · P1 · OBJ-06]
- **NFR-049** — Exported data is consumable without proprietary tooling. [M · P1 · OBJ-09]

### Interoperability
- **NFR-050** — Export conforms to the published Cricsheet-compatible schema and validates against it. [S · P1 · OBJ-09]
- **NFR-051** — Export→import round-trip preserves the match with zero material difference for supported fields. [S · P2 · OBJ-09]
- **NFR-052** — Identifiers exposed externally are stable across releases. [S · P2 · OBJ-09]

### Maintainability, Observability & Testability
- **NFR-053** — A versioned cricket-rules conformance suite exists and must pass 100% for release. [M · P1 · OBJ-01]
- **NFR-054** — The scoring engine is deterministic and replayable from its event log. [M · P1 · OBJ-01]
- **NFR-055** — Errors and sync failures are observable to operators without exposing personal data. [S · P1 · OBJ-10]
- **NFR-056** — Reference data (DLS tables, condition templates) is updatable centrally without a client release. [S · P2 · OBJ-01]

### Internationalisation
- **NFR-057** — All user-facing strings are externalised for translation. [S · P1 · OBJ-11]
- **NFR-058** — Date, time and number formatting is locale-aware. [S · P1 · OBJ-11]
- **NFR-059** — Match timestamps are stored unambiguously and displayed in the match time zone. [M · P1 · OBJ-11]

---

## 2.4 Business Rules

- **BR-001** — Every match is owned by exactly one organization, or by a single guest device until claimed. [Trace OBJ-10]
- **BR-002** — A match becomes editable only after setup validation passes. [OBJ-01]
- **BR-003** — Only users holding Head Scorer or Assistant Scorer on a match may record or correct deliveries. [OBJ-07]
- **BR-004** — Ball events are immutable; a correction is a new superseding event referencing the original. [OBJ-07]
- **BR-005** — A match result is provisional until a Head Scorer signs off; then it is Final. [OBJ-07]
- **BR-006** — Post-Final corrections require an elevated role, a recorded reason, and re-sign-off; the prior Final version is retained. [OBJ-07]
- **BR-007** — Sign-off is blocked while a reconciliation check fails, unless explicitly overridden with a reason by an authorised role. [OBJ-07]
- **BR-008** — In dual-scorer mode, a reconciliation change applies only after both scorers confirm the agreed version. [OBJ-03]
- **BR-009** — A playing XI must contain exactly the configured number of players, exactly one captain and exactly one wicket-keeper before the first ball. [OBJ-01]
- **BR-010** — A player may appear in only one side's XI for a given match. [OBJ-01]
- **BR-011** — A substitute fielder may not bowl, bat, or keep wicket (except a sanctioned concussion or impact substitute per competition config). [OBJ-01]
- **BR-012** — A concussion substitute must be a like-for-like replacement approved per competition rules; the replaced player takes no further part. [OBJ-01]
- **BR-013** — Career and team aggregate statistics are derived only from matches in Final state that are marked verified. [OBJ-05]
- **BR-014** — A player's appearance is added to their career record only after the appearance link is approved by an authorised role. [OBJ-07]
- **BR-015** — Competition standings recompute only from Final, non-disputed matches. [OBJ-04]
- **BR-016** — A match under dispute is locked to further scoring edits until an organizer records an adjudication. [OBJ-07]
- **BR-017** — Playing conditions are fixed at first ball; a mid-match change to conditions is recorded as an explicit, reasoned event. [OBJ-01]
- **BR-018** — The chase target is opposition total + 1, replaced by the DLS-revised target if any DLS revision is in effect. [OBJ-04]
- **BR-019** — A limited-overs result is valid only if the minimum-overs threshold for the format/competition was met by the side batting second; otherwise the result is "no result". [OBJ-04]
- **BR-020** — A tie triggers the competition's configured tie-breaker; if none is configured, the result stands as "tie". [OBJ-01]
- **BR-021** — Every DLS revision stores its inputs (overs lost, wickets down, score, time) and is individually reversible. [OBJ-07]
- **BR-022** — A guest (unauthenticated) match cannot be shared, synced, or attached to a competition until claimed by an account. [OBJ-10]
- **BR-023** — Public share links grant read-only access and can be revoked by the match owner at any time. [OBJ-07]
- **BR-024** — A deactivated member retains authorship of past events but can perform no new actions. [OBJ-07]
- **BR-025** — Deleting an account does not delete Final match records; the actor is anonymised in the audit trail per the retention policy. [OBJ-09]
- **BR-026** — Only the toss winner's elected decision determines the initial innings order; this is recorded before the first ball. [OBJ-01]
- **BR-027** — A bowler may not bowl two overs in succession in the same innings. [OBJ-01]
- **BR-028** — A bowler may not exceed the configured maximum overs per innings for the format/competition. [OBJ-01]
- **BR-029** — An innings ends at the first of: overs completed, configured wickets down, target passed, declaration, forfeiture, or (multi-day) time. [OBJ-01]
- **BR-030** — Retired–hurt/ill is not a dismissal and the batter may resume; retired-out counts as a wicket with no bowler credit. [OBJ-01]
- **BR-031** — Run-out, obstructing the field, hit the ball twice, timed out and retired-out do not credit the bowler. [OBJ-01]
- **BR-032** — A stumping is invalid off a no-ball; only run-out is possible off a no-ball. [OBJ-01]
- **BR-033** — On a free-hit delivery, the striker can be dismissed only by the modes permitted off a no-ball. [OBJ-01]
- **BR-034** — Byes and leg-byes are credited to team extras, not to the striker, and count as legal deliveries. [OBJ-01]
- **BR-035** — Wides and no-balls do not count as legal deliveries and must be re-bowled; associated runs are extras. [OBJ-01]
- **BR-036** — Penalty runs (5) are awarded to the opposing side and do not face a delivery. [OBJ-01]
- **BR-037** — A match total must always equal the sum of all batters' runs plus all extras; a card that fails this cannot be signed off without override. [OBJ-07]
- **BR-038** — Wickets in an innings may not exceed the configured maximum (default 10). [OBJ-01]
- **BR-039** — Net Run Rate is computed using the competition's configured rule set (typically runs-per-over for and against, with all-out treated as full quota of overs). [OBJ-04]
- **BR-040** — Bonus points are computed strictly per the competition's configured model. [OBJ-04]
- **BR-041** — A Super Over is one over per side, maximum two wickets, using three nominated batters and one nominated bowler per side. [OBJ-01]
- **BR-042** — If a Super Over is tied, the tie-breaker per current playing conditions is a further Super Over (unless the competition configures the legacy boundary count-back). [OBJ-01]
- **BR-043** — Super Over statistics do not count towards main-match or career batting/bowling aggregates. [OBJ-05]
- **BR-044** — Only an organization admin or platform admin may merge player records; the merge is logged and the losing ID redirects to the surviving ID. [OBJ-09]
- **BR-045** — Reference data updates (DLS tables, condition templates) apply to matches created after the update; in-progress matches keep the version they started with. [OBJ-01]

---

## 2.5 Cricket Scoring Requirements

*Domain rules the scoring engine must honour. The authoritative detail lives in `docs/specs/cricket-rules-reference.md`; these are the discovery-level requirements. All trace to OBJ-01, with OBJ-04 where mathematical.*

### Deliveries & overs
- **CSR-001** — An over comprises 6 legal deliveries; wides and no-balls are not legal deliveries and are re-bowled.
- **CSR-002** — Strike passes to the other batter at the end of each completed over.
- **CSR-003** — Strike passes on an odd number of runs run by the batters (bat, byes, or leg-byes), not on boundaries.
- **CSR-004** — Overthrows add their runs to the delivery; if they reach the boundary, 4 is added (plus runs already completed at the instant of the throw).
- **CSR-005** — A maiden over is an over from which no runs are scored off the bat and no extras chargeable to the bowler are conceded (byes/leg-byes still allow a maiden).
- **CSR-006** — The same bowler may not bowl consecutive overs.
- **CSR-007** — A bowler's overs are capped per format/competition (e.g. 10 in a 50-over innings, 4 in a 20-over innings), configurable.
- **CSR-008** — A partial final over (innings ends mid-over) is recorded with the actual number of legal balls bowled.

### Runs, extras & boundaries
- **CSR-009** — Runs off the bat are credited to the striker and to the team total.
- **CSR-010** — A boundary is 4 (ball reaches the boundary along the ground or after bouncing) or 6 (on the full).
- **CSR-011** — A wide adds 1 run plus any additional runs taken/boundary, all to extras; the delivery is re-bowled.
- **CSR-012** — A no-ball adds 1 run to extras; runs off the bat on a no-ball are credited to the striker; byes/leg-byes off a no-ball are separate extras; the delivery is re-bowled.
- **CSR-013** — A no-ball triggers a free hit for the next legal delivery where the competition's playing conditions specify it.
- **CSR-014** — Byes are runs scored when the ball passes the striker without touching bat or body; credited to extras; count as a legal delivery.
- **CSR-015** — Leg-byes are runs scored off the striker's body (not bat), only when a genuine shot or evasion was attempted; credited to extras; count as a legal delivery.
- **CSR-016** — Penalty runs (5) are awarded for specified infringements to the opposing side, added to the total without a ball being faced.
- **CSR-017** — Extras are displayed both itemised (b, lb, w, nb, pen) and as a single "Extras" line on the card.
- **CSR-018** — "One short" (a run not completed because a batter failed to ground bat/person behind the crease) reduces the runs for that delivery by the number of short runs.

### Dismissals
- **CSR-019** — Supported modes: bowled, caught, LBW, run out, stumped, hit wicket, obstructing the field, hit the ball twice, timed out, retired out.
- **CSR-020** — Bowler is credited for: bowled, caught, LBW, stumped, hit wicket.
- **CSR-021** — Bowler is not credited for: run out, obstructing the field, hit the ball twice, timed out, retired out.
- **CSR-022** — On a caught dismissal, if the batters had crossed at the moment of the catch, the not-out batter takes strike; the new batter is otherwise on strike (subject to end-of-over).
- **CSR-023** — A run out is attributed to the end at which the wicket was broken; the correct batter is recorded as out based on which batters had crossed.
- **CSR-024** — A stumping requires the wicket-keeper, the striker out of the crease not attempting a run, and a legal delivery (not a no-ball).
- **CSR-025** — Off a no-ball, only run out is possible; off a free hit, only the modes possible off a no-ball apply.
- **CSR-026** — A batter dismissed for zero without facing a legal delivery is recorded as a duck (or "diamond duck" where tracked).
- **CSR-027** — Retired hurt/ill: not a dismissal; the batter may resume when a wicket falls or at the fall of the last wicket; if they cannot resume, the innings shows "retired not out".
- **CSR-028** — Retired out (without an acceptable reason): recorded as a wicket, no bowler credit.
- **CSR-029** — Run out at the non-striker's end before the ball is delivered ("mankad") is a legal run out.
- **CSR-030** — An innings is "all out" at the configured number of wickets (default 10), or earlier if insufficient batters are available to continue.

### Fall of wickets, partnerships & milestones
- **CSR-031** — Each wicket records: team score at fall, wicket number, batter dismissed, over.ball, and (where tracked) batter's runs/balls.
- **CSR-032** — A partnership records runs and balls added while a specific pair was together, including extras conceded during that period.
- **CSR-033** — An unbroken partnership at innings end is marked not out.
- **CSR-034** — Batting milestones: 50, 100, and every subsequent 50; flagged when reached.
- **CSR-035** — Bowling milestones: 5 wickets in an innings; 10 wickets in a match (multi-day).
- **CSR-036** — A hat-trick is three wickets from three consecutive deliveries by the same bowler, which may span overs, spells, or innings within the same match.

### Match maths & results
- **CSR-037** — Current run rate = runs ÷ overs (as a decimal of legal balls).
- **CSR-038** — Required run rate = runs still required ÷ overs remaining.
- **CSR-039** — Projected score = current rate × total overs (and a set of alternative projections at chosen rates).
- **CSR-040** — Target when batting second = first-innings total + 1, or the DLS-revised target.
- **CSR-041** — Result "won by N runs" applies when the side batting first has more runs after the side batting second is all out or overs expire.
- **CSR-042** — Result "won by W wickets" applies when the side batting second reaches the target, with W = wickets in hand.
- **CSR-043** — Result "tie" applies when scores are level and the side batting second has completed its innings.
- **CSR-044** — Result "no result" / "abandoned" applies when the minimum-overs condition is not met.
- **CSR-045** — Additional result types: won by DLS, won by Super Over, match awarded, match conceded/forfeited.
- **CSR-046** — Over-rate or code-of-conduct penalties may add runs or dock points per competition rules and are recorded explicitly.

### Rain / DLS / reduced overs
- **CSR-047** — When overs are lost, the innings' total overs and any per-bowler quotas are recalculated per playing conditions.
- **CSR-048** — DLS (Standard Edition) produces a revised target for the side batting second and a par score at every point of the chase.
- **CSR-049** — A par score is the score the chasing side must have reached, for the wickets lost, to be level on DLS at that moment.
- **CSR-050** — If a match is abandoned mid-chase, the result is decided by comparing the actual score with par at the last completed valid ball, provided the minimum overs were bowled.
- **CSR-051** — Every DLS revision is versioned and reversible; a manual target can override the computed one with a recorded reason.

### Super Over
- **CSR-052** — Each side bats one over; the innings ends at 6 legal balls or the loss of 2 wickets.
- **CSR-053** — Each side nominates three batters and one bowler for the Super Over.
- **CSR-054** — The side that bowled first in the match bats first in the Super Over (or per current playing conditions).
- **CSR-055** — If the Super Over is tied, a further Super Over is played (unless the competition configures boundary count-back).
- **CSR-056** — Boundary count-back (legacy, configurable): the side that hit more boundaries (match then Super Over) wins.

### Competition metrics
- **CSR-057** — Net Run Rate = (total runs scored ÷ total overs faced) − (total runs conceded ÷ total overs bowled), with a side dismissed inside its overs treated as having batted its full quota.
- **CSR-058** — Points are awarded per the competition's configured model (win/tie/no-result/bonus).
- **CSR-059** — Bonus points are computed per the competition's configured thresholds (e.g. batting/bowling points, or a run-rate ratio).

### Multi-day specifics *(P3)*
- **CSR-060** — Multi-day support adds: two innings per side, sessions, declarations, the follow-on (with the configured lead threshold for the match length), the new ball (available after the configured number of overs), and carrying unbroken state across days.

---

## 2.6 Online Requirements

*Behaviour that requires connectivity. Trace OBJ-03/05/10 unless noted.*

- **ONR-001** — Sync completed and in-progress match events to the backend when connectivity is available.
- **ONR-002** — Publish a live match to a shareable read-only link.
- **ONR-003** — Stream near-real-time updates to viewers of a live match.
- **ONR-004** — Merge the head and assistant scorers' state and show a combined live view.
- **ONR-005** — Show presence indicators (who is scoring / viewing).
- **ONR-006** — Deliver push notifications for wicket, innings break and result.
- **ONR-007** — Automatically back up each match to the cloud as it is scored.
- **ONR-008** — Authenticate new sign-ins and refresh tokens.
- **ONR-009** — Recompute competition standings, NRR and bonus points server-side on sign-off.
- **ONR-010** — Provide the read-only REST API and real-time subscription channel. *(P2)*
- **ONR-011** — Allow a match to be resumed on a different device via the cloud copy (cross-device handoff).
- **ONR-012** — Deliver reference-data updates (DLS tables, condition templates, app config) over the air. *(OBJ-01)*
- **ONR-013** — Import fixtures, squads and historical matches from files or other systems. *(P2, OBJ-09)*
- **ONR-014** — Approve/reject player appearance claims and process account data-export/erasure requests.
- **ONR-015** — Send email invitations and role-change notifications.
- **ONR-016** — Perform server-side validation of uploaded event logs and flag conflicts for reconciliation.
- **ONR-017** — Provide organizer dashboards (fixtures, results, disputes) with live data.
- **ONR-018** — Serve public competition and profile pages.
- **ONR-019** — Support web push and Android push registration and delivery. *(P2)*
- **ONR-020** — Provide platform-admin operations: tenant management, feature flags, staged rollout, health monitoring.
- **ONR-021** — Support audited, consented support impersonation. *(OBJ-07)*
- **ONR-022** — Revoke or rotate public share links and API keys. *(OBJ-07)*

---

## 2.7 Offline Requirements

*Trace OBJ-02 unless noted.*

- **OFR-001** — Create and fully configure a match with no connectivity.
- **OFR-002** — Score a complete match (both innings, Super Over, sign-off) with no connectivity.
- **OFR-003** — Persist every scoring event durably on-device before the UI confirms it.
- **OFR-004** — Recover to the exact last confirmed state after a crash, OS kill, or reboot.
- **OFR-005** — Maintain a local queue of unsynced events with a visible count and status.
- **OFR-006** — Assign each local event a monotonic per-device sequence and logical timestamp for later deterministic merge. *(OBJ-03)*
- **OFR-007** — Access previously loaded squads, players, templates and competition config while offline.
- **OFR-008** — Perform all DLS/par calculations offline. *(OBJ-04)*
- **OFR-009** — Render the full scorecard, linear sheet, bowling analysis, FoW and standard charts offline. *(OBJ-05)*
- **OFR-010** — Produce PDF and CSV exports offline. *(OBJ-09)*
- **OFR-011** — Create and restore local backup files without connectivity.
- **OFR-012** — Sustain a multi-day match locally for ≥ 5 days with no data loss. *(P3)*
- **OFR-013** — Score entirely in guest mode with no account and no network.
- **OFR-014** — Let two scorers each score the same match fully offline and reconcile later. *(OBJ-03)*
- **OFR-015** — Record corrections offline; they sync as superseding events. *(OBJ-07)*
- **OFR-016** — Warn the user before local storage limits are reached and offer to purge synced matches.
- **OFR-017** — Use the device clock for timestamps while offline and flag suspected clock skew on sync. *(OBJ-03)*
- **OFR-018** — Sign off a match offline; publish and notify are deferred until reconnection. *(OBJ-07)*
- **OFR-019** — Queue outbound share/publish intents created while offline.
- **OFR-020** — Continue an authenticated session offline for a configurable grace period.
- **OFR-021** — Pre-download a match's squads/config while online for planned offline use.
- **OFR-022** — Indicate clearly, at all times, whether the app is online or offline and when it last synced.
- **OFR-023** — Never block or delay a scoring input on a network operation.
- **OFR-024** — Preserve unsynced local data across app updates.

---

## 2.8 Web Requirements

*Trace OBJ-06 unless noted.*

- **WEB-001** — Delivered as an installable PWA that works offline (add-to-home-screen, offline scoring). *(OBJ-02)*
- **WEB-002** — Responsive layouts for desktop, laptop and tablet, including a landscape "scorebox" layout.
- **WEB-003** — Keyboard-first scoring with configurable hotkeys, plus mouse and touch input. *(OBJ-08)*
- **WEB-004** — Multi-pane view on large screens (scoring controls + live card + ball log simultaneously).
- **WEB-005** — Print-optimised scorecard and linear scoresheet. *(OBJ-05)*
- **WEB-006** — Support current evergreen browsers, including on Chromebooks.
- **WEB-007** — Persist in-progress scoring across page reload and browser crash using local persistent storage. *(OBJ-02)*
- **WEB-008** — Viewer access requires only opening a URL — no install, no account. *(OBJ-05)*
- **WEB-009** — Download exports (PDF, CSV, JSON) to the local filesystem. *(OBJ-09)*
- **WEB-010** — Large-screen dual-scorer reconciliation view with side-by-side ball comparison. *(OBJ-03)*
- **WEB-011** — Copy/share a live or final match link; optional embeddable scorecard. *(OBJ-05)*
- **WEB-012** — Meet WCAG 2.2 AA on core scoring and scorecard flows; full keyboard navigation and screen-reader labels. *(OBJ-11)*
- **WEB-013** — Locale selection for interface language, date/time and number formats. *(OBJ-11)*
- **WEB-014** — Warn before navigating away from an unsaved/unsynced scoring session.
- **WEB-015** — High-contrast theme suitable for bright environments. *(OBJ-11)*
- **WEB-016** — Organizer/admin consoles (competitions, fixtures, standings, roles, registry) are web-only surfaces.
- **WEB-017** — Analytics/charts views with export of chart data. *(OBJ-05)*
- **WEB-018** — Graceful offline indicator and "last updated" state on viewer pages. *(OBJ-07)*
- **WEB-019** — Session and auth handling that supports an offline grace period. *(OBJ-02)*
- **WEB-020** — Performance budget: interactive scoring on a mid-range laptop with no perceptible input lag. *(OBJ-08)*
- **WEB-021** — Manage local storage (usage view, purge synced matches). *(OBJ-02)*
- **WEB-022** — Consistent scoring-core behaviour with the Android client (shared rules core / contract tests). *(OBJ-06)*

---

## 2.9 Android Requirements

*Trace OBJ-06/08 unless noted.*

- **AND-001** — Offline-first native Android app supporting Android 10 and above. *(OBJ-02)*
- **AND-002** — Portrait, one-handed scoring layout with primary actions in the thumb zone.
- **AND-003** — Large, well-spaced touch targets usable with thin gloves and in cold conditions.
- **AND-004** — Local database persistence that survives app kill, low-memory eviction and device reboot. *(OBJ-02)*
- **AND-005** — Write-ahead persistence of each scoring event before UI confirmation. *(OBJ-02)*
- **AND-006** — Background sync when connectivity returns, with progress and unsynced count. *(OBJ-03)*
- **AND-007** — Preserve full match state across interruptions (calls, notifications, app switch, screen lock) and resume instantly. *(OBJ-02)*
- **AND-008** — "Keep screen awake while scoring" option; sensible timeout otherwise.
- **AND-009** — Optional haptic feedback on entry and an undo gesture.
- **AND-010** — Battery-efficient enough for a full day of intermittent scoring on a mid-range phone. *(OBJ-02)*
- **AND-011** — Support small-to-large phones and basic tablet layouts; portrait and landscape.
- **AND-012** — High-contrast, sunlight-readable scoring mode. *(OBJ-11)*
- **AND-013** — Android share-sheet integration for share links and exported files. *(OBJ-09)*
- **AND-014** — Push notifications (wicket, innings, result, assignments) when online. *(OBJ-05)*
- **AND-015** — Pre-download match/squad/config data for planned offline use. *(OBJ-02)*
- **AND-016** — Request only the minimum permissions necessary; no location/contacts unless a feature requires it. *(OBJ-07)*
- **AND-017** — Distributed via Google Play with in-app update prompts.
- **AND-018** — Create and restore local backup files via the Android file provider. *(OBJ-02)*
- **AND-019** — Preserve unsynced data across app updates. *(OBJ-02)*
- **AND-020** — Cold start to "ready to score" within the performance budget on target hardware.
- **AND-021** — Accessibility: TalkBack labels, dynamic text scaling, sufficient contrast on core flows. *(OBJ-11)*
- **AND-022** — Offline sign-in via cached session for a configurable grace period. *(OBJ-02)*
- **AND-023** — Clear online/offline and last-synced indicators in the scoring UI. *(OBJ-07)*
- **AND-024** — Consistent scoring-core behaviour with the web client (shared rules core / contract tests). *(OBJ-06)*

---

## 2.10 Administrator Requirements

*Split: `ADM-0xx` organization admin; `ADM-1xx` platform admin. Trace OBJ-10/07 unless noted.*

### Organization administrator
- **ADM-001** — Create and configure an organization (name, branding, logo, colours, home ground).
- **ADM-002** — Invite members by email with a pre-assigned role and manage pending invitations.
- **ADM-003** — Assign, change and revoke roles for members.
- **ADM-004** — Deactivate/reactivate members without deleting their authored history.
- **ADM-005** — Maintain the organization's canonical player registry.
- **ADM-006** — Merge duplicate player records, redirecting historical appearances. *(OBJ-09)*
- **ADM-007** — Create and maintain teams and their squads.
- **ADM-008** — Create competitions/seasons with format and playing-condition templates.
- **ADM-009** — Configure the competition points model, bonus-point rules and NRR rule set. *(OBJ-04)*
- **ADM-010** — Generate or import fixtures and assign scorers.
- **ADM-011** — Lock a disputed match and record an adjudication with rationale. *(OBJ-07)*
- **ADM-012** — Approve/reject player appearance-link requests.
- **ADM-013** — View the audit trail and sign-off status for any match in the organization.
- **ADM-014** — Apply organization branding to scorecards and exports. *(OBJ-05)*
- **ADM-015** — Configure default templates and notification policies for the organization.
- **ADM-016** — Export the organization's data (matches, competitions, registry) in an open format. *(OBJ-09)*
- **ADM-017** — Handle member data-export and erasure requests within the org's scope. *(OBJ-09)*
- **ADM-018** — Manage organization API keys and integration settings. *(P2)*
- **ADM-019** — Bulk-import players and teams from a file. *(P2)*
- **ADM-020** — Publish or unpublish the organization's public competition pages. *(OBJ-05)*

### Platform administrator
- **ADM-101** — Create, suspend and delete tenants; enforce tenant data isolation.
- **ADM-102** — Manage plans, quotas and limits per tenant (pending business-model decision).
- **ADM-103** — Manage global users (lookup, lock, force password reset, revoke sessions).
- **ADM-104** — Configure feature flags and staged/percentage rollouts. *(OBJ-06)*
- **ADM-105** — Update reference data centrally: DLS tables, playing-condition templates, format defaults. *(OBJ-01)*
- **ADM-106** — Monitor system health, sync backlogs and error rates without exposing personal data.
- **ADM-107** — Perform support impersonation only with recorded user consent and full audit logging. *(OBJ-07)*
- **ADM-108** — Access a global, immutable audit log across tenants.
- **ADM-109** — Manage platform-level integrations and public API access.
- **ADM-110** — Configure data-retention and backup policies; trigger and verify restores.
- **ADM-111** — Manage announcement/maintenance banners and forced-update thresholds.
- **ADM-112** — Review and action platform-level abuse reports and rate-limit events. *(OBJ-10)*
- **ADM-113** — Manage legal/compliance documents surfaced in-app (privacy policy, terms, licences).
- **ADM-114** — Roll back a release or reference-data update safely. *(OBJ-06)*

---

## 2.11 Scorer Requirements

*Covers Head Scorer and Assistant/Co-Scorer. Trace OBJ-01/02/08 unless noted.*

- **SCR-001** — Create a ready-to-score match in under two minutes from a template.
- **SCR-002** — Enter opening batters and bowler and start an innings.
- **SCR-003** — Record a normal delivery in ≤ 2 interactions.
- **SCR-004** — Record every extra type (wide, no-ball + free hit, bye, leg-bye, penalty).
- **SCR-005** — Record every dismissal mode with correct batter/bowler credit and FoW.
- **SCR-006** — Record substitutions (fielder, concussion, impact where allowed), retirements and resumptions.
- **SCR-007** — Rely on automatic strike rotation, ball counting and over completion.
- **SCR-008** — Receive guardrail warnings (consecutive over, over limit, illegal XI count, keeper/no-ball stumping) with a reasoned override path. *(OBJ-07)*
- **SCR-009** — See persistent live state (striker, non-striker, bowler, over.ball, score/wickets, extras, RR, RRR, runs required, balls left, target, DLS par).
- **SCR-010** — Undo/redo the most recent actions instantly.
- **SCR-011** — Navigate to and correct any earlier delivery, with all figures recomputing and history preserved. *(OBJ-07)*
- **SCR-012** — Manage innings transitions: interruptions, reduced overs, declarations (P3), all-out, target reached, close.
- **SCR-013** — Enter overs lost and obtain a revised target and live par; override manually with a reason. *(OBJ-04)*
- **SCR-014** — Run the Super Over workflow and any configured tie-breaker.
- **SCR-015** — Score in dual mode: independent entry, divergence alerts, ball-by-ball reconciliation, mutual confirmation, dual sign-off. *(OBJ-03)*
- **SCR-016** — Use end-of-over and end-of-innings checkpoints to confirm figures.
- **SCR-017** — Add optional per-ball commentary and match/session/day notes. *(OBJ-05)*
- **SCR-018** — Review the full scorecard, linear sheet, bowling analysis and FoW before sign-off, with an automatic reconciliation check. *(OBJ-07)*
- **SCR-019** — Sign off the match (and counter-sign as assistant/umpire), transitioning it to Final. *(OBJ-07)*
- **SCR-020** — Export (PDF/CSV/Cricsheet-JSON) and share a link after sign-off, including offline. *(OBJ-09)*
- **SCR-021** — Resume a match after app close, crash, device restart, or on a different device. *(OBJ-02)*
- **SCR-022** — Score an entire match offline from setup to sign-off with zero data loss. *(OBJ-02)*
- **SCR-023** — Save and reuse setup templates (e.g. "League T20 conditions").
- **SCR-024** — Record abandoned / no-result / forfeit outcomes correctly. *(OBJ-04)*
- **SCR-025** — Close and resume a multi-day match across days, tracking overs remaining and new-ball status. *(P3)*
- **SCR-026** — Use high-contrast, large-text, glove-friendly scoring modes. *(OBJ-11)*
- **SCR-027** — Hand over / transfer scoring authority to another scorer or device mid-match, with audit. *(OBJ-07)*
- **SCR-028** — Pre-load squads and configuration while online for offline use. *(OBJ-02)*
- **SCR-029** — Add ad-hoc players when they are missing from the squad at the ground.
- **SCR-030** — See a clear online/offline and last-synced indicator at all times. *(OBJ-07)*
- **SCR-031** — Record drinks breaks, ball changes and over-rate-relevant timing. *(OBJ-04)*
- **SCR-032** — Get a warning before local storage fills and an option to purge synced matches. *(OBJ-02)*
- **SCR-033** — View the audit trail for the match being scored. *(OBJ-07)*
- **SCR-034** — Keep the screen awake while actively scoring.
- **SCR-035** — Work through a guided first-match walkthrough as a new scorer. *(OBJ-08)*

---

## 2.12 Captain / Team Requirements

*Covers Team Manager and Captain. Trace OBJ-10 unless noted.*

- **CTR-001** — Maintain a team profile (name, colours, logo, home ground).
- **CTR-002** — Maintain a squad list with player details and availability.
- **CTR-003** — View the team's fixture list and schedule.
- **CTR-004** — Submit a playing XI for a fixture, marking captain and wicket-keeper, before the deadline.
- **CTR-005** — Draft an XI offline and submit it when connectivity is available. *(OBJ-02)*
- **CTR-006** — Nominate a substitute pool (fielders; concussion/impact subs where the competition allows).
- **CTR-007** — Receive notifications: fixture scheduled, XI deadline approaching, XI locked, result posted. *(OBJ-05)*
- **CTR-008** — Provide the toss result where authorised to do so. *(OBJ-01)*
- **CTR-009** — View the team's results and full match history.
- **CTR-010** — View team and player statistics, recent form and head-to-head. *(OBJ-05)*
- **CTR-011** — Confirm or dispute a posted result within a defined window, routing disputes to the organizer with an audit entry. *(OBJ-07)*
- **CTR-012** — Export the team's own match data in an open format. *(OBJ-09)*
- **CTR-013** — Manage which squad members have app access and their team-scoped roles.
- **CTR-014** — See the opposition's submitted XI once both are in (or after the deadline).
- **CTR-015** — Nominate default team scorers for the team's fixtures.
- **CTR-016** — Flag a player as unavailable/injured so selection views reflect it.
- **CTR-017** — View live score for the team's in-progress matches. *(OBJ-05)*
- **CTR-018** — Cannot create, edit or correct any ball-by-ball data. *(OBJ-07)*
- **CTR-019** — Request an appearance link/approval on behalf of a squad player. *(OBJ-07)*
- **CTR-020** — Receive a season summary export for the team. *(OBJ-09)*

---

## 2.13 Viewer Requirements

*Covers Spectator/Fan, and read-only aspects for Umpire, Commentator, Analyst. Trace OBJ-05 unless noted.*

- **VWR-001** — Open a shared live/final match link in a browser with no account and no install.
- **VWR-002** — See a live scorecard: score/wickets, overs, current batters, current bowler, RR, RRR, runs required, balls remaining, target.
- **VWR-003** — See the DLS par score and revised target when a DLS revision is in effect. *(OBJ-04)*
- **VWR-004** — See the last N deliveries and a ball-by-ball feed.
- **VWR-005** — See the full scorecard, fall of wickets, partnerships and itemised extras.
- **VWR-006** — See analytics charts (Manhattan, worm, run rate, partnerships).
- **VWR-007** — See commentary and match/session notes when provided.
- **VWR-008** — Receive near-real-time updates while the source device is online.
- **VWR-009** — See a clear "updated X ago" / offline indicator when the source is disconnected. *(OBJ-07)*
- **VWR-010** — Follow a match to receive wicket / innings-break / result alerts (may require a lightweight identifier).
- **VWR-011** — Browse a competition's fixtures, results and standings. *(OBJ-10)*
- **VWR-012** — View public team and player profile pages (a public subset of stats).
- **VWR-013** — Search and browse historical matches.
- **VWR-014** — Share a match, or a specific moment, as a link.
- **VWR-015** — Never be able to modify any match data (strictly read-only). *(OBJ-07)*
- **VWR-016** — Use the viewer on any modern phone, tablet or desktop browser. *(OBJ-06)*
- **VWR-017** — Select interface language. *(OBJ-11)*
- **VWR-018** — Viewer pages meet WCAG 2.2 AA. *(OBJ-11)*
- **VWR-019** — Umpire view: a compact read of over.ball, score/wickets, DLS par and required runs for quick cross-checking. *(OBJ-07)*
- **VWR-020** — Umpire confirmation: counter-sign the result and confirm sanctions where the competition requires it. *(OBJ-07)*
- **VWR-021** — Commentator view: live card plus the ability to add commentary entries (a scoped write, not a scoring write).
- **VWR-022** — Analyst view: filter ball-by-ball data and export the match or season. *(OBJ-09)*

---
---

# 3. DEVELOP

*Discovery-level planning that turns the decomposed requirements into a buildable, verifiable backlog. No technical design.*

## 3.1 Prioritisation model

- **MoSCoW** per requirement (already tagged): Must for pilot correctness/trust, Should for pilot completeness, Could for differentiation, Won't-yet for explicitly deferred.
- **Phase**: P1 = closed pilot / MVP; P2 = post-pilot hardening & competitions; P3 = multi-day, advanced analytics, integrations.
- **Guiding rule:** a requirement is P1 only if a real club cannot score and file an official limited-overs match without it.

### P1 (pilot / MVP) requirement set — summary

| Cluster | In P1 | Deferred |
|---|---|---|
| Accounts & tenancy | Guest scoring, accounts, org + roles, offline session, data export/delete | API keys, minors' guardian flow (P2) |
| Match setup | Templates, custom limited-overs, toss, conditions, validation | Multi-day config (P3) |
| Squads & lineup | Squad list, XI + roles, ad-hoc players, XI validation, sub-fielder pool | Registry merge, XI deadlines (P2), impact player (P3) |
| Live scoring | Full delivery/extras/dismissal set, free hit, guardrails, undo/redo, live state, corrections | Wagon wheel / pitch map (P2/P3), keeper change (P2) |
| Innings/state | Auto-end, interruptions, reduced overs, all result types, state machine | Declaration, follow-on, forfeiture (P3) |
| DLS | Revised target, live par, versioned revisions, manual override, offline | Alternative rain methods (P2) |
| Tie-break | Super Over, repeat Super Over, boundary count-back fallback | — |
| Audit & sign-off | Immutable log, reconciliation check, single sign-off, audit view, post-final control | Counter-signature workflow (P2) |
| Dual-scorer | — | Entire dual-scorer reconciliation (P2) |
| Outputs | Full card, linear sheet, bowling analysis, FoW, over-by-over, partnerships, Manhattan/worm/run-rate, milestones, live card | Deep analytics, embeds (P2/P3) |
| Competitions | — (single matches only in P1) | Fixtures, standings, NRR, bonus points (P2) |
| Profiles/stats | Basic match history & search | Career aggregates, claims, head-to-head (P2) |
| Sharing | Shareable read-only live/final link, offline indicator | Follow alerts, push, embeds (P2) |
| Export | PDF, CSV, Cricsheet-JSON, local backup/restore — all offline | Import, read API, real-time API (P2) |
| Platform | Tenant isolation, RBAC, central reference data, staged rollout, consented impersonation | Plans/quotas, cross-tenant analytics (P2) |

## 3.2 Traceability (requirements → foundation objectives)

| OBJ | Primary requirement coverage |
|---|---|
| OBJ-01 Law-accurate engine | CSR-001…060, FR-043…072, BR-009…043, NFR-053/054 |
| OBJ-02 Offline-first | OFR-001…024, NFR-009…015, WEB-001/007, AND-001…005 |
| OBJ-03 Deterministic sync / dual-scorer | FR-113…120, ONR-001/004/016, OFR-006/014/017, NFR-016…019 |
| OBJ-04 Match mathematics | CSR-037…059, FR-080…091, FR-145…147, BR-018/019/039/040 |
| OBJ-05 Complete outputs | FR-121…138, FR-150, VWR-002…007, NFR-004 |
| OBJ-06 Cross-platform parity | NFR-047/048, WEB-022, AND-024, ADM-104/114 |
| OBJ-07 Verifiability / trust | FR-100…112, BR-003…008/025/037, NFR-023…029, ADM-107/108 |
| OBJ-08 Speed of entry | NFR-001…005, FR-061/065, SCR-001/003, AND-002/003 |
| OBJ-09 Data ownership / portability | FR-010/011/171…182, NFR-049…052, CTR-012, VWR-022 |
| OBJ-10 Multi-tenant | FR-005…009, ADM-001…020/101…103, NFR-020…022 |
| OBJ-11 Accessibility / i18n | FR-183…185, NFR-031/037…042/057…059, WEB-012, AND-021, VWR-018 |

**Coverage gaps to watch:** OBJ-03 has *no* P1 coverage by design (dual-scorer is P2) — the P1 architecture must still lay the event-log foundation so P2 doesn't require a rewrite (spike SPK-02).

## 3.3 Spec-backlog mapping & agent ownership

Each cluster becomes one or more spec documents under `docs/specs/`, owned per the project's configured agents. *(This is the plan for producing specs, not the specs themselves.)*

| Spec document (planned) | Source clusters | Owning agent |
|---|---|---|
| `cricket-rules-reference.md` *(single source of truth)* | CSR-001…060, BR-027…043 | product-spec |
| `match-setup.md` | EP-02, FR-016…030, BR-002/017/026 | product-spec |
| `squads-and-lineups.md` | EP-03, FR-031…042, BR-009…012 | product-spec |
| `live-scoring.md` | EP-04, FR-043…072, SCR-001…016 | product-spec |
| `innings-and-match-state.md` | EP-05, FR-073…085, BR-029 | product-spec |
| `dls-and-reduced-overs.md` | EP-06, FR-086…094, CSR-047…051 | product-spec |
| `tie-breakers.md` | EP-07, FR-095…099, CSR-052…056 | product-spec |
| `corrections-audit-signoff.md` | EP-08, FR-100…112, BR-003…008 | product-spec |
| `dual-scorer-reconciliation.md` *(P2)* | EP-09, FR-113…120 | product-spec |
| `scorecards-and-analytics.md` | EP-10, FR-121…138 | product-spec |
| `competitions-and-standings.md` *(P2)* | EP-11, FR-139…150, CSR-057…059 | product-spec |
| `profiles-stats-history.md` *(P2)* | EP-12, FR-151…160 | product-spec |
| `sharing-notifications-viewer.md` | EP-13, FR-161…170, VWR-* | product-spec |
| `data-portability.md` | EP-14, FR-171…182 | product-spec |
| `administration.md` | EP-15, ADM-* | product-spec |
| `nfrs-and-quality-gates.md` | NFR-*, success criteria | product-spec + architecture (review) |
| `offline-first-strategy.md` *(architecture, later)* | OFR-*, NFR-009…019 | architecture |
| `system-overview.md` / `supabase-schema.md` / `realtime-sync.md` / `api-contracts.md` *(architecture, later)* | derived from the above | architecture |

**Definition of Ready (for a spec to enter Develop):** user stories written; acceptance criteria in Given/When/Then; edge cases listed; open questions logged; traced to ≥1 OBJ; no contradiction with `cricket-rules-reference.md`.
**Definition of Done (discovery):** every listed requirement ID appears in exactly one spec; every P1 requirement has acceptance criteria; every open question has an owner and a needed-by date.

## 3.4 Sequencing & dependencies

1. **`cricket-rules-reference.md` first** — everything else defers to it.
2. **Domain glossary + match state machine** (Decompose/Domain layer) — entities and the ball-event vocabulary.
3. **Live scoring + innings state + audit** specs — the core; nothing ships without these.
4. **DLS + tie-breakers** — depend on innings state and result types.
5. **Scorecards/analytics** — depend on a stable event log.
6. **Offline-first strategy** (architecture) — must be designed before, not after, the clients; the event-log shape gates P2 sync and dual-scorer.
7. **Sharing/viewer** — depends on a publishable match model.
8. **Competitions/standings, profiles/stats** (P2) — depend on Final matches + stable IDs.
9. **Dual-scorer reconciliation** (P2) — depends on the P1 event-log/provenance foundation.
10. **Multi-day** (P3) — its own spec pass; do not let it complicate P1 state modelling beyond leaving room for it.

## 3.5 Spikes and open questions (must resolve before/inside Develop)

### Spikes (`SPK-`)
- **SPK-01 — DLS licensing/IP.** Confirm the legal basis for implementing DLS Standard Edition; define the fallback (manual targets only) if it can't be cleared. *Blocks FR-086…094, NFR-034.* Owner: product/legal.
- **SPK-02 — Event-log & provenance model.** Prove an append-only, per-device-sequenced ball-event log that supports P1 corrections *and* P2 deterministic merge/dual-scorer without a rewrite. *Blocks OBJ-03 readiness.* Owner: architecture.
- **SPK-03 — Offline durability on Android.** Validate write-ahead persistence + crash recovery against the chaos-test definition on target-tier hardware. *Blocks NFR-009…011.* Owner: architecture + android.
- **SPK-04 — Cross-platform rules core.** Decide how identical scoring behaviour is guaranteed on Web + Android (shared library vs spec + contract tests). *Blocks NFR-047/048.* Owner: architecture.
- **SPK-05 — Interchange format.** Confirm Cricsheet-compatible JSON/YAML as the export target and enumerate any lossy fields. *Blocks FR-171…176, NFR-050…052.* Owner: product-spec.
- **SPK-06 — MCC Laws text permission.** Determine what in-app rule/help text needs permission vs. can be paraphrased. *Blocks NFR-035.* Owner: product/legal.

### Open questions carried from the Foundation (still blocking)
- **A1** primary v1 segment · **A2** first geography · **A4** business model → shape roles, tenancy limits, and `ADM-102`.
- **B5** formats in v1 (confirm limited-overs only) · **B6** DLS in v1 vs manual · **B7** dual-scorer v1 vs P2 (assumed P2 here) · **B8** tournaments v1 vs P2 (assumed P2).
- **C12** guest scoring required (assumed yes) · **C13** umpire/commentator roles in v1 (assumed light/P2).
- **D16** confirm Supabase backend · **D17** PWA acceptable for web offline · **D19** shared-core approach (see SPK-04).
- **E21** ownership of DLS/MCC licensing + budget · **E22** match data ownership model (scorer vs club vs platform) → `BR-001`, `BR-025`.

### New questions surfaced by this discovery
- **Q-D1** Is a Super Over required in P1, or acceptable as a fast-follow? (Currently P1.)
- **Q-D2** For P1 single matches with no competition, how are teams/players created — lightweight per-match, or must an org exist first?
- **Q-D3** Counter-signature (assistant/umpire) — needed for a P1 match to be considered "official", or is single sign-off enough for the pilot?
- **Q-D4** Minimum viable analytics for pilot scorers — is Manhattan/worm/run-rate enough, or do pilot leagues expect wagon wheels day one?
- **Q-D5** Do pilot leagues mandate a specific results/export format we must match in addition to Cricsheet?
- **Q-D6** Notifications in P1 — is a shareable link enough, or are result notifications table-stakes for the pilot?

---
---

# 4. DELIVER

*Discovery-level definition of how the product reaches users and how we know it worked. Ties directly to the Foundation's Success Criteria and the Build → Verify → Feedback → Improve loop.*

## 4.1 Release strategy & phases

| Stage | Audience | Scope | Entry gate | Exit gate |
|---|---|---|---|---|
| **Alpha (internal)** | Team + 1–2 friendly scorers | P1 core scoring, offline, single sign-off, PDF/CSV export | Rules conformance suite ≥ 95%; offline chaos test drafted | 3 full practice matches scored end-to-end with no data loss |
| **Closed pilot** | ≥ 5 clubs/leagues (Foundation SC) | Full P1 set | Conformance suite 100%; chaos test passes; WCAG AA on core web flows; DLS benchmark within tolerance (or SPK-01 fallback in place) | ≥ 100 complete matches scored; scorer error rate ≤ paper baseline; SUS ≥ 80 |
| **Open beta** | Public sign-up, limited support SLA | P1 + P2 (dual-scorer, competitions, standings, profiles, push, import/API) | Pilot exit met; P2 specs verified; sync convergence tests pass | Availability ≥ 99.5% over a full month; parity matrix ≥ 95% |
| **GA** | All | P2 hardened; P3 roadmap published | Beta exit met; legal (DLS licence, MCC permission, privacy policy, app-store approval) all cleared; support + on-call in place | — |
| **Post-GA** | All | P3: multi-day, advanced analytics, deeper integrations | GA stable | Continuous |

## 4.2 Pilot definition (entry / exit criteria in detail)

**Pilot entry checklist**
- P1 requirement set (all `M · P1`) implemented and spec-verified.
- `NFR-053` conformance suite: 100% pass, reviewed by an accredited scorer.
- `NFR-009` chaos/offline test: 0 events lost over ≥ 50 simulated innings on target hardware.
- `NFR-006` sync: full offline T20 syncs ≤ 30 s on a 3G-class link.
- `NFR-037` WCAG 2.2 AA verified on core web scoring + scorecard flows.
- DLS benchmark set matches reference within tolerance **or** SPK-01 fallback (manual targets) documented and accepted by pilot leagues.
- Scorer quick-start guide + `cricket-rules-reference.md` published.
- Rollback plan and local-backup/restore verified.

**Pilot exit checklist (maps to Foundation §8)**
- ≥ 5 clubs/leagues, ≥ 100 complete matches scored end-to-end over one season.
- Scorer-reported error rate at or below the paper baseline.
- SUS ≥ 80; first-match task completion ≥ 95% with no unrecoverable errors.
- Every pilot match has a complete, attributable audit trail from first ball to sign-off.
- Exported scorecards reconcile with zero discrepancy; Cricsheet round-trip fidelity demonstrated.
- ≥ 80% of pilot scorers say they'd choose it over their current method.
- Cross-platform parity ≥ 95% for the scoring core; identical inputs → identical outputs on Web and Android.

## 4.3 Verification plan (the "Verify" gate)

| Verification | Covers | Cadence |
|---|---|---|
| **Cricket rules conformance suite** (versioned, per `CSR-*` and worked examples) | OBJ-01 | Every build; 100% required to release |
| **DLS benchmark comparison** (fixed rain-scenario set vs reference outputs) | OBJ-04, FR-086…091 | Every DLS change; each release |
| **Reconciliation checks** (totals, balls↔overs, wickets≤max on every scorecard) | OBJ-07, BR-037 | Automated on every match, blocks sign-off |
| **Offline chaos test** (force-kill, battery pull, OS eviction, airplane toggling) | OBJ-02, NFR-009…011 | Pre-pilot gate; each release |
| **Sync convergence test** (out-of-order event delivery → identical merged result) | OBJ-03, NFR-016…018 | P2 gate; each release thereafter |
| **Dual-scorer divergence test** (seeded disagreements surface and never silently merge) | OBJ-03, FR-116…119 | P2 gate |
| **Cross-platform contract tests** (shared scoring-core cases run on Web + Android) | OBJ-06, NFR-047/048 | Every build |
| **Accessibility audit** (WCAG 2.2 AA, keyboard, screen reader, contrast, one-handed) | OBJ-11, NFR-037…042 | Pre-pilot; pre-GA; on major UI change |
| **Usability testing with real scorers** (guided first match; live-match observation; SUS) | OBJ-08, NFR-040/041 | Pre-pilot; recurring during pilot |
| **Performance budget checks** (input latency, cold start, chart render, battery) | OBJ-08, NFR-001…007 | Every build on target hardware |
| **Security review** (RLS/role enforcement, audit immutability, share-link safety, Android local-data exposure) | OBJ-07, NFR-023…030 | Pre-pilot; pre-GA; on auth/permission change |
| **Interoperability check** (Cricsheet schema validation + round-trip) | OBJ-09, NFR-050…052 | Each export/import change |
| **Availability & load tests** (concurrent live matches + viewer fan-out, graceful degradation) | OBJ-10, NFR-013/020/021 | Pre-beta; pre-GA |

## 4.4 Feedback loop (Build → Verify → Feedback → Improve)

- **In-app feedback** on every scorecard and after sign-off ("was anything wrong or hard?").
- **Post-match scorer debrief** during the pilot — short structured form per match (errors, time pressure points, guardrail friction, missing cases).
- **Privacy-respecting telemetry** (opt-outable): time-per-delivery distribution, undo/correction rate, override rate per guardrail, sync duration, crash/recovery events, offline-duration per match. Feeds NFR-001/006/009 evidence.
- **Discrepancy log** — every reconciliation override and its reason, reviewed weekly against `cricket-rules-reference.md` (rules gaps become spec changes).
- **Triage cadence** — weekly during pilot: bugs → owning agent (backend/web/android); rules ambiguities → product-spec + accredited-scorer review; architecture concerns → architecture agent.
- **Rules-reference is living** — any confirmed edge case not covered adds a `CSR-` entry and a conformance-suite case before the fix ships.

## 4.5 Launch readiness checklist (pre-GA)

**Legal / compliance**
- DLS licence/permission cleared, or the swappable fallback formally accepted (SPK-01, NFR-034).
- MCC permission obtained for any reproduced Laws/help text, or all such text paraphrased (SPK-06, NFR-035).
- Privacy policy, terms, and data-processing basis published; export & erasure flows working (NFR-032, FR-010/011).
- Minors' data handling reviewed for target jurisdictions (NFR-033).
- Google Play listing approved; web app hosting and PWA install verified.

**Operational readiness**
- Monitoring, alerting and sync-backlog dashboards live; on-call rota defined (NFR-055, ADM-106).
- Backup and restore verified by an actual restore drill (ADM-110).
- Staged rollout + feature flags + release rollback tested (ADM-104/114).
- Support impersonation gated by consent + audit (NFR-028, ADM-107).
- Incident runbook and status/maintenance banner mechanism in place (ADM-111).
- Rate limiting / abuse protection active on public + API endpoints (NFR-030).

**Product readiness**
- All `M · P1` and shipped `P2` requirement IDs traced to a verified spec with passing acceptance criteria.
- Conformance suite 100%; parity matrix ≥ 95%; accessibility audit clean on core flows.
- Scorer quick-start, admin guide, and `cricket-rules-reference.md` published and versioned.
- Data export (PDF/CSV/Cricsheet) and local backup/restore working offline (FR-171…181).

**Data readiness**
- Stable external identifiers frozen and documented (NFR-052, FR-179).
- Retention policy configured; account-deletion anonymisation of audit actors verified (BR-025).

## 4.6 Metrics & instrumentation plan

Each Foundation success criterion gets one owned metric and a data source.

| Success criterion | Metric | Source | Target |
|---|---|---|---|
| Scoring correctness | Conformance-suite pass rate | CI | 100% |
| DLS accuracy | Max deviation vs reference across benchmark set | DLS test job | ≤ published rounding tolerance |
| Card reconciliation | % signed-off matches with zero discrepancy (no override) | Backend audit | ≥ 99% |
| Offline reliability | Events lost per chaos-test run | Chaos harness | 0 |
| Sync | p95 sync duration, full offline T20 | Telemetry | ≤ 30 s on 3G-class |
| Sync determinism | % out-of-order replays producing identical merge | Sync test job | 100% |
| Speed of entry | Median interactions per normal delivery; median time-per-delivery | Telemetry | ≤ 2; keeps pace with live play |
| First-use success | Guided-match task completion; unrecoverable-error rate | Usability sessions | ≥ 95%; 0 |
| Satisfaction | SUS score; "would choose over current method" % | Pilot survey | ≥ 80; ≥ 80% |
| Adoption | Clubs onboarded; complete matches scored | Backend | ≥ 5; ≥ 100 / season |
| Error rate vs paper | Scorer-reported errors per match | Debrief form | ≤ paper baseline |
| Availability | Monthly uptime of online services | Monitoring | ≥ 99.5% |
| Viewer freshness | p95 live-link update lag | Telemetry | < 10 s |
| Accessibility | WCAG 2.2 AA issues on core flows | Audit | 0 blocking |
| Parity | Scoring-core parity matrix score | Contract tests | ≥ 95% |
| Portability | Cricsheet round-trip material differences | Export test | 0 |
| Trust | % matches with complete first-ball-to-signoff audit trail | Backend | 100% |

**Instrumentation principles:** opt-outable, no PII in telemetry, aggregate-only dashboards, and every metric above must be observable before the stage whose gate depends on it.

## 4.7 Contingency / rollback

- **Backend degraded or unavailable:** clients stay in offline-first mode; scoring, sign-off, and local export continue; publish/notify queue and drain on recovery (NFR-014, OFR-018/019).
- **DLS blocked (SPK-01):** ship with manual-target entry only; par/revised-target UI hidden behind a flag until cleared.
- **Dual-scorer (P2) slips:** single sign-off + counter-signature covers pilot integrity; event-log foundation from SPK-02 keeps the door open.
- **Bad release:** feature-flag off or staged-rollback (ADM-114); local unsynced data survives client downgrade (AND-019, OFR-024).
- **Reference-data error (DLS table / template):** central hot-fix without a client release; in-progress matches keep their started version (BR-045).

## 4.8 Documentation & training deliverables (Deliver artefacts)

- `cricket-rules-reference.md` — the single source of truth (also the conformance-suite oracle).
- Scorer quick-start (one match, start to sign-off) + offline/recovery guide.
- Dual-scorer reconciliation guide *(P2)*.
- Organization admin guide (onboarding, registry, competitions, disputes).
- Data & portability note (what exports contain, ID stability, round-trip caveats).
- Release notes per stage, mapped to requirement IDs.

---
---

# Summary of what this discovery produced

| Artefact | IDs | Count |
|---|---|---|
| Personas | PER-01…13 | 13 |
| Jobs-to-be-done | JTBD-01…25 | 25 |
| User journeys | JRN-01…16 | 16 |
| Epics / user stories | EP-01…15 / US-001…140 | 15 / ~95 |
| Functional requirements | FR-001…190 | ~130 |
| Non-functional requirements | NFR-001…059 | 59 |
| Business rules | BR-001…045 | 45 |
| Cricket scoring requirements | CSR-001…060 | 60 |
| Online requirements | ONR-001…022 | 22 |
| Offline requirements | OFR-001…024 | 24 |
| Web requirements | WEB-001…022 | 22 |
| Android requirements | AND-001…024 | 24 |
| Administrator requirements | ADM-001…020, ADM-101…114 | 34 |
| Scorer requirements | SCR-001…035 | 35 |
| Captain/Team requirements | CTR-001…020 | 20 |
| Viewer requirements | VWR-001…022 | 22 |
| Spikes | SPK-01…06 | 6 |
| New open questions | Q-D1…D6 | 6 |

**4Ds status:** Describe ✅ · Decompose ✅ · Develop = prioritised, traced, spec-backlog mapped, sequenced, spikes identified (no implementation) · Deliver = release phases, pilot gates, verification plan, feedback loop, launch checklist, metrics (no implementation).

**Blocking before spec work starts:** SPK-01 (DLS licensing), SPK-05 (interchange format), and Foundation questions A1/A2/B5–B8/D16/E22. Everything else can proceed in parallel once `cricket-rules-reference.md` is drafted.

**Recommended next step:** resolve the blocking questions, then have the `product-spec` agent produce `docs/specs/cricket-rules-reference.md` first, followed by `live-scoring.md`, `innings-and-match-state.md`, and `corrections-audit-signoff.md` — the P1 critical path.
