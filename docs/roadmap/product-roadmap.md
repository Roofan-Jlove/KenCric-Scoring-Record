# Cricket Scoring Book — Product Roadmap

| | |
|---|---|
| **Document** | Product Roadmap |
| **Version** | 0.1.0 (Draft — for review) |
| **Date** | 2026-09-02 |
| **Upstream** | `docs/foundation/product-foundation.md` v0.1.0 · `docs/discovery/product-discovery.md` v0.1.0 · `docs/domain/domain-model.md` v0.1.0 · `docs/specs/cricket-rules-reference.md` v0.1.0 |
| **Downstream** | `docs/specs/*` feature specs · `docs/architecture/*` |
| **Status** | Planning artefact only. **No code, no implementation, no technical design.** Sequencing, scope boundaries and gates only. |

> **Note on the SRS.** The consolidated Software Requirements Specification now exists at [`docs/specs/software-requirements-specification.md`](../specs/software-requirements-specification.md) v0.1.0 (`FR-001…168`, `DR-01…36`, `BR-001…034`, `NFR-001…045`, `SEC-001…018`, `OFF-001…022`, `SYNC-001…016`, `AUD-001…015`). This roadmap was built from the same four upstream documents the SRS consolidates; its SRS IDs are the canonical reference and supersede the raw discovery IDs cited in this roadmap. The roadmap buckets are unchanged.

---

## How to read this roadmap

### Release buckets

| Bucket | Intent | Maps to discovery phase | Maps to release stage (`discovery §4.1`) | Audience |
|---|---|---|---|---|
| **MVP** | The smallest slice that scores one complete, official limited-overs match end to end, offline, and produces a filed scorecard. | Strict subset of **P1** | **Alpha (internal)** | Team + 1–2 friendly scorers |
| **Version 1** | The full pilot product: everything a real club/league needs to adopt it as their scoring method for a season. | Remainder of **P1** | **Closed pilot** | ≥ 5 clubs/leagues |
| **Version 2** | Multi-scorer integrity, competitions, and the connected ecosystem. | **P2** | **Open beta → GA** | Public sign-up |
| **Future** | Multi-day cricket, advanced analytics, deep integrations. | **P3** | **Post-GA** | All |

### Priority within a bucket (MoSCoW)

- **Must** — the bucket does not ship / is not usable without it.
- **Should** — expected in the bucket; can slip to the next point release without breaking the workflow.
- **Could** — included if capacity allows; first to be cut.
- **Won't (this bucket)** — explicitly deferred to a named later bucket. Nothing is silently dropped.

### Trace notation

Every feature cites its origin IDs: `FR-*` / `NFR-*` / `BR-*` (discovery), `CSR-*` (cricket scoring reqs), `OBJ-*` (foundation objectives), `SPK-*` (spikes), `Q-D*` / `A–F` (open questions). No roadmap item is invented here; anything marked *(derived)* is a consolidation of the cited IDs for planning purposes.

---

## 1. Feature map

Sixteen capability areas (A–P), mirroring `discovery §2.2`. Each feature carries **Bucket · MoSCoW · Trace**.

### A. Accounts, Identity & Tenancy

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Anonymous device-local scoring, no sign-up | **MVP · Must** | FR-001 · OBJ-02 |
| Cached authenticated session for offline use | **MVP · Must** (login screen present, cloud optional) | FR-003 · OBJ-02 |
| Email account creation & sign-in | **V1 · Must** | FR-002 · OBJ-10 |
| Claim/upload a local guest match after sign-in | **V1 · Must** | FR-004 · OBJ-09 |
| Organizations (tenants) own teams/competitions/matches | **V1 · Must** | FR-005 · OBJ-10 |
| User in multiple orgs with distinct roles | **V1 · Must** | FR-006 · OBJ-10 |
| Role assignment / revocation within an org | **V1 · Must** | FR-007 · OBJ-10 |
| Email invitations with pre-assigned role + expiry | **V1 · Should** | FR-008 · OBJ-10 |
| Deactivate a member without deleting authored history | **V1 · Must** | FR-009 · BR-024 · OBJ-07 |
| User-initiated export of all personal data | **V1 · Must** | FR-010 · NFR-032 · OBJ-09 |
| Account deletion with defined handling of authored matches | **V1 · Must** | FR-011 · BR-025 · OBJ-09 |
| Password reset & session revocation | **V1 · Must** | FR-012 · OBJ-10 |
| Actor identity recorded for every write | **MVP · Must** | FR-013 · BR-003 · OBJ-07 |
| Guardian-consented accounts / restricted minor profiles | **V2 · Should** | FR-014 · NFR-033 · OBJ-11 |
| Org-level API keys for data access | **V2 · Could** | FR-015 · OBJ-09 |

### B. Match Setup & Configuration

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Ad-hoc match with fully custom limited-overs conditions | **MVP · Must** | FR-017 · OBJ-01 |
| Format config: T20 / ODI-List A / T10 / The Hundred / custom overs | **MVP · Must** | FR-018 · CSR-001…004 · OBJ-01 |
| Overs per innings, powerplay blocks, fielding-restriction rules | **MVP · Must** | FR-020 · CSR-005 · OBJ-01 |
| Per-bowler over limits | **MVP · Must** | FR-021 · OBJ-01 |
| Tie-breaker rule selection (Super Over / repeat / boundary count-back / none) | **MVP · Must** (config value) | FR-022 · OBJ-01 |
| Record toss winner + elected decision → derive innings order | **MVP · Must** | FR-024 · BR-026 · OBJ-01 |
| Venue, date, scheduled start, time zone | **MVP · Must** | FR-025 · NFR-059 · OBJ-05 |
| Minimum overs for a valid result | **MVP · Must** | FR-029 · CSR-043 · OBJ-04 |
| Setup completeness validation before scoring is enabled | **MVP · Must** | FR-027 · BR-002 · OBJ-01 |
| Create a match from a competition / playing-condition template | **V1 · Must** | FR-016 · OBJ-01 |
| Save a match setup as a reusable named template | **V1 · Should** | FR-028 · OBJ-08 |
| Record match officials (umpires, scorers, referee) | **V1 · Should** | FR-026 · OBJ-07 |
| Ball type/brand and new-ball rules | **V2 · Should** | FR-023 · OBJ-05 |
| Points / bonus-points / NRR rules at competition level | **V2 · Should** | FR-030 · OBJ-04 |
| Multi-day / first-class format (2 innings/side, sessions) | **Future · Should** | FR-019 · OBJ-01 |

### C. Squads, Lineups & Roles

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Team squad list with names + basic details | **MVP · Must** | FR-031 · OBJ-10 |
| Select playing XI (or configured size) per side | **MVP · Must** | FR-032 · OBJ-01 |
| Mark captain and wicket-keeper per side | **MVP · Must** | FR-033 · OBJ-01 |
| Add an ad-hoc player during setup | **MVP · Must** | FR-034 · OBJ-08 |
| Validate XI: count, exactly one keeper, one captain | **MVP · Must** | FR-035 · BR-009…011 · OBJ-01 |
| Nominate a substitute-fielder pool | **MVP · Should** | FR-036 · OBJ-01 |
| Nominate a concussion-substitute pool | **V2 · Should** | FR-037 · BR-013 · OBJ-01 |
| Org-level canonical player registry | **V2 · Should** | FR-039 · OBJ-10 |
| Merge duplicate player records, re-point appearances | **V2 · Should** | FR-040 · BR-044 · OBJ-09 |
| Submit XI against a fixture with a deadline | **V2 · Should** | FR-041 · OBJ-10 |
| Lock lineup at deadline; log post-deadline changes | **V2 · Should** | FR-042 · OBJ-07 |
| Impact / replacement-player pool | **Future · Could** | FR-038 · OBJ-01 |

