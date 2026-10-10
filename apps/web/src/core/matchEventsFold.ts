import { supabase } from "./supabaseClient";

// Reads real `match_events` and folds them into display shapes for
// Ball-by-Ball (UX-21) and Scorecard (UX-20). This is a DELIBERATELY
// SIMPLIFIED fold, not a port of the real fold engine
// (shared/.../core/pipeline/InningsFolder.kt, never ported to
// TypeScript for the same toolchain reason every other Kotlin-only
// module in this backlog remains unported) -- it does not model
// strike rotation, retired-hurt, partnerships, fall-of-wickets timing,
// maidens, or phase (powerplay/middle/death) boundaries. It exists to
// prove these two screens can show REAL data instead of demo data, not
// to re-implement the scoring engine a second time in a second
// language. Every simplification is flagged inline, not hidden.

interface RawEvent {
  event_id: string;
  type: string;
  payload: Record<string, unknown>;
  voids: string | null;
  event_ordinal: number;
}

export async function fetchRealMatchEvents(matchId: string): Promise<RawEvent[]> {
  const { data, error } = await supabase
    .from("match_events")
    .select("event_id,type,payload,voids,event_ordinal")
    .eq("match_id", matchId)
    .order("event_ordinal", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RawEvent[];
}

// A delivery voided by a later DELIVERY_VOIDED event is excluded
// entirely -- the real refold semantics (live-scoring.md §18.1) remove
// it from the active history, not mark it specially.
function activeDeliveryEvents(events: RawEvent[]): RawEvent[] {
  const voidedIds = new Set(events.filter((e) => e.voids).map((e) => e.voids as string));
  return events.filter((e) => e.type === "DELIVERY_RECORDED" && !voidedIds.has(e.event_id));
}

interface RunEventLike {
  origin: string;
  value: number;
  method: string;
}

function runEventsOf(payload: Record<string, unknown>): RunEventLike[] {
  return (payload.runEvents as RunEventLike[] | undefined) ?? [];
}

function totalRuns(runEvents: RunEventLike[]): number {
  return runEvents.reduce((sum, e) => sum + e.value, 0);
}

export interface FoldedDelivery {
  id: string;
  overNumber: number;
  ballInOver: number;
  bowlerId: string;
  strikerId: string;
  runs: number;
  isBoundary: boolean;
  wicketDescription: string | null;
  extraDescription: string | null;
}

// over/ball numbering: a running legal-ball counter, one-indexed within
// each over of `ballsPerOver` legal balls -- BYE/LEG_BYE deliveries
// still carry legality "LEGAL" in this app's own payload construction
// (ExtrasDecomposer-derived), so a single `legality === "LEGAL"` check
// correctly covers both plain deliveries and byes/leg-byes; only
// WIDE/NO_BALL don't consume a ball, matching BR-034/BR-035 exactly.
export function foldBallByBall(events: RawEvent[], ballsPerOver: number): FoldedDelivery[] {
  const active = activeDeliveryEvents(events);
  let legalBallCount = 0;
  return active.map((e) => {
    const payload = e.payload;
    const runEvents = runEventsOf(payload);
    const legality = payload.legality as string;
    if (legality === "LEGAL") legalBallCount += 1;
    const displayBall = legality === "LEGAL" ? legalBallCount : legalBallCount + 1;
    const wicket = payload.wicket as { mode: string } | undefined;
    const extraOrigins = runEvents.filter((r) => r.origin !== "OFF_BAT").map((r) => `${r.value} ${r.origin.toLowerCase()}`);
    return {
      id: e.event_id,
      overNumber: Math.floor((displayBall - 1) / ballsPerOver) + 1,
      ballInOver: ((displayBall - 1) % ballsPerOver) + 1,
      bowlerId: payload.bowlerId as string,
      strikerId: payload.strikerBatterId as string,
      runs: totalRuns(runEvents),
      isBoundary: runEvents.some((r) => r.method === "BOUNDARY"),
      wicketDescription: wicket ? wicket.mode : null,
      extraDescription: extraOrigins.length > 0 ? extraOrigins.join(", ") : null,
    };
  });
}

export interface FoldedInnings {
  totalRuns: number;
  byes: number;
  legByes: number;
  wides: number;
  noBalls: number;
  penalty: number;
  wicketsLost: number;
  legalBallsBowled: number;
  battingLines: { playerId: string; runs: number; ballsFaced: number; fours: number; sixes: number; status: "NOT_OUT" | "OUT" }[];
  bowlingLines: { playerId: string; legalBallsBowled: number; runsCharged: number; wickets: number; widesBowled: number; noBallsBowled: number }[];
}

// Bowler's own runs-conceded total excludes byes/leg-byes (never the
// bowler's fault, BR-034/035's own framing) -- wides/no-ball-penalty
// ARE charged, the standard convention this fold follows without
// re-deriving from any specific cited rule (flagged, not cited, since
// no V-rule in this backlog states the charging convention explicitly).
const BOWLER_CHARGED_ORIGINS = new Set(["OFF_BAT", "WIDE", "NO_BALL_PENALTY", "NO_BALL_BAT"]);

export function foldScorecard(events: RawEvent[]): FoldedInnings {
  const active = activeDeliveryEvents(events);
  const result: FoldedInnings = {
    totalRuns: 0,
    byes: 0,
    legByes: 0,
    wides: 0,
    noBalls: 0,
    penalty: 0,
    wicketsLost: 0,
    legalBallsBowled: 0,
    battingLines: [],
    bowlingLines: [],
  };
  const battingById = new Map<string, FoldedInnings["battingLines"][number]>();
  const bowlingById = new Map<string, FoldedInnings["bowlingLines"][number]>();

  for (const e of active) {
    const payload = e.payload;
    const runEvents = runEventsOf(payload);
    const legality = payload.legality as string;
    const strikerId = payload.strikerBatterId as string;
    const bowlerId = payload.bowlerId as string;
    const wicket = payload.wicket as { outBatterId: string } | undefined;

    if (legality === "LEGAL") result.legalBallsBowled += 1;
    if (wicket) result.wicketsLost += 1;

    if (!battingById.has(strikerId)) battingById.set(strikerId, { playerId: strikerId, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, status: "NOT_OUT" });
    if (!bowlingById.has(bowlerId)) bowlingById.set(bowlerId, { playerId: bowlerId, legalBallsBowled: 0, runsCharged: 0, wickets: 0, widesBowled: 0, noBallsBowled: 0 });
    const battingLine = battingById.get(strikerId)!;
    const bowlingLine = bowlingById.get(bowlerId)!;

    if (legality === "LEGAL") {
      battingLine.ballsFaced += 1;
      bowlingLine.legalBallsBowled += 1;
    }
    if (legality === "NO_BALL") bowlingLine.noBallsBowled += 1;
    if (wicket) {
      bowlingLine.wickets += 1;
      const outLine = battingById.get(wicket.outBatterId);
      if (outLine) outLine.status = "OUT";
      else battingById.set(wicket.outBatterId, { playerId: wicket.outBatterId, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, status: "OUT" });
    }

    for (const r of runEvents) {
      result.totalRuns += r.value;
      if (r.origin === "BYE") result.byes += r.value;
      else if (r.origin === "LEG_BYE") result.legByes += r.value;
      else if (r.origin === "WIDE") result.wides += r.value;
      else if (r.origin.startsWith("NO_BALL")) result.noBalls += r.value;
      else if (r.origin === "PENALTY") result.penalty += r.value;

      if (r.origin === "OFF_BAT") {
        battingLine.runs += r.value;
        if (r.method === "BOUNDARY" && r.value === 4) battingLine.fours += 1;
        if (r.method === "BOUNDARY" && r.value === 6) battingLine.sixes += 1;
      }
      if (r.origin === "WIDE") bowlingLine.widesBowled += r.value;
      if (BOWLER_CHARGED_ORIGINS.has(r.origin)) bowlingLine.runsCharged += r.value;
    }
  }

  result.battingLines = Array.from(battingById.values());
  result.bowlingLines = Array.from(bowlingById.values());
  return result;
}
