import { useState } from "react";
import {
  hasActiveFilter,
  initialDeliveryFilter,
  matchesFilter,
  parseOverBallQuery,
  shouldAutoScrollToNewest,
  summarizeDelivery,
  type DeliveryFilter,
  type DeliverySummaryInput,
  type FilterableDelivery,
} from "./ballByBallForm";

/**
 * TASK-0077: `ux-specification.md UX-21` -- Ball-by-Ball. Styling not
 * applied, same scope boundary as every earlier screen this session.
 */

export interface Delivery extends DeliverySummaryInput, FilterableDelivery {
  id: string;
}

export interface Person {
  id: string;
  name: string;
}

export interface BallByBallScreenProps {
  deliveries: readonly Delivery[];
  bowlerOptions: readonly Person[];
  batterOptions: readonly Person[];
  hasUserScrolledUp: boolean;
  onSelectDelivery: (id: string) => void;
  onJumpToDelivery: (overNumber: number, ballInOver: number) => void;
}

export function BallByBallScreen({
  deliveries,
  bowlerOptions,
  batterOptions,
  hasUserScrolledUp,
  onSelectDelivery,
  onJumpToDelivery,
}: BallByBallScreenProps) {
  const [filter, setFilter] = useState<DeliveryFilter>(initialDeliveryFilter);
  const [jumpQuery, setJumpQuery] = useState("");
  const [jumpError, setJumpError] = useState<string | null>(null);

  const visibleDeliveries = deliveries.filter((d) => matchesFilter(d, filter));
  const autoScroll = shouldAutoScrollToNewest(hasUserScrolledUp);

  function handleClearFilters() {
    setFilter(initialDeliveryFilter());
  }

  function handleJump() {
    const parsed = parseOverBallQuery(jumpQuery);
    if (parsed === null) {
      setJumpError("Enter a valid over.ball, e.g. 12.4");
      return;
    }
    setJumpError(null);
    onJumpToDelivery(parsed.overNumber, parsed.ballInOver);
  }

  return (
    <div>
      <div role="group" aria-label="Filters">
        <label htmlFor="bowler-filter">Bowler</label>
        <select
          id="bowler-filter"
          value={filter.bowlerId ?? ""}
          onChange={(event) => setFilter((f) => ({ ...f, bowlerId: event.target.value || null }))}
        >
          <option value="">All</option>
          {bowlerOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <label htmlFor="batter-filter">Batter</label>
        <select
          id="batter-filter"
          value={filter.batterId ?? ""}
          onChange={(event) => setFilter((f) => ({ ...f, batterId: event.target.value || null }))}
        >
          <option value="">All</option>
          {batterOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {hasActiveFilter(filter) && (
          <button type="button" onClick={handleClearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <label htmlFor="jump-to-over">Jump to over.ball</label>
      <input id="jump-to-over" value={jumpQuery} onChange={(event) => setJumpQuery(event.target.value)} />
      <button type="button" onClick={handleJump}>
        Go
      </button>
      {jumpError && <p role="alert">{jumpError}</p>}

      {!autoScroll && <p role="status">New ball ↓</p>}

      {visibleDeliveries.length === 0 ? (
        <div>
          <p>No deliveries match the current filters</p>
        </div>
      ) : (
        <ul aria-label="Deliveries">
          {visibleDeliveries.map((delivery) => (
            <li key={delivery.id}>
              <button type="button" aria-label={summarizeDelivery(delivery)} onClick={() => onSelectDelivery(delivery.id)}>
                {summarizeDelivery(delivery)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