### D. Live Ball-by-Ball Scoring *(core domain — `CTX-SCORING`)*

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Set opening striker / non-striker / bowler | **MVP · Must** | FR-043 · OBJ-01 |
| Runs off the bat (0–6+) | **MVP · Must** | FR-044 · CSR-009…011 · OBJ-01 |
| Wide + associated runs | **MVP · Must** | FR-045 · CSR-013 · OBJ-01 |
| No-ball + runs off bat/byes + free-hit state where configured | **MVP · Must** | FR-046 · CSR-012 · CSR-017 · OBJ-01 |
| Byes and leg-byes with runs | **MVP · Must** | FR-047 · CSR-014…015 · OBJ-01 |
| Penalty runs (5) to either side with a reason | **MVP · Must** | FR-048 · CSR-016 · BR-036 · OBJ-01 |
| Boundary 4 / 6 incl. all-run and overthrow boundaries | **MVP · Must** | FR-049 · CSR-011 · OBJ-01 |
| Overthrows adding runs to a delivery | **MVP · Must** | FR-050 · OBJ-01 |
| Every dismissal mode (bowled, caught, LBW, run out, stumped, hit wicket, obstructing, hit ball twice, timed out, retired out) | **MVP · Must** | FR-051 · CSR-018…028 · OBJ-01 |
| Dismissal detail: out batter, who crossed, fielder(s), bowler credit | **MVP · Must** | FR-052 · BR-030 · OBJ-01 |
| Retired–not out (hurt/ill) and later resumption | **MVP · Must** | FR-053 · BR-031 · OBJ-01 |
| Automatic strike rotation on odd runs and end of over | **MVP · Must** | FR-054 · CSR-006 · OBJ-01 |
| Count legal deliveries; complete an over at 6 legal balls | **MVP · Must** | FR-055 · CSR-005 · OBJ-01 |
| Prompt for a new bowler at each over start | **MVP · Must** | FR-056 · OBJ-01 |
| Warn/block a bowler bowling consecutive overs | **MVP · Must** | FR-057 · BR-027 · OBJ-01 |
| Warn/block a bowler exceeding the over limit | **MVP · Must** | FR-058 · BR-028 · OBJ-01 |
| Explicit override of any guardrail with a recorded reason | **MVP · Must** | FR-059 · OBJ-07 |
| Undo the last recorded action instantly | **MVP · Must** | FR-061 · OBJ-08 |
| Persistent live-state panel (striker/non-striker/bowler, over.ball, score/wkts, extras, RR, RRR, req, balls left, target, DLS par) | **MVP · Must** (DLS-par field hidden until V1) | FR-065 · OBJ-08 |
| Substitute fielder takes the field + dismissal attribution | **MVP · Should** | FR-060 · BR-012 · OBJ-01 |
| Redo an undone action | **MVP · Should** | FR-062 · OBJ-08 |
| End-of-over checkpoint summary | **MVP · Should** | FR-063 · OBJ-07 |
| Record drinks breaks / stoppages with timestamps | **MVP · Should** | FR-066 · OBJ-04 |
| Mankad / run-out at non-striker's end before delivery | **V1 · Should** | FR-071 · CSR-023 · OBJ-01 |
| Attach free-text commentary/notes to any delivery | **V1 · Should** | FR-064 · OBJ-05 |
| Dead-ball with reason | **V1 · Should** | FR-070 · OBJ-01 |
| "Penalty, ball not counted" vs "penalty + delivery" distinction | **V1 · Should** | FR-069 · OBJ-01 |
| Record a new ball being taken | **V2 · Should** | FR-068 · OBJ-05 |
| Wicket-keeper change mid-innings + effect on dismissal options | **V2 · Could** | FR-067 · OBJ-01 |
| Last-man-stands / one-short calls where config allows | **Future · Could** | FR-072 · OBJ-01 |

### E. Innings & Match State

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Auto-end innings on overs complete | **MVP · Must** | FR-073 · BR-029 · OBJ-01 |
| Auto-end innings when all out (configurable wickets) | **MVP · Must** | FR-074 · BR-029 · OBJ-01 |
| Auto-end the chase when target reached/passed | **MVP · Must** | FR-075 · BR-018 · OBJ-01 |
| Match interruptions with start/end time + reason | **MVP · Must** | FR-078 · OBJ-04 |
| Reduce overs for one/both innings mid-match | **MVP · Must** | FR-079 · CSR-047 · OBJ-01 |
| Target = opposition total + 1 (manual DLS-revised entry in MVP) | **MVP · Must** | FR-080 · BR-017 · OBJ-04 |
| Result type: win by runs/wkts, tie, no result, abandoned, awarded, conceded | **MVP · Must** | FR-081 · CSR-037…041 · OBJ-04 |
| Margin (runs / wickets / balls remaining) per result type | **MVP · Must** | FR-082 · OBJ-04 |
| Match state machine (Scheduled → Ready → In progress → Innings break → … → Final / Abandoned) | **MVP · Must** | FR-085 · `SM-MATCH` · OBJ-01 |
| Over-rate / time penalties affecting the result | **V2 · Could** | FR-083 · OBJ-04 |
| Innings declaration (multi-day) | **Future · Should** | FR-076 · CSR (DECL) · OBJ-01 |
| Innings forfeiture | **Future · Could** | FR-077 · OBJ-01 |
| Follow-on decision + enforcement (multi-day) | **Future · Should** | FR-084 · CSR (FLW) · OBJ-01 |

### F. Rain, DLS & Reduced Overs

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Manual target / known-target entry with recorded reason | **MVP · Must** | FR-090 · B6 · OBJ-04 |
| Abandoned-match result from last valid ball, subject to minimum-overs rules (manual par input in MVP) | **MVP · Must** | FR-091 · CSR-043 · BR-019 · OBJ-04 |
| Enter overs lost / revised overs → compute DLS revised target | **V1 · Must** *(blocked by SPK-01; fallback = stays MVP-manual)* | FR-086 · NFR-034 · SPK-01 · OBJ-04 |
| Live DLS par score + over-by-over par | **V1 · Must** *(SPK-01)* | FR-087 · OBJ-04 |
| Recompute par/target on each interruption | **V1 · Must** *(SPK-01)* | FR-088 · OBJ-04 |
| Version every DLS revision (inputs, timestamp, actor) | **V1 · Must** | FR-089 · BR-020 · AUD · OBJ-07 |
| All DLS calculations function fully offline | **V1 · Must** | FR-092 · NFR-012 · OBJ-02 |
| Show DLS calculation breakdown for audit/explanation | **V1 · Should** | FR-094 · OBJ-07 |
| Pluggable rain-method interface (DLS Standard now; others later) | **V2 · Should** | FR-093 · OBJ-01 |
| Alternative rain methods (Professional Edition, VJD) | **Future · Won't (V2)** | FR-093 note · foundation §7 |

### G. Tie-breakers / Super Over

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Record a tie result; capture a manually-scored Super Over as a separate short innings pair | **MVP · Should** *(workaround acceptable for Alpha — Q-D1)* | FR-081 · Q-D1 |
| Native Super Over workflow: nominate 3 batters + 1 bowler/side, 2-wkt max, 1 over each | **V1 · Must** | FR-095 · CSR-052…054 · OBJ-01 |
| Repeated Super Overs until a result | **V1 · Must** | FR-096 · CSR-055 · OBJ-01 |
| Configurable legacy boundary count-back fallback | **V1 · Should** | FR-097 · BR-042 · OBJ-01 |
| Super Over stats carried separately from main-match stats | **V1 · Must** | FR-098 · BR-043 · OBJ-05 |
| Correct batting-order rule (loser of toss / previous Super Over chooses) | **V2 · Should** | FR-099 · OBJ-01 |

### H. Corrections, Audit & Sign-off

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Navigate to any prior delivery via over/ball or timeline search | **MVP · Must** | FR-100 · OBJ-07 |
| Correct any field of any prior delivery | **MVP · Must** | FR-101 · OBJ-01 |
| Original event preserved; corrections are superseding events, never destructive | **MVP · Must** | FR-102 · BR-004 · `EVT-*Corrected` · OBJ-07 |
| Recompute all derived figures after a correction (cascade) | **MVP · Must** | FR-103 · `SVC-CASCADE-RECOMPUTER` · OBJ-04 |
| Reconciliation check (runs = Σ batter + extras; balls ↔ overs; wickets ≤ max) | **MVP · Must** | FR-104 · BR-037 · `INV-001…018` · OBJ-07 |
| Block sign-off on unresolved reconciliation failure unless overridden with reason | **MVP · Must** | FR-105 · BR-007 · OBJ-07 |
| Head-scorer sign-off transitions the match to Final | **MVP · Must** | FR-106 · BR-005 · `SM-MATCH` · OBJ-07 |
| Elevated permission + reason + re-sign-off for post-Final corrections; prior Final retained | **MVP · Must** | FR-108 · BR-006 · OBJ-07 |
| Append-only, tamper-evident audit trail of all events + corrections | **MVP · Must** | FR-109 · NFR-025 · OBJ-07 |
| Human-readable audit view (who / what / when / before → after) | **MVP · Must** | FR-110 · `QRY-AUDIT-TRAIL` · OBJ-07 |
| Record device + app version with each event | **MVP · Should** | FR-111 · `VO-PROVENANCE` · OBJ-07 |
| Counter-signature by assistant scorer and/or umpire | **V2 · Should** *(Q-D3)* | FR-107 · OBJ-07 |
| Organizer/admin lock a match pending dispute + record adjudication | **V2 · Should** | FR-112 · BR-023 · OBJ-07 |

