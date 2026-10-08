import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { AuthGate } from "./core/AuthGate";
import { supabase } from "./core/supabaseClient";
import { computeEventHash, newScoringSession, type ScoringSession } from "./core/eventChain";
import { CreateMatchScreen } from "./screens/UX-04-create-match/CreateMatchScreen";
import type { DraftMatch } from "./screens/UX-04-create-match/createMatchForm";
import { MatchSetupScreen } from "./screens/UX-05-match-setup/MatchSetupScreen";
import type { MatchSetupFormState } from "./screens/UX-05-match-setup/matchSetupForm";
import { TeamSelectionScreen } from "./screens/UX-06-team-selection/TeamSelectionScreen";
import type { Team, TeamSelectionState } from "./screens/UX-06-team-selection/teamSelectionForm";
import { PlayingXiScreen } from "./screens/UX-07-playing-xi/PlayingXiScreen";
import type { PlayingXiState, SideXiState } from "./screens/UX-07-playing-xi/playingXiForm";
import { TossScreen } from "./screens/UX-08-toss/TossScreen";
import type { InningsOrder, TossState } from "./screens/UX-08-toss/tossForm";
import { InningsSetupScreen } from "./screens/UX-09-innings-setup/InningsSetupScreen";
import type { InningsSetupState } from "./screens/UX-09-innings-setup/inningsSetupForm";
import { LiveScoringScreen } from "./screens/UX-10-live-scoring/LiveScoringScreen";
import { BallEntryScreen } from "./screens/UX-11-ball-entry/BallEntryScreen";
import { WicketEntryScreen } from "./screens/UX-12-wicket-entry/WicketEntryScreen";
import { ExtrasScreen } from "./screens/UX-13-extras/ExtrasScreen";
import type { ExtraType } from "./screens/UX-13-extras/extrasForm";
import { StrikeChangeScreen } from "./screens/UX-14-strike-change/StrikeChangeScreen";
import { BowlerChangeScreen } from "./screens/UX-15-bowler-change/BowlerChangeScreen";
import type { BowlerCandidate } from "./screens/UX-15-bowler-change/bowlerChangeForm";
import { OverCompletionScreen } from "./screens/UX-16-over-completion/OverCompletionScreen";
import type { OverSummary } from "./screens/UX-16-over-completion/overCompletionSummary";
import { ScoreCorrectionScreen } from "./screens/UX-17-score-correction/ScoreCorrectionScreen";
import type { CascadeSummary } from "./screens/UX-17-score-correction/scoreCorrectionForm";
import { UndoRedoControl } from "./screens/UX-18-undo/UndoRedoControl";
import { MatchPauseControl } from "./screens/UX-19-match-pause-resume/MatchPauseControl";
import { ScorecardScreen, type BattingOrderEntry } from "./screens/UX-20-scorecard/ScorecardScreen";
import { BallByBallScreen, type Delivery } from "./screens/UX-21-ball-by-ball/BallByBallScreen";
import { MatchSummaryScreen } from "./screens/UX-22-match-summary/MatchSummaryScreen";
import type { ReconciliationCheck } from "./screens/UX-22-match-summary/signOffForm";
import { OfflineModeIndicator } from "./screens/UX-23-offline-mode/OfflineModeIndicator";
import { SyncStatusScreen } from "./screens/UX-24-sync-status/SyncStatusScreen";
import type { PushEventOutcome } from "./screens/UX-24-sync-status/syncStatusState";
import { FenceConflictScreen } from "./screens/UX-25-conflict-resolution/FenceConflictScreen";
import { MatchHistoryScreen } from "./screens/UX-26-match-history/MatchHistoryScreen";
import type { MatchSummary } from "./screens/UX-26-match-history/matchHistoryForm";
import { SettingsScreen } from "./screens/UX-27-settings/SettingsScreen";
import { AdministrationScreen, type AdminMember } from "./screens/UX-28-administration/AdministrationScreen";

// This gallery was first built with every screen shown in isolation with
// fixed demo data (no screen ever affected another). This revision wires
// REAL navigation: completing the match-setup chain (UX-04 -> UX-09) carries
// the data you entered forward into the next screen, and Live Scoring's own
// 8 named actions open their real sub-screen and return to the hub on
// completion, updating the hub's own running score/wicket count. Screens
// with no natural place in that per-match chain (history/settings/admin/
// connectivity/bowler-change/over-completion/score-correction/match-summary)
// live behind a persistent top nav bar with its own Back action.
//
// Still explicitly NOT real: no backend/Supabase call happens anywhere; over
// completion/bowler-change are not auto-triggered by a real over boundary
// (no ball-level domain engine is wired in here); extras/undo don't adjust
// the score beyond a simple runs/wickets counter.

