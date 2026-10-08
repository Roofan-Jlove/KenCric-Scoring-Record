// Real event-sourced writes to match_events, via the real POST
// /sync/events pipeline (database/supabase/functions/sync-events).
//
// No canonical hash-computation format is documented anywhere in this
// entire backlog -- explicitly flagged as a standing gap by TASK-0028/
// 0035/0142/0146, each declining to invent one. The server itself
// (ingestPushBatch.ts) only verifies hash CONTINUITY (each event's own
// prevHash must equal the previous stored hash for that stream) -- it
// never independently recomputes/verifies the hash against any
// "correct" algorithm. That makes a self-consistent, client-invented
// scheme sufficient and safe: SHA-256 (real Web Crypto, not a
// placeholder) over a canonical JSON object, the same shape TASK-0146's
// own computeAuditLogHash already established for audit_log's
// identical gap. GENESIS is this app's own convention for a stream's
// first event -- the server accepts any prevHash on a brand-new stream
// (confirmed directly: ingestPushBatch.ts's own check is skipped when
// store.lastHash() returns null), so GENESIS is never actually verified
// against anything; it exists only so this code never sends a blank
// string.
export const GENESIS_HASH = "GENESIS";

export async function computeEventHash(prevHash: string, eventId: string, payload: unknown): Promise<string> {
  const canonical = JSON.stringify({ prevHash, eventId, payload });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ScoringSession {
  matchId: string;
  scorerStreamId: string;
  deviceId: string;
  fenceValue: string;
  nextDeviceSeq: number;
  lastHash: string;
}

export function newScoringSession(matchId: string): ScoringSession {
  return {
    matchId,
    scorerStreamId: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
    // Any value is accepted as the fence for a brand-new match (no
    // fence has ever been acquired for it yet) -- confirmed directly
    // in writerFence.ts's own checkWriterFence.
    fenceValue: crypto.randomUUID(),
    nextDeviceSeq: 0,
    lastHash: GENESIS_HASH,
  };
}