### I. Dual-Scorer Reconciliation *(entire area is V2 — `discovery §3.1`)*

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Assign two or more scorers to one match | **V2 · Must** | FR-113 · OBJ-03 |
| Each scorer keeps an independent ball log for the same match | **V2 · Must** | FR-114 · OBJ-03 |
| Exchange event logs between scorer devices when connectivity allows | **V2 · Must** | FR-115 · SYNC · OBJ-03 |
| Align logs by over/ball; flag any delivery where runs/extras/wicket/striker differ | **V2 · Must** | FR-116 · `SVC-DIVERGENCE-DETECTOR` · OBJ-03 |
| Divergence list with per-ball comparison | **V2 · Must** | FR-117 · OBJ-03 |
| Propose an agreed version; the other scorer must confirm before it applies | **V2 · Must** | FR-118 · BR-008 · OBJ-03 |
| Never silently overwrite one scorer's entry with another's | **V2 · Must** | FR-119 · NFR-017 · MINV-14 · OBJ-03 |
| Block sign-off while unresolved divergences remain (override = reason + dual attestation) | **V2 · Must** | FR-120 · BR-008 · OBJ-07 |

### J. Scorecards, Analytics & Commentary

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Full scorecard (batting card, bowling card, extras, total, result) | **MVP · Must** | FR-121 · CSR (SCRD) · OBJ-05 |
| Linear / ball-by-ball scoresheet | **MVP · Must** | FR-122 · OBJ-05 |
| Bowling analysis (overs, maidens, runs, wickets, economy, spells) | **MVP · Must** | FR-123 · OBJ-05 |
| Fall-of-wickets list (score, wkt no., batter, over) | **MVP · Must** | FR-124 · CSR-029 · OBJ-05 |
| Over-by-over summary | **MVP · Must** | FR-125 · OBJ-05 |
| Partnerships (runs, balls, contribution) per wicket | **MVP · Must** | FR-126 · CSR-030 · OBJ-05 |
| Milestone flags (fifties, hundreds, 5-fors, hat-tricks) | **MVP · Should** | FR-129 · CSR-031 · `SVC-MILESTONE-DETECTOR` · OBJ-05 |
| Batting metrics (SR, boundary %, dot %) | **V1 · Should** | FR-127 · OBJ-05 |
| Bowling metrics (economy, SR, average, dot %) | **V1 · Should** | FR-128 · OBJ-05 |
| Manhattan (runs per over) chart | **V1 · Should** | FR-130 · OBJ-05 |
| Worm / cumulative-runs comparison chart | **V1 · Should** | FR-131 · OBJ-05 |
| Run-rate vs required-run-rate chart | **V1 · Should** | FR-132 · OBJ-05 |
| Partnership bar chart | **V1 · Should** | FR-133 · OBJ-05 |
| Ball-by-ball commentary feed | **V1 · Should** | FR-136 · CSR (CMTRY) · OBJ-05 |
| Match / session / day notes | **V1 · Should** | FR-137 · OBJ-05 |
| Live spectator-facing scorecard render | **V1 · Must** (needs sharing, area M) | FR-138 · OBJ-05 |
| Wagon-wheel shot coordinates (manual entry + render) | **V2 · Could** *(Q-D4)* | FR-134 · OBJ-05 |
| Pitch-map / beehive line-length data (manual entry + render) | **Future · Could** | FR-135 · OBJ-05 |

### K. Competitions, Fixtures & Standings *(area is V2 — `discovery §3.1`)*

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Create a competition/season with format + condition template | **V2 · Must** | FR-139 · OBJ-10 |
| Organise teams into divisions/groups | **V2 · Should** | FR-140 · OBJ-10 |
| Generate round-robin / knockout fixture list | **V2 · Should** | FR-141 · OBJ-10 |
| Assign scorers to fixtures | **V2 · Should** | FR-143 · OBJ-10 |
| Ingest signed-off results into the competition automatically | **V2 · Must** | FR-144 · BR-021 · OBJ-10 |
| Compute standings from a configurable points model | **V2 · Must** | FR-145 · CSR-057 · OBJ-04 |
| Compute Net Run Rate per competition rules | **V2 · Must** | FR-146 · CSR-058 · BR-039 · OBJ-04 |
| Compute bonus points per competition rules | **V2 · Should** | FR-147 · BR-040 · OBJ-04 |
| Import a fixture list from a file | **V2 · Could** | FR-142 · OBJ-09 |
| Record disciplinary / penalty entries against a match or team | **V2 · Could** | FR-149 · OBJ-07 |
| Publish a public competition page (fixtures, results, standings) | **V2 · Should** | FR-150 · OBJ-05 |
| Knockout brackets and progression | **Future · Could** | FR-148 · OBJ-10 |

### L. Profiles, Stats, History & Search

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Search matches by team, competition, venue, date, player | **MVP · Should** | FR-157 · OBJ-05 |
| Browse a chronological match history per team/competition | **MVP · Should** | FR-158 · OBJ-05 |
| Player profiles with photo + basic bio | **V2 · Should** | FR-151 · OBJ-10 |
| Player claims/links appearances, subject to approval | **V2 · Should** | FR-152 · BR-014 · OBJ-07 |
| Career aggregates from verified matches only | **V2 · Should** | FR-153 · BR-015 · OBJ-05 |
| Team aggregates and records | **V2 · Should** | FR-154 · OBJ-05 |
| Filter a match's ball-by-ball data by phase / bowler / batter / partnership | **V2 · Should** | FR-159 · OBJ-05 |
| Head-to-head (player vs player, team vs team) | **V2 · Could** | FR-155 · OBJ-05 |
| Recent-form summaries for a squad | **V2 · Could** | FR-156 · OBJ-05 |
| Record lists (highest totals, best figures) per scope | **Future · Could** | FR-160 · OBJ-05 |

### M. Sharing, Notifications & Viewer Access

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Generate a shareable read-only link for a live or final match | **V1 · Must** | FR-161 · SEC · OBJ-05 |
| View via link with no account and no install (web) | **V1 · Must** | FR-162 · OBJ-05 |
| Viewer card updates in near real time while the source is online | **V1 · Must** | FR-163 · OBJ-05 |
| "Last updated X ago" + offline indicator when the source is disconnected | **V1 · Must** | FR-164 · OBJ-07 |
| Unguessable, revocable share links | **V1 · Must** | NFR-029 · SEC · OBJ-07 |
| Viewer follows a match for wicket/innings/result alerts | **V2 · Should** | FR-165 · OBJ-05 |
| Notify assigned teams/captains when a result is posted | **V2 · Should** *(Q-D6)* | FR-166 · OBJ-05 |
| Notify scorers of assignment, XI submission, deadlines | **V2 · Could** | FR-167 · OBJ-10 |
| Push notifications on Android + web push where available | **V2 · Should** | FR-168 · OBJ-05 |
| Embeddable scorecard widget | **Future · Could** | FR-169 · OBJ-05 |
| Share a specific moment (e.g. a wicket) as a deep link | **Future · Could** | FR-170 · OBJ-05 |

### N. Import, Export, API & Backup

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Export a scorecard as PDF (offline) | **MVP · Must** | FR-172 · FR-174 · OBJ-09 |
| Export match/innings data as CSV (offline) | **MVP · Must** | FR-173 · FR-174 · OBJ-09 |
| Create a local backup file of one or more matches | **MVP · Should** | FR-180 · OBJ-02 |
| Restore matches from a local backup file | **MVP · Should** | FR-181 · OBJ-02 |
| Export a match as a Cricsheet-compatible JSON/YAML document | **V1 · Should** *(blocked by SPK-05)* | FR-171 · NFR-050 · SPK-05 · OBJ-09 |
| Apply org branding (name, logo, colours) to exported outputs | **V1 · Should** | FR-182 · OBJ-05 |
| Import a match from a Cricsheet-compatible document | **V2 · Could** | FR-175 · OBJ-09 |
| Export → import round-trip fidelity for supported fields | **V2 · Should** | FR-176 · NFR-051 · OBJ-09 |
| Read-only REST API for matches, competitions, profiles | **V2 · Could** | FR-177 · OBJ-09 |
| Real-time subscription channel for live match updates | **V2 · Could** | FR-178 · OBJ-05 |
| Stable, documented external identifiers | **V2 · Should** | FR-179 · NFR-052 · OBJ-09 |

### O. Settings, Localization & Preferences