type Screen =
  | "UX-04"
  | "UX-05"
  | "UX-06"
  | "UX-07"
  | "UX-08"
  | "UX-09"
  | "UX-10"
  | "UX-11"
  | "UX-12"
  | "UX-13"
  | "UX-14"
  | "UX-15"
  | "UX-16"
  | "UX-17"
  | "UX-18"
  | "UX-19"
  | "UX-20"
  | "UX-21"
  | "UX-22"
  | "UX-23"
  | "UX-24"
  | "UX-25"
  | "UX-26"
  | "UX-27"
  | "UX-28";

interface LiveState {
  strikerName: string;
  nonStrikerName: string;
  bowlerName: string;
  // Real player ids, needed to build a real DELIVERY_RECORDED payload --
  // "p1"/"p2"/"p3" stand-ins when this hub is reached via a demo shortcut
  // rather than the real UX-04..09 setup flow (e.g. Match History's own
  // "Open Match" action), which carries no real XI with it.
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  runs: number;
  wickets: number;
  legalBallsBowled: number;
  totalBallsAllotted: number;
  ballsPerOver: number;
  extras: { byes: number; legByes: number; wides: number; noBalls: number; penalties: number };
  target: number | null;
  inningsNumber: number;
  isOnline: boolean;
  lastBallAnnouncement: string;
}

const defaultLiveState: LiveState = {
  strikerName: "Alice",
  nonStrikerName: "Bea",
  bowlerName: "Cara",
  strikerId: "p1",
  nonStrikerId: "p2",
  bowlerId: "p3",
  runs: 0,
  wickets: 0,
  legalBallsBowled: 0,
  totalBallsAllotted: 120,
  ballsPerOver: 6,
  extras: { byes: 0, legByes: 0, wides: 0, noBalls: 0, penalties: 0 },
  target: null,
  inningsNumber: 1,
  isOnline: true,
  lastBallAnnouncement: "Innings started.",
};

const demoTeamA: Team = { id: "team-A", name: "Riverside CC", isAdHoc: false };
const demoTeamB: Team = { id: "team-B", name: "Harbour CC", isAdHoc: false };

