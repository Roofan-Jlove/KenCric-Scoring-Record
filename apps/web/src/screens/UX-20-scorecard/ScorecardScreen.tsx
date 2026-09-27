import {
  formatEconomy,
  formatExtrasLine,
  formatOvers,
  formatStrikeRate,
  formatTotalLine,
  hasBatted,
  type BatterCardLine,
  type BowlerCardLine,
  type InningsScoreState,
} from "./scorecardFormatting";

/**
 * TASK-0075: `ux-specification.md UX-20` -- Scorecard. Styling not
 * applied, same scope boundary as every earlier screen this session.
 *
 * `partnerships`/`fallOfWickets`/`result`/`reconciliationStatus`/
 * `isFinal` are caller-supplied -- no aggregation logic for those
 * exists anywhere in `shared/` yet (see this task's own backlog entry).
 * Real table semantics (`<table>`/`<th scope>`) satisfy `UX-20`'s own
 * Accessibility text ("row/column headers so a screen reader can
 * navigate cell by cell").
 */

export interface Player {
  id: string;
  name: string;
}

export interface PartnershipLine {
  wicketNumber: number;
  pair: [string, string];
  runs: number;
  balls: number;
}

export interface FallOfWicketLine {
  wicketNumber: number;
  runs: number;
  batterName: string;
  overBall: string;
}

export type ReconciliationStatus = "RECONCILED" | "PENDING" | "OVERRIDE_NOTED";

export interface BattingOrderEntry {
  playerId: string;
  playerName: string;
  /** `null` when this batter hasn't come in yet -- distinct from a real 0-off-0 duck (`B-J1`). */
  line: BatterCardLine | null;
}

export interface ScorecardScreenProps {
  battingOrder: readonly BattingOrderEntry[];
  bowlingLines: readonly (BowlerCardLine & { playerName: string })[];
  inningsState: InningsScoreState;
  ballsPerOver: number;
  partnerships: readonly PartnershipLine[];
  fallOfWickets: readonly FallOfWicketLine[];
  result: string;
  reconciliationStatus: ReconciliationStatus;
  isFinal: boolean;
}

function statusLabel(status: ReconciliationStatus): string {
  switch (status) {
    case "RECONCILED":
      return "Reconciled";
    case "PENDING":
      return "Pending";
    case "OVERRIDE_NOTED":
      return "Override-noted";
  }
}

export function ScorecardScreen({
  battingOrder,
  bowlingLines,
  inningsState,
  ballsPerOver,
  partnerships,
  fallOfWickets,
  result,
  reconciliationStatus,
  isFinal,
}: ScorecardScreenProps) {
  return (
    <div>
      <p role="status">{isFinal ? "Official" : "Provisional"}</p>
      <p aria-label="Reconciliation status">{statusLabel(reconciliationStatus)}</p>

      <table aria-label="Batting card">
        <thead>
          <tr>
            <th scope="col">Batter</th>
            <th scope="col">How out</th>
            <th scope="col">R</th>
            <th scope="col">B</th>
            <th scope="col">4s</th>
            <th scope="col">6s</th>
            <th scope="col">SR</th>
          </tr>
        </thead>
        <tbody>
          {battingOrder
            .filter((entry) => hasBatted(entry.line))
            .map((entry) => {
              const line = entry.line as BatterCardLine;
              const sr = formatStrikeRate(line.runs, line.ballsFaced);
              return (
                <tr key={entry.playerId}>
                  <th scope="row">
                    {entry.playerName}
                    {line.status === "NOT_OUT" ? "*" : ""}
                  </th>
                  <td>{line.status}</td>
                  <td>{line.runs}</td>
                  <td>{line.ballsFaced}</td>
                  <td>{line.fours}</td>
                  <td>{line.sixes}</td>
                  <td>{sr !== null ? sr.toFixed(2) : "—"}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
      <p>{formatExtrasLine(inningsState)}</p>
      <p>{formatTotalLine(inningsState, ballsPerOver)}</p>

      {battingOrder.some((entry) => !hasBatted(entry.line)) && (
        <p aria-label="Did not bat">
          Did not bat: {battingOrder.filter((entry) => !hasBatted(entry.line)).map((entry) => entry.playerName).join(", ")}
        </p>
      )}

      <table aria-label="Bowling card">
        <thead>
          <tr>
            <th scope="col">Bowler</th>
            <th scope="col">O</th>
            <th scope="col">M</th>
            <th scope="col">R</th>
            <th scope="col">W</th>
            <th scope="col">NB</th>
            <th scope="col">WD</th>
            <th scope="col">Econ</th>
          </tr>
        </thead>
        <tbody>
          {bowlingLines.map((line) => {
            const econ = formatEconomy(line.runsCharged, line.legalBallsBowled, ballsPerOver);
            return (
              <tr key={line.playerId}>
                <th scope="row">{line.playerName}</th>
                <td>{formatOvers(line.legalBallsBowled, ballsPerOver)}</td>
                <td>{line.maidens}</td>
                <td>{line.runsCharged}</td>
                <td>{line.wickets}</td>
                <td>{line.noBallsBowled}</td>
                <td>{line.widesBowled}</td>
                <td>{econ !== null ? econ.toFixed(2) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <table aria-label="Fall of wickets">
        <thead>
          <tr>
            <th scope="col">Wicket</th>
            <th scope="col">Score</th>
            <th scope="col">Batter</th>
            <th scope="col">Over.ball</th>
          </tr>
        </thead>
        <tbody>
          {fallOfWickets.map((fow) => (
            <tr key={fow.wicketNumber}>
              <th scope="row">{fow.wicketNumber}</th>
              <td>{fow.runs}</td>
              <td>{fow.batterName}</td>
              <td>{fow.overBall}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table aria-label="Partnerships">
        <thead>
          <tr>
            <th scope="col">Wicket</th>
            <th scope="col">Pair</th>
            <th scope="col">Runs</th>
            <th scope="col">Balls</th>
          </tr>
        </thead>
        <tbody>
          {partnerships.map((p) => (
            <tr key={p.wicketNumber}>
              <th scope="row">{p.wicketNumber}</th>
              <td>{p.pair.join(" & ")}</td>
              <td>{p.runs}</td>
              <td>{p.balls}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p aria-label="Result">{result}</p>
    </div>
  );
}