| Feature | Bucket · MoSCoW | Trace |
|---|---|---|
| Keep the screen awake while actively scoring | **MVP · Must** | FR-190 · OBJ-08 |
| High-contrast / large-text / sunlight mode for scoring | **MVP · Should** | FR-185 · NFR-042 · OBJ-11 |
| Date/time format + match time zone | **MVP · Must** | FR-184 · NFR-059 · OBJ-11 |
| Scoring input preferences (button layout, confirmations, haptics) | **MVP · Should** | FR-186 · OBJ-08 |
| Manage local storage: usage, purge synced matches, retention | **MVP · Should** | FR-188 · OBJ-02 |
| Default competition/condition template for new matches | **V1 · Should** | FR-187 · OBJ-08 |
| Interface language (English at launch; framework for more) | **V1 · Should** | FR-183 · NFR-057 · OBJ-11 |
| Notification preferences per channel + event type | **V2 · Should** | FR-189 · OBJ-05 |

### P. Platform, Cross-cutting NFRs & Administration

| Capability | Bucket · MoSCoW | Trace |
|---|---|---|
| Offline-first: no connectivity required for any part of scoring, setup → sign-off | **MVP · Must** | NFR-012 · OFR-001…024 · OBJ-02 |
| Every scoring event persisted durably before the UI confirms it | **MVP · Must** | NFR-010 · OBJ-02 |
| Crash recovery: relaunch resumes at exact last confirmed state | **MVP · Must** | NFR-011 · OBJ-02 |
| Zero ball-events lost across the defined chaos test (≥ 50 innings) | **MVP · Must** | NFR-009 · SPK-03 · OBJ-02 |
| ≤ 2 interactions per normal delivery; ≤ 100 ms input acknowledgement | **MVP · Must** | NFR-001 · NFR-002 · OBJ-08 |
| One scorer keeps pace with live play, any supported format, no backlog | **MVP · Must** | NFR-003 · OBJ-08 |
| App cold-start to "ready to score" ≤ 3 s on target hardware | **MVP · Should** | NFR-005 · OBJ-08 |
| Deterministic, replayable scoring engine from its event log | **MVP · Must** | NFR-054 · SPK-02 · OBJ-01 |
| Versioned cricket-rules conformance suite (must pass 100% to release) | **MVP · Must** | NFR-053 · OBJ-01 |
| Android 10+ mid-range support; small→large phones; basic tablet | **MVP (Android) · Must** | NFR-044 · OBJ-06 |
| Installable PWA that works offline (web) | **MVP (Web) · Must** | NFR-046 · OBJ-02 |
| All network traffic uses transport encryption | **MVP · Must** | NFR-023 · SEC · OBJ-07 |
| Only Head/Assistant Scorer roles can write deliveries | **MVP · Must** | NFR-026 · BR-003 · SEC · OBJ-07 |
| All destructive actions confirmable and/or reversible | **MVP · Must** | NFR-043 · OBJ-07 |
| Match timestamps stored unambiguously; displayed in match time zone | **MVP · Must** | NFR-059 · OBJ-11 |
| Local data at rest on device protected (OS-level encryption assumed) | **MVP · Should** | NFR-027 · SEC · OBJ-07 |
| Battery lasts a full day's play (≥ 8 h intermittent), screen dimmed | **MVP · Should** | NFR-007 · OBJ-02 |
| Full scorecard + standard charts render ≤ 1 s for a completed T20 | **V1 · Should** | NFR-004 · OBJ-05 |
| Access enforced by role at the data layer (client cannot act outside permissions) | **V1 · Must** | NFR-024 · SEC · OBJ-07 |
| Tenant data isolation + additive RBAC across orgs | **V1 · Must** | NFR-020…022 · ADM-001…020 · OBJ-10 |
| Core web scoring + scorecard flows meet WCAG 2.2 AA | **V1 · Must** | NFR-037 · OBJ-11 |
| Data-protection compliance (GDPR-class): export + erasure | **V1 · Must** | NFR-032 · OBJ-09 |
| DLS used under an appropriate licence; method swappable | **V1 · Must** *(SPK-01)* | NFR-034 · OBJ-01 |
| Laws implemented as logic and cited, not reproduced verbatim without permission | **V1 · Must** *(SPK-06)* | NFR-035 · OBJ-01 |
| Central reference-data updates (DLS tables, templates) without a client release | **V1 · Should** | NFR-056 · BR-045 · OBJ-01 |
| Cross-platform parity: identical inputs → identical scoring outputs (contract-tested), ≥ 95% matrix | **V1 · Must** | NFR-047 · NFR-048 · SPK-04 · OBJ-06 |
| Full offline T20 syncs ≤ 30 s on a 3G-class connection | **V1 · Must** | NFR-006 · OBJ-03 |
| Consented + fully-logged platform-admin impersonation | **V1 · Must** | NFR-028 · ADM-107 · SEC · AUD · OBJ-07 |
| Staged rollout, feature flags, release rollback | **V1 · Should** | ADM-104 · ADM-114 · OBJ-10 |
| Deterministic sync: same event set → same merged result regardless of arrival order | **V2 · Must** | NFR-016 · SYNC · OBJ-03 |
| Conflicts always surfaced, never last-write-wins | **V2 · Must** | NFR-017 · SYNC · OBJ-03 |
| Per-device monotonic sequence + logical clock; clock-skew detection | **V2 · Must** | NFR-018 · NFR-019 · SYNC · OBJ-03 |
| Online services ≥ 99.5% monthly availability | **V2 · Should** | NFR-013 · OBJ-10 |
| Viewer fan-out degrades gracefully to periodic polling under load | **V2 · Should** | NFR-021 · OBJ-05 |
| Rate limiting + abuse protection on public + API endpoints | **V2 · Should** | NFR-030 · SEC · OBJ-10 |
| Special handling for minors' data (consent, reduced visibility) | **V2 · Should** | NFR-033 · OBJ-11 |
| Org-level operational tooling: monitoring, sync-backlog dashboards, on-call | **V2 · Should** | ADM-106 · NFR-055 · OBJ-10 |
| Backup/restore operational drill; retention policy config | **V2 · Should** | ADM-110 · BR-025 · OBJ-10 |
| Data retained locally without loss for a full multi-day match (≥ 5 days) | **Future · Should** | NFR-015 · OBJ-02 |
| Plans / quotas / cross-tenant analytics | **Future · Could** | ADM (P2 note) · OBJ-10 |

---

## 2. Feature dependencies

### 2.1 Dependency chain (build order)

```
Cricket rules reference  ─┐
Domain glossary + model  ─┼─▶  Ball-event log + provenance model (SPK-02)
                          │        │
                          │        ▼
                          │   Live ball-by-ball scoring (D)  ◀── Match setup (B) ◀── Squads/XI (C)
                          │        │                                   ▲
                          │        ▼                                   │
                          │   Innings & match-state machine (E) ───────┘
                          │        │
                          │        ├────────────▶ Corrections + cascade + audit (H)
                          │        │                     │
                          │        ▼                     ▼
                          │   Reconciliation check ─▶ Head-scorer sign-off ─▶ FINAL
                          │        │
                          │        ▼
                          │   Scorecards / linear sheet / analysis (J, tabular)
                          │        │
                          │        ├────────────▶ PDF + CSV export (N)  ══════════════▶ ◆ MVP COMPLETE
                          │        │
                          │        ├────────────▶ DLS engine (F)          ── needs: SPK-01
                          │        ├────────────▶ Analytics charts (J)
                          │        ├────────────▶ Super Over workflow (G) ── needs: E result types
                          │        ├────────────▶ Cricsheet export (N)    ── needs: SPK-05
                          │        └────────────▶ Accounts/org/RBAC (A) ─▶ Sharing/viewer (M)  ═══▶ ◆ VERSION 1 COMPLETE
                          │                                                     │
                          ▼                                                     ▼
        Offline-first strategy + shared rules-core       Deterministic sync (SYNC) ─▶ Dual-scorer reconciliation (I)
        (architecture; gates all clients; SPK-03/04)     Competitions/standings (K) ── needs: FINAL matches + stable IDs
                                                         Profiles/stats (L)         ── needs: FINAL matches + stable IDs
                                                         Notifications (M)                                      ═══▶ ◆ VERSION 2 COMPLETE
                                                                     │
                                                                     ▼
                                        Multi-day state (declaration, follow-on, sessions) — own spec pass  ═══▶ ◆ FUTURE
```

### 2.2 Dependency table