function squadOf(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix.toUpperCase()} Player ${i + 1}`, isAdHoc: false }));
}

function xiPlayers(side: SideXiState) {
  return side.squad.filter((p) => side.selectedIds.includes(p.id));
}

// Static demo data for screens not reachable from the real per-match flow
// (no over-boundary/bowler-change engine, no conflict/sync simulation).
const bowlerChangeCandidates: BowlerCandidate[] = [
  { id: "b1", name: "J. Smith", legalBallsBowled: 18, runsCharged: 18, wickets: 1, maidens: 0 },
  { id: "b2", name: "R. Jones", legalBallsBowled: 0, runsCharged: 0, wickets: 0, maidens: 0 },
];
const overCompletionSummary: OverSummary = {
  overNumber: 4,
  runsConceded: 7,
  wicketsThisOver: 1,
  isMaiden: false,
  bowlerFigures: { legalBallsBowled: 20, runsCharged: 18, wickets: 1, maidens: 0 },
};
const scoreCorrectionCascade: CascadeSummary = { orphanedDeliveryCount: 2, requiresContinuation: false, firstStrikeContinuityBreakIndex: null };
const matchSummaryChecks: ReconciliationCheck[] = [{ invariantId: "INV-001", status: "PASS", detail: null }];
const syncStatusOutcomes: PushEventOutcome[] = [];
const adminMembers: AdminMember[] = [{ id: "m1", name: "Alex", roles: ["HEAD_SCORER"] }];

// Real read, via PostgREST + RLS -- not demo data. matches.state's own real
// enum (SCHEDULED/READY/IN_PROGRESS/INNINGS_BREAK/PAUSED/COMPLETE/ABANDONED)
// is richer than MatchSummary's own 3-value MatchState -- a genuine,
// pre-existing gap in this screen's own type (no "upcoming/not started"
// value exists), not invented here; SCHEDULED/READY collapse into
// IN_PROGRESS as the closest available value, flagged rather than hidden.
async function fetchRealMatchHistory(): Promise<MatchSummary[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("id,venue,scheduled_start,created_at,state,home_team:teams!home_team_id(name),away_team:teams!away_team_id(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    teamAName: row.home_team?.name ?? "Team A",
    teamBName: row.away_team?.name ?? "Team B",
    competition: null,
    venue: row.venue,
    date: (row.scheduled_start ?? row.created_at).slice(0, 10),
    state:
      row.state === "COMPLETE" ? "FINAL" : row.state === "ABANDONED" ? "ABANDONED" : "IN_PROGRESS",
  }));
}
const extrasEnabledTypes = new Set<ExtraType>(["WIDE", "NO_BALL", "BYE", "LEG_BYE", "PENALTY"]);
const ballByBallDeliveries: Delivery[] = [
  { id: "d1", overNumber: 1, ballInOver: 1, bowlerName: "Smith", strikerName: "Jones", runs: 4, isBoundary: true, wicketDescription: null, extraDescription: null, bowlerId: "b1", strikerId: "s1", phase: "POWERPLAY" },
];

const topNav: { screen: Screen; label: string }[] = [
  { screen: "UX-26", label: "Match History" },
  { screen: "UX-22", label: "Match Summary" },
  { screen: "UX-15", label: "Bowler Change" },
  { screen: "UX-16", label: "Over Completion" },
  { screen: "UX-17", label: "Score Correction" },
  { screen: "UX-23", label: "Offline Mode" },
  { screen: "UX-24", label: "Sync Status" },
  { screen: "UX-25", label: "Conflict Resolution" },
  { screen: "UX-27", label: "Settings" },
  { screen: "UX-28", label: "Administration" },
];

function AppShell({ session }: { session: Session }) {
  const [screen, setScreen] = useState<Screen>("UX-26");
  const [returnTo, setReturnTo] = useState<Screen | null>(null);

  const [draftMatch, setDraftMatch] = useState<DraftMatch | null>(null);
  const [matchSetup, setMatchSetup] = useState<MatchSetupFormState | null>(null);
  const [teamSelection, setTeamSelection] = useState<TeamSelectionState | null>(null);
  const [xi, setXi] = useState<PlayingXiState | null>(null);
  const [toss, setToss] = useState<{ state: TossState; order: InningsOrder } | null>(null);
  const [live, setLive] = useState<LiveState>(defaultLiveState);

  const [realMatches, setRealMatches] = useState<MatchSummary[]>([]);
  const [matchHistoryLoading, setMatchHistoryLoading] = useState(true);
  const [matchHistoryError, setMatchHistoryError] = useState<string | null>(null);

  function reloadMatchHistory() {
    setMatchHistoryLoading(true);
    setMatchHistoryError(null);
    fetchRealMatchHistory()
      .then((rows) => setRealMatches(rows))
      .catch((err) => setMatchHistoryError(err instanceof Error ? err.message : String(err)))
      .finally(() => setMatchHistoryLoading(false));
  }

  useEffect(() => {
    reloadMatchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen === "UX-06") reloadRealTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (screen === "UX-26") reloadMatchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const [realTeams, setRealTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [matchSaveError, setMatchSaveError] = useState<string | null>(null);
  const [matchSaving, setMatchSaving] = useState(false);
  const [realMatchId, setRealMatchId] = useState<string | null>(null);
  const [scoringSession, setScoringSession] = useState<ScoringSession | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  // The minimum real scoring pathway: let the match's own creator
  // become its own Head Scorer. No "invite a scorer" flow exists
  // anywhere in this backlog -- this is deliberately narrow self-
  // assignment, not a general role-grant mechanism. Reuses an existing
  // officials row for this user if one was already created (e.g. by an
  // earlier match), rather than minting a fresh one every time.
  async function ensureScorerAssignment(matchId: string) {
    let officialId: string;
    const { data: existing, error: findError } = await supabase
      .from("officials")
      .select("id")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) {
      officialId = existing.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from("officials")
        .insert({ id: crypto.randomUUID(), user_id: session.user.id, name: session.user.email ?? "Scorer", created_by: session.user.id })
        .select("id")
        .single();
      if (createError) throw createError;
      officialId = created.id;
    }
    const { error: assignError } = await supabase
      .from("match_officials")
      .insert({ match_id: matchId, official_id: officialId, role: "HEAD_SCORER", created_by: session.user.id });
    if (assignError) throw assignError;
  }

  // Pushes one real DELIVERY_RECORDED event through the real POST
  // /sync/events pipeline (database/supabase/functions/sync-events) --
  // see core/eventChain.ts for the hash-chain convention this invents.
  // Only Ball Entry's own plain-runs action is wired to this for now;
  // wicket/extras recording stay local-only, flagged clearly, since
  // each needs its own payload shape and this proves the pipeline
  // works end to end without building all of them in one pass.
  async function pushDeliveryEvent(totalRuns: number): Promise<{ outcome: "accepted" } | { outcome: "rejected"; detail: string }> {
    if (!scoringSession) return { outcome: "rejected", detail: "No real scoring session is active for this match." };
    const eventId = crypto.randomUUID();
    const payload = {
      legality: "LEGAL",
      strikerBatterId: live.strikerId,
      nonStrikerBatterId: live.nonStrikerId,
      bowlerId: live.bowlerId,
      isFreeHit: false,
      runEvents: [{ origin: "OFF_BAT", value: totalRuns, method: totalRuns >= 4 ? "BOUNDARY" : "RUN" }],
      shortRuns: 0,
    };
    const hash = await computeEventHash(scoringSession.lastHash, eventId, payload);
    const nowIso = new Date().toISOString();
    const event = {
      eventId,
      streamId: scoringSession.scorerStreamId,
      deviceId: scoringSession.deviceId,
      deviceSeq: scoringSession.nextDeviceSeq,
      prevHash: scoringSession.lastHash,
      hash,
      type: "DELIVERY_RECORDED",
      eventVersion: 1,
      hlc: `${nowIso}-${scoringSession.nextDeviceSeq}`,
      eventOrdinal: scoringSession.nextDeviceSeq,
      actorRef: session.user.id,
      provenance: { app: "kencric-web-gallery" },
      recordedAt: nowIso,
      payload,
    };
    const { data, error } = await supabase.functions.invoke("sync-events", {
      body: {
        matchId: scoringSession.matchId,
        scorerStreamId: scoringSession.scorerStreamId,
        deviceId: scoringSession.deviceId,
        fenceValue: scoringSession.fenceValue,
        events: [event],
      },
    });
    if (error) return { outcome: "rejected", detail: error.message };
    const result = data.results?.[0];
    if (result?.outcome !== "ACCEPTED") {
      return { outcome: "rejected", detail: result?.errorDetail ?? "Unknown rejection" };
    }
    setScoringSession((s) => (s ? { ...s, nextDeviceSeq: s.nextDeviceSeq + 1, lastHash: hash } : s));
    return { outcome: "accepted" };
  }

  async function reloadRealTeams() {
    setTeamsLoading(true);
    setTeamsError(null);
    try {
      const { data, error } = await supabase.from("teams").select("id,name").order("created_at", { ascending: false });
      if (error) throw error;
      setRealTeams((data ?? []).map((t) => ({ id: t.id, name: t.name, isAdHoc: false })));
    } catch (err) {
      setTeamsError(err instanceof Error ? err.message : String(err));
    } finally {
      setTeamsLoading(false);
    }
  }

  // A real INSERT into matches, firing once the setup flow has everything
  // that table's own NOT NULL columns need. Two real, flagged gaps found
  // while wiring this, neither invented around:
  // 1. The UI's own MatchFormat ("ODI_LIST_A") doesn't match the DB's
  //    check constraint ("ODI") -- mapped explicitly below, not silently
  //    assumed identical.
  // 2. conditions_profile/conditions_profile_version/match_timezone are
  //    all NOT NULL but no screen in this flow collects them -- filled
  //    with clearly-flagged placeholders (an empty profile, version 1,
  //    the browser's own timezone) rather than blocking the whole flow
  //    on building a Playing Conditions Profile screen that doesn't exist
  //    yet anywhere in this backlog.
  async function createRealMatch(): Promise<string> {
    if (!teamSelection?.teamA || !teamSelection?.teamB || !toss) {
      throw new Error("createRealMatch called before teams/toss were real");
    }
    const formatMap: Record<string, string> = { ODI_LIST_A: "ODI" };
    const rawFormat = draftMatch?.format ?? "T20";
    const format = formatMap[rawFormat] ?? rawFormat;
    const tossWinnerTeamId = toss.state.winner === "A" ? teamSelection.teamA.id : teamSelection.teamB.id;
    const { data, error } = await supabase
      .from("matches")
      .insert({
        id: crypto.randomUUID(),
        origin_device_id: crypto.randomUUID(),
        home_team_id: teamSelection.teamA.id,
        away_team_id: teamSelection.teamB.id,
        home_xi: xi?.sideA ?? null,
        away_xi: xi?.sideB ?? null,
        format,
        overs_allotted: matchSetup?.oversAllotted ?? null,
        conditions_profile: {},
        conditions_profile_version: 1,
        match_timezone: matchSetup?.matchTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        toss_winner_team_id: tossWinnerTeamId,
        toss_decision: toss.state.decision,
        venue: matchSetup?.venue ?? null,
        scheduled_start: matchSetup?.date ? `${matchSetup.date}T00:00:00Z` : null,
        min_overs_for_result: matchSetup?.minOversForResult ?? null,
        state: "IN_PROGRESS",
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  async function createRealTeam(name: string) {
    const { data, error } = await supabase
      .from("teams")
      .insert({ id: crypto.randomUUID(), name, created_by: session.user.id })
      .select("id,name")
      .single();
    if (error) throw error;
    setRealTeams((prev) => [{ id: data.id, name: data.name, isAdHoc: false }, ...prev]);
  }

  function openSub(next: Screen) {
    setReturnTo(screen);
    setScreen(next);
  }
  function backToHub() {
    setScreen(returnTo ?? "UX-10");
    setReturnTo(null);
  }
  function resetFlowState() {
    setDraftMatch(null);
    setMatchSetup(null);
    setTeamSelection(null);
    setXi(null);
    setToss(null);
    setLive(defaultLiveState);
    setReturnTo(null);
    setRealMatchId(null);
    setScoringSession(null);
    setDeliveryError(null);
    setMatchSaveError(null);
  }

  let battingXi: { id: string; name: string }[] = squadOf("a", 11);
  let fieldingXi: { id: string; name: string }[] = squadOf("b", 11);
  let battingSideName = "Team A";
  let fieldingSideName = "Team B";
  if (teamSelection && xi && toss) {
    const battingIsA = toss.order.battingFirst === "A";
    const battingSide = battingIsA ? xi.sideA : xi.sideB;
    const fieldingSide = battingIsA ? xi.sideB : xi.sideA;
    battingXi = xiPlayers(battingSide);
    fieldingXi = xiPlayers(fieldingSide);
    battingSideName = (battingIsA ? teamSelection.teamA?.name : teamSelection.teamB?.name) ?? battingSideName;
    fieldingSideName = (battingIsA ? teamSelection.teamB?.name : teamSelection.teamA?.name) ?? fieldingSideName;
  }

  function renderScreen(): JSX.Element {
    switch (screen) {
      case "UX-04":
        return (
          <CreateMatchScreen
            suggestedLabel="My Match"
            ownership="GUEST"
            templates={[]}
            onContinue={(draft) => {
              setDraftMatch(draft);
              setScreen("UX-05");
            }}
          />
        );
      case "UX-05":
        return (
          <MatchSetupScreen
            isLocked={false}
            onContinue={(state) => {
              setMatchSetup(state);
              setScreen("UX-06");
            }}
          />
        );
      case "UX-06":
        return (
          <>
            <div style={{ marginBottom: 16, padding: 12, border: "1px solid #ddd", borderRadius: 6 }}>
              <strong style={{ fontSize: 13 }}>Real teams (from the database)</strong>
              {teamsError && <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>{teamsError}</p>}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTeamName.trim()) return;
                  createRealTeam(newTeamName.trim())
                    .then(() => setNewTeamName(""))
                    .catch((err) => setTeamsError(err instanceof Error ? err.message : String(err)));
                }}
                style={{ display: "flex", gap: 8, marginTop: 8 }}
              >
                <input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="New team name"
                  style={{ flex: 1, padding: 6 }}
                />
                <button type="submit" disabled={teamsLoading}>Create real team</button>
              </form>
            </div>
            <TeamSelectionScreen
              availableTeams={realTeams.length > 0 ? realTeams : [demoTeamA, demoTeamB]}
              requiredXiSize={11}
              onContinue={(state) => {
                setTeamSelection(state);
                setScreen("UX-07");
              }}
            />
          </>
        );
      case "UX-07": {
        const squadA = teamSelection && teamSelection.squadA.length > 0 ? teamSelection.squadA : squadOf("a", 13);
        const squadB = teamSelection && teamSelection.squadB.length > 0 ? teamSelection.squadB : squadOf("b", 13);
        return (
          <PlayingXiScreen
            squadA={squadA}
            squadB={squadB}
            requiredXiSize={11}
            onContinue={(state) => {
              setXi(state);
              setScreen("UX-08");
            }}
          />
        );
      }
      case "UX-08":
        return (
          <TossScreen
            teamAName={teamSelection?.teamA?.name ?? "Team A"}
            teamBName={teamSelection?.teamB?.name ?? "Team B"}
            isLocked={false}
            onConfirm={(state, order) => {
              setToss({ state, order });
              setScreen("UX-09");
            }}
            onAmend={() => {}}
          />
        );
      case "UX-09":
        return (
          <>
            {matchSaveError && (
              <p role="alert" style={{ color: "#b91c1c" }}>
                Could not save the real match: {matchSaveError}
              </p>
            )}
            {matchSaving && <p>Saving real match...</p>}
            <InningsSetupScreen
              battingSideName={battingSideName}
              fieldingSideName={fieldingSideName}
              battingXi={battingXi}
              fieldingXi={fieldingXi}
              onStart={(state: InningsSetupState) => {
                const striker = battingXi.find((p) => p.id === state.strikerId);
                const nonStriker = battingXi.find((p) => p.id === state.nonStrikerId);
                const bowler = fieldingXi.find((p) => p.id === state.bowlerId);
                setMatchSaveError(null);
                setMatchSaving(true);
                createRealMatch()
                  .then(async (id) => {
                    await ensureScorerAssignment(id);
                    setLive({
                      ...defaultLiveState,
                      strikerName: striker?.name ?? defaultLiveState.strikerName,
                      nonStrikerName: nonStriker?.name ?? defaultLiveState.nonStrikerName,
                      bowlerName: bowler?.name ?? defaultLiveState.bowlerName,
                      strikerId: state.strikerId ?? defaultLiveState.strikerId,
                      nonStrikerId: state.nonStrikerId ?? defaultLiveState.nonStrikerId,
                      bowlerId: state.bowlerId ?? defaultLiveState.bowlerId,
                      totalBallsAllotted: (matchSetup?.oversAllotted ?? 20) * 6,
                    });
                    setRealMatchId(id);
                    setScoringSession(newScoringSession(id));
                    setScreen("UX-10");
                  })
                  .catch((err) => setMatchSaveError(err instanceof Error ? err.message : String(err)))
                  .finally(() => setMatchSaving(false));
              }}
            />
          </>
        );
      case "UX-10":
        return (
          <LiveScoringScreen
            {...live}
            stateInputs={{
              legalBallsBowled: live.legalBallsBowled,
              isBetweenOvers: live.legalBallsBowled > 0 && live.legalBallsBowled % live.ballsPerOver === 0,
              isInningsBreak: false,
              isPaused: false,
              isReconciliationBlocked: false,
              isComplete: live.legalBallsBowled >= live.totalBallsAllotted,
            }}
            onScoreBall={() => openSub("UX-11")}
            onRecordWicket={() => openSub("UX-12")}
            onRecordExtra={() => openSub("UX-13")}
            onUndoLast={() => openSub("UX-18")}
            onPause={() => openSub("UX-19")}
            onOpenBallByBall={() => openSub("UX-21")}
            onOpenScorecard={() => openSub("UX-20")}
            onReviewStrike={() => openSub("UX-14")}
          />
        );
      case "UX-11":
        return (
          <>
            {deliveryError && (
              <p role="alert" style={{ color: "#b91c1c" }}>
                Real delivery was rejected: {deliveryError}
              </p>
            )}
            <BallEntryScreen
              isFreeHit={false}
              isGuardrailModalOpen={false}
              justRecorded={false}
              undoAvailable={live.legalBallsBowled > 0}
              overthrowConfirmThreshold={4}
              onSubmit={(totalRuns) => {
                setDeliveryError(null);
                pushDeliveryEvent(totalRuns).then((result) => {
                  if (result.outcome === "rejected") {
                    setDeliveryError(result.detail);
                    return;
                  }
                  setLive((l) => ({
                    ...l,
                    runs: l.runs + totalRuns,
                    legalBallsBowled: l.legalBallsBowled + 1,
                    lastBallAnnouncement: `${totalRuns} run${totalRuns === 1 ? "" : "s"}. ${l.runs + totalRuns} for ${l.wickets}.`,
                  }));
                  backToHub();
                });
              }}
              onUndo={backToHub}
            />
          </>
        );
      case "UX-12":
        return (
          <WicketEntryScreen
            legality="LEGAL"
            isFreeHit={false}
            strikerId="striker-1"
            battingXiNotOut={battingXi.length > 0 ? battingXi : [{ id: "striker-1", name: live.strikerName }]}
            fieldingXi={fieldingXi.length > 0 ? fieldingXi : [{ id: "f1", name: live.bowlerName }]}
            endsInnings={false}
            onConfirm={() => {
              setLive((l) => ({
                ...l,
                wickets: l.wickets + 1,
                legalBallsBowled: l.legalBallsBowled + 1,
                lastBallAnnouncement: `Wicket! ${l.runs} for ${l.wickets + 1}.`,
              }));
              backToHub();
            }}
            onCancel={backToHub}
          />
        );
      case "UX-13":
        return <ExtrasScreen enabledTypes={extrasEnabledTypes} onConfirm={backToHub} onCancel={backToHub} />;
      case "UX-14":
        return (
          <StrikeChangeScreen
            striker={{ id: "striker", name: live.strikerName }}
            nonStriker={{ id: "non-striker", name: live.nonStrikerName }}
            readOnly={false}
            onOverrideConfirmed={() => {
              setLive((l) => ({ ...l, strikerName: l.nonStrikerName, nonStrikerName: l.strikerName }));
              backToHub();
            }}
          />
        );
      case "UX-15":
        return (
          <BowlerChangeScreen
            candidates={bowlerChangeCandidates}
            previousOverBowlerId="b1"
            bowlerOverCap={4}
            ballsPerOver={6}
            isAuthorisedToOverride={true}
            onConfirm={backToHub}
          />
        );
      case "UX-16":
        return <OverCompletionScreen summary={overCompletionSummary} ballsPerOver={6} onAcknowledge={backToHub} onJumpToCorrection={() => setScreen("UX-17")} />;
      case "UX-17":
        return <ScoreCorrectionScreen cascadeSummary={scoreCorrectionCascade} isFinal={false} hasElevatedRole={false} onSave={backToHub} onCancel={backToHub} />;
      case "UX-18":
        return (
          <UndoRedoControl
            hasRecentAction={live.legalBallsBowled > 0}
            isGuardrailModalOpen={false}
            canFullyReverse={true}
            mostRecentActionLabel={live.lastBallAnnouncement}
            onUndoApplied={() => {
              setLive((l) => ({ ...l, legalBallsBowled: Math.max(0, l.legalBallsBowled - 1) }));
              backToHub();
            }}
            onRedoApplied={backToHub}
            onRouteToCorrection={() => setScreen("UX-17")}
          />
        );
      case "UX-19":
        return <MatchPauseControl onPaused={() => {}} onResumed={backToHub} />;
      case "UX-20":
        return (
          <ScorecardScreen
            battingOrder={demoBattingOrder(live)}
            bowlingLines={demoBowlingLines(live)}
            inningsState={{ totalRuns: live.runs, byes: live.extras.byes, legByes: live.extras.legByes, wides: live.extras.wides, noBalls: live.extras.noBalls, penalty: live.extras.penalties, wicketsLost: live.wickets, legalBallsBowled: live.legalBallsBowled }}
            ballsPerOver={live.ballsPerOver}
            partnerships={[]}
            fallOfWickets={[]}
            result="In progress"
            reconciliationStatus="PENDING"
            isFinal={false}
          />
        );
      case "UX-21":
        return (
          <BallByBallScreen
            deliveries={ballByBallDeliveries}
            bowlerOptions={[{ id: "b1", name: live.bowlerName }]}
            batterOptions={[{ id: "s1", name: live.strikerName }]}
            hasUserScrolledUp={false}
            onSelectDelivery={() => {}}
            onJumpToDelivery={() => {}}
          />
        );
      case "UX-22":
        return (
          <MatchSummaryScreen
            resultHeadline={`${battingSideName} vs ${fieldingSideName} — ${live.runs} for ${live.wickets}`}
            checks={matchSummaryChecks}
            actorRole="HEAD_SCORER"
            previousVersion={0}
            isSignedFinal={false}
            onSignedOff={() => {
              resetFlowState();
              setScreen("UX-26");
            }}
          />
        );
      case "UX-23":
        return (
          <OfflineModeIndicator
            isOnline={live.isOnline}
            isBackendReachable={true}
            isSyncing={false}
            queuedCount={3}
            lastSyncedTime="2026-09-28 10:00"
            storageUsageLabel="12 MB"
            onRetryConnection={() => {}}
            onJumpToSyncStatus={() => setScreen("UX-24")}
            onManageStorage={() => setScreen("UX-27")}
          />
        );
      case "UX-24":
        return (
          <SyncStatusScreen
            isOnline={true}
            isBackendReachable={true}
            isSyncing={false}
            rejectedCount={0}
            outcomes={syncStatusOutcomes}
            eventBallReference={() => null}
            globalQueueDepth={0}
            lastFullSyncTimestamp="2026-09-28 10:00"
            hasNeverSynced={false}
            onTriggerManualSync={() => {}}
            onRetryFailedBatch={() => {}}
            onViewEventDetail={() => {}}
            onSignIn={() => {}}
          />
        );
      case "UX-25":
        return <FenceConflictScreen otherDeviceId="device-42" conflictDetectedAt="2026-09-28 10:00" onResolved={() => setScreen(returnTo ?? "UX-26")} />;
      case "UX-26":
        return (
          <>
            {matchHistoryError && (
              <p role="alert" style={{ color: "#b91c1c" }}>
                Failed to load real match history: {matchHistoryError}
              </p>
            )}
            <MatchHistoryScreen
              matches={realMatches}
              isLoading={matchHistoryLoading}
              isOffline={false}
              onOpenMatch={() => {
                setReturnTo(null);
                setLive(defaultLiveState);
                setScreen("UX-10");
              }}
              onCreateMatch={() => {
                resetFlowState();
                setScreen("UX-04");
              }}
            />
          </>
        );
      case "UX-27":
        return (
          <SettingsScreen
            dateFormat="DD/MM/YYYY"
            matchTimeZone="Europe/London"
            onChangeDateFormat={() => {}}
            onChangeMatchTimeZone={() => {}}
            highContrastEnabled={false}
            onToggleHighContrast={() => {}}
            sunlightModeEnabled={false}
            onToggleSunlightMode={() => {}}
            confirmationsEnabled={true}
            onToggleConfirmations={() => {}}
            hapticsEnabled={true}
            onToggleHaptics={() => {}}
            storageUsedBytes={100}
            storageTotalBytes={1000}
            onPurgeStorage={() => {}}
            onChangePassword={() => {}}
            onExportPersonalData={() => {}}
            onDeleteAccount={() => {}}
            onSignOut={() => {
              resetFlowState();
              setScreen("UX-26");
            }}
            isOffline={false}
          />
        );
      case "UX-28":
        return (
          <AdministrationScreen
            isOrgAdmin={true}
            isPlatformAdmin={false}
            activeImpersonation={null}
            onEndImpersonation={() => {}}
            members={adminMembers}
            onInviteMember={() => {}}
            onChangeRoles={() => {}}
            onDeactivateMember={() => {}}
            featureFlags={[]}
            onToggleFeatureFlag={() => {}}
            referenceDataVersions={["v1"]}
            onPublishReferenceData={() => {}}
            impersonationConsents={{}}
            onStartImpersonation={() => {}}
            currentAdminId="admin-1"
            now="2026-09-28T00:00:00Z"
            isOffline={false}
          />
        );
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid #ccc", padding: "8px 16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 16, margin: 0 }}>KenCric</h1>
          <span style={{ fontSize: 12, color: "#666" }}>
            Real backend — signed in as {session.user.email}. Match History reads real data; everything else is still demo. Screen: {screen}
          </span>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            style={{ fontSize: 12, padding: "2px 8px", marginLeft: "auto", cursor: "pointer" }}
          >
            Sign out
          </button>
        </div>
        <nav style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {topNav.map((item) => (
            <button
              key={item.screen}
              type="button"
              onClick={() => openSub(item.screen)}
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 4,
                border: "1px solid #ccc",
                background: screen === item.screen ? "#2563eb" : "#fff",
                color: screen === item.screen ? "#fff" : "#111",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        {returnTo !== null && (
          <button
            type="button"
            onClick={backToHub}
            style={{ marginBottom: 16, fontSize: 13, padding: "4px 10px", borderRadius: 4, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
          >
            ← Back
          </button>
        )}
        {renderScreen()}
      </main>
    </div>
  );
}

export function App() {
  return <AuthGate>{(session) => <AppShell session={session} />}</AuthGate>;
}

function demoBattingOrder(live: LiveState): BattingOrderEntry[] {
  return [
    { playerId: "striker", playerName: live.strikerName, line: { playerId: "striker", runs: Math.ceil(live.runs / 2), ballsFaced: Math.max(1, Math.ceil(live.legalBallsBowled / 2)), fours: 0, sixes: 0, status: "NOT_OUT" } },
    { playerId: "non-striker", playerName: live.nonStrikerName, line: { playerId: "non-striker", runs: Math.floor(live.runs / 2), ballsFaced: Math.max(0, Math.floor(live.legalBallsBowled / 2)), fours: 0, sixes: 0, status: "NOT_OUT" } },
  ];
}

function demoBowlingLines(live: LiveState) {
  return [
    { playerId: "bowler", playerName: live.bowlerName, legalBallsBowled: live.legalBallsBowled, runsCharged: live.runs, wickets: live.wickets, widesBowled: live.extras.wides, noBallsBowled: live.extras.noBalls, maidens: 0 },
  ];
}