| Feature area | Hard-depends on | Soft-depends on | Blocking spike |
|---|---|---|---|
| **D. Live scoring** | Rules reference; glossary + domain model; ball-event log; B (setup); C (XI) | O (screen-awake, input prefs) | SPK-02, SPK-03 |
| **E. Innings & match state** | D (deliveries); `SM-MATCH` | F (reduced overs feeds target) | — |
| **F. DLS engine** | E (interruptions, result types) | — | **SPK-01** (blocks V1 DLS; MVP manual target is the standing fallback) |
| **G. Super Over** | E (tie result type); D (scoring primitives) | — | — |
| **H. Corrections / audit / sign-off** | D + E (events to correct); `SVC-CASCADE-RECOMPUTER` | — | SPK-02 (superseding-event model) |
| **Reconciliation + sign-off** | H; invariants `INV-001…018`, `MINV-*` | J (figures feed the check) | — |
| **J. Scorecards (tabular)** | Stable event log; D + E | H (corrections change figures) | — |
| **J. Analytics charts** | J tabular; stable event log | — | — |
| **N. PDF / CSV export** | J tabular; offline file I/O | O (branding — V1) | — |
| **N. Cricsheet export** | J tabular; interchange schema | — | **SPK-05** |
| **A. Accounts / org / RBAC** | — (independent track) | `SVC-AUTHORIZER` | A1/A2/A4 open questions; D16 (Supabase) |
| **M. Sharing / viewer** | A (a publishable, owned match); E (match model) | Realtime channel | — |
| **I. Dual-scorer reconciliation** | Ball-event log + provenance (P1 foundation); deterministic sync | A (multi-scorer assignment) | SPK-02 (foundation), then SYNC gates |
| **K. Competitions / standings** | Signed-off (FINAL) matches; stable external IDs | A (org) | B7/B8 open questions |
| **L. Profiles / stats** | FINAL matches; stable IDs; registry | A (org, claims approval) | C14 open question |
| **Multi-day (Future)** | Its own state-machine spec pass; must not complicate P1 state modelling | E | — |
| **Cross-platform parity** | Shared rules-core decision | every client feature | **SPK-04** |
| **Offline durability guarantees** | Write-ahead persistence design | D, H | **SPK-03** |

### 2.3 Spike → release gating

| Spike | Question | Gates | If unresolved |
|---|---|---|---|
| **SPK-01** | Legal basis for DLS Standard Edition | **V1** DLS features (F: FR-086…094, NFR-034) | V1 ships with MVP-manual target entry only; par/revised-target UI stays behind a flag (`discovery §4.7`) |
| **SPK-02** | Append-only per-device-sequenced ball-event log supporting P1 corrections *and* P2 merge | **MVP** correction model; **V2** dual-scorer without a rewrite | MVP correctness at risk; V2 becomes a rewrite. Highest-priority architecture spike. |
| **SPK-03** | Offline durability + crash recovery on target Android hardware | **MVP** exit gate (NFR-009…011) | No Alpha exit; MVP is not "usable" without it |
| **SPK-04** | How identical scoring behaviour is guaranteed on Web + Android | **V1** parity gate (NFR-047/048) | V1 pilot can run single-platform; parity matrix slips to V2 |
| **SPK-05** | Confirm Cricsheet-compatible interchange + lossy fields | **V1** Cricsheet export (FR-171…176) | Cricsheet export drops to V2; PDF/CSV (MVP) still satisfy portability minimum |
| **SPK-06** | MCC Laws text permission vs paraphrase | **V1** in-app rules/help text (NFR-035) | Ship paraphrased-only help text; no verbatim Law quotes |

---

## 3. MVP boundary

### 3.1 The MVP promise

> **One scorer, one device, no connectivity, can set up a limited-overs match, score every ball and every lawful event, fix mistakes, reconcile the book, sign it off, and hand both clubs a correct PDF/CSV scorecard — the same evening.**

This mirrors persona **PER-01 ("Val")** and the guiding rule from `discovery §3.1`: *a requirement is in only if a real club cannot score and file an official limited-overs match without it.* MVP tightens that further — only what's needed for **one** scorer to file **one** match.

### 3.2 In / Out

| In the MVP | Deliberately out (and why the workflow still completes) |
|---|---|
| Guest/local scoring, no account (FR-001/003/013) | **Accounts, orgs, RBAC (A)** → single-user guest device is enough to file a match; sharing/tenancy is a V1 adoption concern, not a scoring concern |
| Ad-hoc custom limited-overs setup + toss + validation (B: FR-017/018/020/021/022/024/025/027/029) | **Templates (FR-016/028)** → each match configured fresh; acceptable at 1–2 scorers |
| Squad list, XI, captain/keeper, ad-hoc player, XI validation, sub-fielder pool (C: FR-031…036) | **Registry, merge, deadlines (FR-039…042)** → not needed to score a single match |
| Full delivery/extras/dismissal/free-hit set, strike rotation, over management, guardrails + override, undo (D: FR-043…061) | **Keeper change (FR-067), new ball (FR-068), dead-ball reason (FR-070), mankad (FR-071)** → rare; guardrail override + a correction covers them until V1 |
| Interruptions, reduced overs, **manual target entry** (E/F: FR-078/079/080/090/091) | **Automated DLS par/revised target (FR-086…089)** → blocked by SPK-01; manual target is the sanctioned fallback and produces a valid, lawful result |
| All result types + margin + match state machine (E: FR-081/082/085) | **Declaration, follow-on, forfeiture (FR-076/077/084)** → multi-day only; out of limited-overs scope |
| Tie result recorded; Super Over scored manually as a separate short innings pair (G) | **Native Super Over workflow (FR-095…098)** → Q-D1 explicitly allows this as a fast-follow; a tie or manual Super Over still yields a filed result |
| Corrections as superseding events + cascade recompute + reconciliation check + block-on-failure (H: FR-100…105) | **Counter-signature (FR-107)** → Q-D3; single head-scorer sign-off is enough for an Alpha match |
| Head-scorer sign-off → FINAL; post-Final correction control (H: FR-106/108) | **Dispute lock / adjudication (FR-112)** → needs an organizer role (V1+) |
| Append-only audit log + human-readable audit view (H: FR-109/110/111) | **Dual-scorer divergence (I)** → entire area is V2 by design; MVP is single-log |
| Full scorecard, linear sheet, bowling analysis, FoW, over-by-over, partnerships, milestone flags (J tabular: FR-121…126/129) | **Charts (FR-130…133), commentary (FR-136), wagon wheel (FR-134)** → V1; tabular outputs are the officially-filed artefacts |
| PDF + CSV export, offline; local backup/restore (N: FR-172/173/174/180/181) | **Cricsheet export (FR-171)** → blocked by SPK-05; PDF/CSV satisfy the portability minimum |
| Screen-awake, sunlight/large-text mode, input prefs, time zone, local-storage management (O: FR-184/185/186/188/190) | **UI language switch (FR-183)** → English-first is an accepted assumption (foundation §9.13) |
| Offline-first everything; durable write-ahead; crash recovery; chaos-test clean; ≤ 2 taps/≤ 100 ms; conformance suite 100% (P: NFR-001/002/009…012/026/053/054) | **WCAG 2.2 AA formal audit, ≥ 99.5% availability, parity matrix** → V1 gates; Alpha runs on a small controlled platform set |

### 3.3 MVP workflow walkthrough — completeness proof

Every step maps to an in-MVP feature. No step depends on an out-of-MVP feature.

| # | Workflow step | MVP features that satisfy it |
|---|---|---|
| 1 | Create the match; pick format, overs, powerplay, per-bowler cap, minimum overs, tie-break rule | FR-017, FR-018, FR-020, FR-021, FR-022, FR-029 |
| 2 | Enter both squads; pick each XI; mark captain + keeper; add an ad-hoc player; validate | FR-031, FR-032, FR-033, FR-034, FR-035 |
| 3 | Record the toss and elected decision; system derives innings order | FR-024, BR-026 |
| 4 | Setup validation passes → scoring enabled; match state → In progress | FR-027, BR-002, FR-085 |
| 5 | Set opening striker, non-striker, bowler for innings 1 | FR-043 |
| 6 | Record each delivery: runs, wide, no-ball + free hit, byes/leg-byes, penalty, boundaries, overthrows | FR-044…050 |
| 7 | Record wickets: any mode, with detail and correct bowler credit; retired–not out + resumption | FR-051, FR-052, FR-053 |
| 8 | Strike rotates automatically; over completes at 6 legal balls; new-bowler prompt; consecutive-over + over-limit guardrails, override with reason | FR-054…059 |
| 9 | Fix a mistake three overs back: navigate to the ball, correct any field, figures recompute, original preserved | FR-100, FR-101, FR-102, FR-103 |
| 10 | Undo the last action during a fast passage of play | FR-061 |
| 11 | Rain stops play: record interruption, reduce overs, enter the revised target manually with a reason | FR-078, FR-079, FR-090 |
| 12 | Innings 1 ends automatically (overs complete / all out); innings 2 opens; chase ends automatically at target | FR-073, FR-074, FR-075 |
| 13 | Record the result type and margin; if scores are level, record a tie (or score a manual Super Over) | FR-081, FR-082 |
| 14 | Run the reconciliation check (total = Σ batter + extras; balls ↔ overs; wickets ≤ max) | FR-104, BR-037 |
| 15 | Resolve or explicitly override any reconciliation failure with a reason | FR-105, BR-007 |
| 16 | Head scorer signs off → match FINAL; audit trail complete from first ball | FR-106, BR-005, FR-109, FR-110 |
| 17 | Generate the full scorecard, linear sheet, bowling analysis, FoW, over-by-over, partnerships | FR-121…126 |
| 18 | Export PDF + CSV, offline; take a local backup | FR-172, FR-173, FR-174, FR-180 |
| 19 | Later: correct a post-Final error under elevated permission + reason + re-sign-off; prior Final retained | FR-108, BR-006 |
| 20 | Throughout: phone can be force-killed / lose battery / go offline with zero event loss; resume at exact state | NFR-009, NFR-010, NFR-011, NFR-012 |

**Conclusion:** the MVP feature set is closed under the end-to-end limited-overs scoring workflow. Every deferred feature is either (a) an adoption/scale concern, (b) a rare in-match event that a guardrail override + correction covers, (c) blocked by a spike with a sanctioned manual fallback, or (d) multi-day-only.

---

## 4. Release roadmap

### 4.0 One-line themes

| Release | Theme |
|---|---|
| **MVP** | *"Score one match, offline, correctly, and file it."* |
| **Version 1** | *"A club can run its whole season on this."* |
| **Version 2** | *"Two scorers, many matches, a league table, and an open ecosystem."* |
| **Future** | *"Multi-day cricket and deep analytics."* |

### 4.1 MVP — Alpha grade

- **Goal:** internal + 1–2 friendly scorers score complete limited-overs matches end to end with zero data loss.
- **Scope (Must):** areas B, C, D, E (limited-overs), F (manual target only), H (single sign-off), J (tabular), N (PDF/CSV + backup), O (scoring ergonomics), P (offline-first, durability, performance, conformance suite). Guest-only identity (A minimal).
- **Scope (Should):** sub-fielder pool, redo, end-of-over checkpoint, milestone flags, local backup/restore, sunlight mode, match search/history.
- **Won't (this release):** accounts/orgs/RBAC, automated DLS, native Super Over, charts, commentary, Cricsheet, sharing/viewer, competitions, profiles, dual-scorer, notifications, multi-day → all named for V1/V2/Future above.
- **Entry gate:** `cricket-rules-reference.md` ratified by an accredited scorer for all `[LAW]`/`[EDGE]` items; domain glossary + `SM-MATCH` agreed; SPK-02 (event-log model) proven; SPK-03 plan agreed.
- **Exit gate (→ V1 build):**
  - Rules conformance suite (NFR-053) ≥ 95% and rising.
  - Offline chaos test (NFR-009): **0 events lost** over ≥ 50 simulated innings on target Android hardware.
  - 3 full practice matches scored end to end with no data loss (`discovery §4.1` Alpha exit).
  - Every practice match produces a reconciling PDF + CSV and a complete first-ball-to-sign-off audit trail.
  - Median normal delivery ≤ 2 interactions; input acknowledged ≤ 100 ms on target hardware.
- **Risks burned down:** foundation risks #1 (rules complexity — via conformance suite), #5 (mobile data loss — via chaos gate), #10 (low-end performance — via per-tap budget), #6 (scope creep — via the MVP boundary itself).

### 4.2 Version 1 — Closed pilot grade

- **Goal:** ≥ 5 clubs/leagues adopt it for a season: ≥ 100 complete matches, scorer error rate ≤ paper baseline, SUS ≥ 80.
- **Adds (Must):** email accounts + guest-match claim (A); orgs + additive RBAC + data-layer role enforcement (A, P/NFR-024); DLS engine — revised target, live par, versioned revisions, offline *(SPK-01; else documented manual fallback stays)* (F); native Super Over + repeat + separate stats (G); shareable revocable read-only link + live viewer + offline indicator (M); live spectator scorecard (J/FR-138); WCAG 2.2 AA on core web flows (NFR-037); cross-platform parity ≥ 95%, contract-tested *(SPK-04)* (P); full offline T20 sync ≤ 30 s (NFR-006); GDPR-class export + erasure (NFR-032); consented + logged admin impersonation (NFR-028).
- **Adds (Should):** condition/competition templates + save-as-template + default template; batting/bowling metrics; Manhattan / worm / run-rate / partnership charts; ball-by-ball commentary + match notes; mankad, dead-ball reason, "penalty ball not counted" distinction; Cricsheet export *(SPK-05)*; org branding on exports; central reference-data updates; interface-language framework; match officials record; staged rollout + feature flags + rollback.
- **Won't (this release):** dual-scorer reconciliation, competitions/standings/NRR, profiles/career stats, notifications/push, import/read-API/realtime-API, counter-signature, wagon wheel, minors' guardian flow → V2. Multi-day → Future.
- **Entry gate:** MVP exit met; SPK-01 resolved (or fallback formally accepted by pilot leagues); SPK-04 decided; SPK-06 decided; pilot clubs and season window confirmed (open questions A1/A2, F25).
- **Exit gate (→ V2 build), maps to `discovery §4.2` pilot exit:**
  - ≥ 5 clubs/leagues, ≥ 100 complete matches over one season.
  - Scorer-reported error rate ≤ paper baseline; SUS ≥ 80; first-match task completion ≥ 95% with no unrecoverable error.
  - Every pilot match has a complete attributable audit trail; exported scorecards reconcile with zero discrepancy.
  - DLS benchmark within published rounding tolerance across the fixed rain-scenario set (or fallback accepted).
  - Cross-platform parity ≥ 95%; identical inputs → identical outputs on Web + Android.
  - ≥ 80% of pilot scorers would choose it over their current method.
- **Risks burned down:** #2 (DLS licensing — resolved or fallback locked), #3 (MCC text — paraphrase/permission decided), #7 (cross-platform divergence — parity matrix live), #14 (one-handed UX — pilot usability iterations), #15 (unauthorized edits — data-layer RBAC + audit).

### 4.3 Version 2 — Open beta → GA grade

- **Goal:** public sign-up; multi-scorer integrity and competition management; ≥ 99.5% monthly availability; sustainable ecosystem.
- **Adds (Must):** dual-scorer reconciliation in full (I: FR-113…120) on top of the P1 event-log/provenance foundation; deterministic sync — same events → same merge regardless of order, conflicts always surfaced, per-device monotonic sequence + logical clock, clock-skew detection (SYNC/NFR-016…019); competitions/seasons + fixtures + auto result ingest + standings + NRR + bonus points (K); player profiles + appearance claims + career/team aggregates from verified matches only (L).
- **Adds (Should):** counter-signature workflow (FR-107); dispute lock + adjudication (FR-112); public competition page; push notifications (Android + web push); follow-a-match alerts; result notifications to teams/captains; registry + duplicate-player merge; concussion-substitute pool; ball-by-ball data filtering; minors' data handling; rate limiting + abuse protection; graceful viewer-fan-out degradation; operational dashboards + on-call + restore drill.
- **Adds (Could):** wagon wheel (manual coords); read-only REST API; real-time subscription API; Cricsheet import + round-trip fidelity; fixture-list import; org API keys; head-to-head; recent-form; disciplinary entries.
- **Won't (this release):** multi-day/first-class, pitch maps/beehive, record lists, knockout brackets, embeddable widget, moment deep-links, alternative rain methods, impact player → Future.
- **Entry gate:** V1 pilot exit met; P2 specs verified; sync convergence + dual-scorer divergence test suites green (`discovery §4.3`).
- **Exit gate (→ GA):** availability ≥ 99.5% over a full month; parity matrix ≥ 95%; all shipped `P2` IDs traced to a verified spec with passing acceptance criteria; legal cleared (DLS licence, MCC permission, privacy policy, Play-Store approval); support + on-call in place (`discovery §4.1` GA gate).
- **Risks burned down:** #4 (sync corruption — deterministic merge + no silent overwrite as a hard gate), #8 (adoption vs incumbents — free tier + import + open export), #9 (real-time scale — load tests + graceful degradation), #16 (minors' data — consent model shipped), #11 (governing-body politics — open API + export as the answer).

### 4.4 Future — Post-GA

- **Goal:** cover the deferred long tail without destabilising the limited-overs core.
- **Adds:** multi-day / first-class format — 2 innings/side, sessions, declaration, forfeiture, follow-on, bad-light, ≥ 5-day local durability (own state-machine spec pass, FR-019/076/077/084, NFR-015); advanced analytics — pitch maps / beehive, record lists, deeper head-to-head; knockout brackets + progression; embeddable scorecard widget; moment deep-links; alternative rain methods behind the pluggable interface (Professional Edition, VJD — licensing permitting); impact/replacement player; runner; last-man-stands / one-short; plans / quotas / cross-tenant analytics.
- **Entry gate:** GA stable; multi-day spec pass complete and reviewed by an accredited scorer; each integration has a confirmed consumer.
- **Risks:** #13 (multi-day state complexity — isolated as its own phase with its own spec, explicitly *not* allowed to complicate P1 state modelling), #17 (interchange standard shift — adapter-based export layer supports multiple targets over time).

---

## 5. Risks

Foundation §10 risks (1–17), re-mapped to the release that retires or contains each, plus roadmap-specific risks (R-A…R-E). *I = Impact, L = Likelihood, from foundation §10.*

| # | Risk | I / L | Owning release | Mitigation on the roadmap |
|---|---|---|---|---|
| 1 | Rules / edge-case complexity underestimated → engine bugs erode trust | H / H | **MVP** | Conformance suite (NFR-053) is an MVP entry+exit gate at 100%; accredited-scorer ratification before MVP build; limited-overs before multi-day |
| 2 | DLS licensing / IP constraints | H / M | **V1** | SPK-01 must resolve before V1 DLS; MVP ships manual target as the standing sanctioned fallback; rain method kept pluggable (FR-093) |
| 3 | MCC Laws text IP | M / M | **V1** | SPK-06 before V1 help text; implement as logic + cite; paraphrase-only fallback |
| 4 | Offline sync conflicts corrupt the record (naive last-write-wins) | H / M | **V2** (foundation in **MVP**) | SPK-02 proves the append-only per-device-sequenced log in MVP; V2 sync gate: deterministic merge + conflicts always surfaced (NFR-016/017) is release-blocking |
| 5 | Data loss on mobile (crash / OS kill mid-over) | H / M | **MVP** | Write-ahead persistence per event (NFR-010); crash recovery (NFR-011); chaos test = MVP exit gate, 0 losses over ≥ 50 innings; SPK-03 |
| 6 | Scope creep (endless edge cases + tournaments + analytics) | H / H | **MVP** (structural) | The MVP boundary (§3) + enforced Won't-lists per release + phase gates; every new ask triaged against foundation §5 objectives |
| 7 | Cross-platform divergence (Web vs Android drift) | H / M | **V1** | SPK-04 decides the shared rules-core delivery; parity matrix ≥ 95% is a V1 exit gate; contract tests run on both every build |
| 8 | Adoption vs incumbents (CricHeroes, Play-Cricket, NV Play, TCS, MyCricket) | M / M | **V1 → V2** | Superior offline UX + integrity (MVP/V1); free tier, import tooling, open export, pilot partners, association endorsement pursuit (V2) |
| 9 | Real-time scale (many concurrent live matches + viewers) | M / M | **V2** | Capacity planning + load tests pre-beta; graceful degradation to polling (NFR-021); viewer fan-out backpressure |
| 10 | Performance on low-end Android (laggy entry loses live pace) | H / M | **MVP** | Per-tap performance budget (NFR-001/002) as an MVP exit gate; device-lab testing on target-tier hardware |
| 11 | Governing-body politics (associations mandate their own tools) | M / M | **V2** | Interoperability + open export + read API; position as complementary; seek endorsement not confrontation |
| 12 | Small-team bandwidth vs a large domain | H / M | **all** | AI-assisted SDD; aggressive phasing (this roadmap); managed backend; narrow MVP; specialised agent workflow |
| 13 | Multi-day / Test state complexity | M / M | **Future** | Explicit `SM-MATCH`; isolated as its own phase + spec pass; must not complicate P1 state modelling |
| 14 | One-handed / speed UX hard to nail | M / M | **V1** | Early, repeated usability testing with real scorers during live matches; Build→Verify→Feedback→Improve loop during pilot |
| 15 | Integrity / security: unauthorized or tampered score edits | H / L–M | **MVP → V1** | MVP: scorer-only delivery writes (NFR-026), immutable audit log, corrections-as-events. V1: data-layer role enforcement (NFR-024), security-agent review |
| 16 | Legal / privacy for player data incl. minors | M / M | **V1 → V2** | V1: data-protection design review, minimised data (names only), export + erasure. V2: guardian-consent path, reduced minor-profile visibility |
| 17 | Interchange standard shifts or is rejected by the target ecosystem | L–M / M | **V1 → Future** | SPK-05 confirms Cricsheet target for V1; adapter-based export layer; support multiple targets over time |

### Roadmap-specific risks

| # | Risk | I / L | Owning release | Mitigation |
|---|---|---|---|---|
| R-A | **SPK-02 slips or the event-log model proves inadequate for P2 merge** — MVP correction model would need rework and V2 dual-scorer becomes a rewrite | H / M | **MVP** | Treat SPK-02 as the single highest-priority pre-MVP architecture spike; MVP entry gate; design review with the architecture agent before any client work |
| R-B | **MVP line drawn too tight** — pilot clubs reject V1 because a "missing" everyday case (keeper change, new ball, native Super Over) makes it feel unofficial | M / M | **V1** | Those cases are already V1-scoped; guardrail-override + correction is the documented MVP interim; validate the interim with the 1–2 Alpha scorers before committing V1 scope |
| R-C | **MVP line drawn too loose** — Alpha never exits because "just one more" feature keeps being pulled in | H / M | **MVP** | §3.2 In/Out list is the contract; anything not in it needs an explicit bucket move with a rationale recorded here |
| R-D | **DLS fallback unacceptable to pilot leagues** — manual target entry fails the "official record" bar for V1 | M / M | **V1** | Confirm with pilot leagues at V1 entry (open question B6); if hard-blocking, SPK-01 becomes a V1 entry gate rather than a V1 build item |
| R-E | **Two client platforms (Web PWA + Android) double the surface before parity tooling exists** | M / M | **MVP → V1** | Consider single-platform Alpha (whichever the friendly scorers use); SPK-04 + contract tests must land early in V1, not late |

---

## 6. Acceptance criteria

Release-level acceptance criteria in Given / When / Then form. Feature-level Given/When/Then belongs in the per-feature specs under `docs/specs/` (Definition of Ready, `discovery §3.3`); a representative sample of MVP feature-level criteria is included to anchor the boundary.

### 6.1 MVP — release acceptance

- **AC-MVP-01 — End-to-end limited-overs match, offline**
  *Given* a device in airplane mode with no prior account,
  *when* a scorer creates a custom T20, enters both XIs, records the toss, scores all 40 overs including at least one wide, one no-ball + free hit, byes, leg-byes, penalty runs, a boundary-overthrow, and at least three different dismissal modes, then signs off,
  *then* the match reaches FINAL, the scorecard reconciles (total = Σ batter runs + extras; legal balls ↔ overs; wickets ≤ configured max), and a PDF and CSV are produced — all without connectivity. *(FR-017/024/032/044…053/104/106/121/172/173/174; NFR-012)*

- **AC-MVP-02 — Zero event loss under chaos**
  *Given* the defined chaos test (force-kill, battery pull, OS eviction, offline toggling) run over ≥ 50 simulated innings on target-tier Android hardware,
  *when* each run is replayed from its event log,
  *then* zero ball-events are lost and every match resumes at its exact last confirmed state. *(NFR-009/010/011; SPK-03)*

- **AC-MVP-03 — Corrections never destroy history**
  *Given* a signed passage of play,
  *when* the scorer corrects a delivery from three overs earlier,
  *then* the original event is retained and linked, a superseding event is recorded, all derived figures (batter, bowler, extras, FoW, partnerships, result projection) recompute, and the audit view shows who/what/when/before→after. *(FR-100…103/109/110; BR-004)*

- **AC-MVP-04 — Reconciliation gates sign-off**
  *Given* a match whose figures do not reconcile,
  *when* the head scorer attempts sign-off,
  *then* sign-off is blocked and the specific failing invariant is shown; sign-off proceeds only after the failure is resolved or explicitly overridden with a recorded reason by an authorised role. *(FR-104/105; BR-007/037)*

- **AC-MVP-05 — Lawful engine**
  *Given* the versioned cricket-rules conformance suite,
  *when* it runs against the scoring engine,
  *then* the pass rate is ≥ 95% at MVP-build entry and trends to 100%, with every `[LAW]`/`[EDGE]` case reviewed by an accredited scorer. *(NFR-053/054)*

- **AC-MVP-06 — Speed of entry**
  *Given* target Android hardware,
  *when* a scorer records a normal delivery,
  *then* it takes ≤ 2 discrete interactions and the UI acknowledges each input in ≤ 100 ms, and one scorer keeps pace with live T20 play with no growing backlog. *(NFR-001/002/003)*

- **AC-MVP-07 — Manual target path (DLS fallback)**
  *Given* an interrupted innings,
  *when* the scorer records the interruption, reduces the overs, and enters a revised target manually with a reason,
  *then* the chase logic, live "runs required / balls remaining", and the final result all use the entered target, and the revision is attributable in the audit trail. *(FR-078/079/090; NFR-034 fallback)*

- **AC-MVP-08 — Post-Final control**
  *Given* a FINAL match,
  *when* a correction is attempted,
  *then* it requires an elevated role, a recorded reason, and re-sign-off, and the prior FINAL version is retained. *(FR-108; BR-006)*

- **AC-MVP-exit** — 3 full practice matches scored end to end with no data loss; each yields a reconciling PDF/CSV and a complete first-ball-to-sign-off audit trail. *(discovery §4.1 Alpha exit)*

### 6.2 Version 1 — release acceptance

- **AC-V1-01 — Pilot scale**
  *Given* the closed pilot,
  *when* one season completes,
  *then* ≥ 5 clubs/leagues have scored ≥ 100 complete matches end to end. *(discovery §4.2)*

- **AC-V1-02 — DLS accuracy or accepted fallback**
  *Given* the fixed rain-scenario benchmark set,
  *when* the DLS engine computes revised targets and par,
  *then* every result is within the published DLS Standard Edition rounding tolerance — **or** SPK-01 is unresolved and the manual-target fallback is formally accepted in writing by the pilot leagues. *(FR-086…091; NFR-034; SPK-01)*

- **AC-V1-03 — Cross-platform parity**
  *Given* the shared scoring-core contract-test set,
  *when* it runs on Web and Android,
  *then* identical inputs produce identical outputs and the parity matrix scores ≥ 95%. *(NFR-047/048; SPK-04)*

- **AC-V1-04 — Sync within budget**
  *Given* a full offline T20 (~250+ events) on a 3G-class connection,
  *when* the device reconnects,
  *then* it syncs in ≤ 30 s. *(NFR-006)*

- **AC-V1-05 — Shareable live viewing**
  *Given* a live match and a generated read-only link,
  *when* a person with no account opens it on the web,
  *then* they see a near-real-time scorecard while the source is online, a "last updated X ago" + offline indicator when it is not, and the link can be revoked. *(FR-161…164; NFR-029)*

- **AC-V1-06 — Native Super Over**
  *Given* a tied limited-overs match with the tie-breaker set to Super Over,
  *when* the scorer runs the Super Over workflow,
  *then* it enforces 3 nominated batters + 1 bowler per side, a 2-wicket maximum and 1 over each, repeats until a result, and keeps Super Over stats separate from main-match aggregates. *(FR-095…098; BR-043)*

- **AC-V1-07 — Accessibility**
  *Given* the core web scoring and scorecard flows,
  *when* audited against WCAG 2.2 AA (keyboard, screen reader, contrast, one-handed),
  *then* there are zero blocking issues. *(NFR-037; discovery §4.3)*

- **AC-V1-08 — Data-layer authorization**
  *Given* a signed-in user without a scorer role on a match,
  *when* their client attempts to write a delivery or read data outside its permissions,
  *then* the data layer rejects it regardless of client behaviour. *(NFR-024/026)*

- **AC-V1-09 — Data rights**
  *Given* a registered user,
  *when* they request a full personal-data export or account deletion,
  *then* the export is produced and deletion is applied with the defined handling of authored FINAL matches (audit actors anonymised, FINAL records retained). *(FR-010/011; NFR-032; BR-025)*

- **AC-V1-exit** — pilot exit checklist (`discovery §4.2`) fully met: error rate ≤ paper baseline, SUS ≥ 80, first-match completion ≥ 95% with no unrecoverable error, every match fully attributable, Cricsheet round-trip demonstrated (or SPK-05 fallback recorded), ≥ 80% would choose it over their current method.

### 6.3 Version 2 — release acceptance

- **AC-V2-01 — Deterministic merge**
  *Given* two independent scorer logs of the same match with seeded disagreements,
  *when* their events are delivered to the backend in arbitrary order,
  *then* the merged result is identical regardless of arrival order and every conflict is surfaced — never resolved by last-write-wins. *(NFR-016/017/018; FR-116/119)*

- **AC-V2-02 — Dual-scorer reconciliation**
  *Given* a divergence between two scorer logs at a specific over.ball,
  *when* one scorer proposes an agreed version,
  *then* it does not apply until the other scorer confirms, and match sign-off is blocked while any unresolved divergence remains (override requires a reason + dual attestation). *(FR-117/118/120; BR-008)*

- **AC-V2-03 — Competitions & standings**
  *Given* a competition with a configured points model and NRR rules,
  *when* signed-off match results are ingested,
  *then* standings, NRR and bonus points recompute automatically and only from FINAL, non-disputed matches. *(FR-144…147; BR-021/039/040)*

- **AC-V2-04 — Verified stats only**
  *Given* a player with claimed appearances,
  *when* career aggregates are computed,
  *then* they include only verified (approved) appearances in FINAL matches, and Super Over stats are excluded from main aggregates. *(FR-152/153; BR-014/015/043)*

- **AC-V2-05 — Availability**
  *Given* a full calendar month of operation,
  *when* uptime of the online services is measured,
  *then* it is ≥ 99.5%. *(NFR-013)*

- **AC-V2-exit (→ GA)** — beta exit met; parity ≥ 95%; all shipped P2 IDs traced to verified specs with passing acceptance criteria; legal cleared (DLS licence, MCC permission, privacy policy, Play-Store approval); support + on-call in place. *(discovery §4.1)*

### 6.4 Future — release acceptance (outline)

- **AC-FUT-01 — Multi-day correctness**
  *Given* a two-innings-per-side first-class match,
  *when* it is scored with declarations, a follow-on, sessions and a bad-light stoppage,
  *then* the state machine, follow-on enforcement, and result derivation (incl. draw vs tie) are correct against the accredited-scorer-reviewed multi-day conformance cases, **and** the limited-overs P1 state model is unchanged. *(FR-019/076/077/084; foundation risk 13)*
- **AC-FUT-02 — Pluggable rain methods** — an alternative rain method can be selected per competition config without a client release, producing method-appropriate targets, with DLS Standard unaffected. *(FR-093; NFR-056)*
- **AC-FUT-03 — Local durability** — a ≥ 5-day match retains all local data without loss across the full match duration under the chaos test. *(NFR-015)*

---

## 7. Open questions that move the boundary

These are unresolved and each can shift a feature between buckets. Owners and needed-by dates per `discovery §3.5` / foundation §11.

| Ref | Question | Bucket it affects | Current roadmap assumption |
|---|---|---|---|
| **B6** | Automated DLS required for V1, or is manual entry acceptable initially? | F: MVP ↔ V1 | Manual in MVP; automated is V1-Must, SPK-01-gated |
| **B7** | Dual-scorer real-time reconciliation in V1 or V2? | I: V2 | V2 (assumed) |
| **B8** | Tournaments / points tables / NRR in V1 or later? | K: V2 | V2 (assumed) |
| **Q-D1** | Super Over required in the first shippable, or a fast-follow? | G: MVP ↔ V1 | Manual workaround in MVP; native in V1 |
| **Q-D3** | Counter-signature needed for a match to count as "official" in the pilot? | H: V1 ↔ V2 | Single sign-off for MVP/V1; counter-signature V2 |
| **Q-D4** | Do pilot leagues expect wagon wheels on day one? | J: V2 ↔ V1 | Charts (Manhattan/worm/run-rate) in V1; wagon wheel V2 |
| **Q-D6** | Are result notifications table-stakes for the pilot, or is a shareable link enough? | M: V2 ↔ V1 | Link in V1; notifications V2 |
| **A1 / A2 / A4** | Primary segment, first geography, business model | A (tenancy/roles): V1 | Club/league volunteer scorers, English-first, phased |
| **C12 / C13** | Guest scoring required? Umpire/commentator real roles in V1? | A: MVP / V1 | Guest = yes (MVP); umpire/commentator light/V2 |
| **D16 / D17 / D19** | Confirm Supabase backend; PWA acceptable; shared-core approach | P: V1 | Assumed yes; SPK-04 for shared core |
| **E21 / E22** | DLS/MCC licensing ownership + budget; match-data ownership model | F, A/BR-001/BR-025: V1 | Pluggable + fallback; ownership model TBD before V1 |

---

## 8. Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-02 | Initial roadmap. Buckets MVP / V1 / V2 / Future mapped to discovery P1–P3 and release stages Alpha–Post-GA. Feature map (areas A–P), dependency chain + table, MVP boundary with completeness proof, per-release roadmap with entry/exit gates, risk register (foundation §10 + R-A…R-E), release-level acceptance criteria. No code, no implementation. The consolidated SRS (`docs/specs/software-requirements-specification.md`) is now written; its `FR-/DR-/BR-/NFR-/SEC-/OFF-/SYNC-/AUD-` IDs are the canonical reference and supersede the raw discovery IDs cited in this roadmap. |
