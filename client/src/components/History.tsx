import type { AppState, ParticipantId } from "../../../shared/types.ts";
import { api } from "../api.ts";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

type HistoryProps = {
  participantId: ParticipantId;
  state: AppState;
  onError: (message: string) => void;
};

export function History({ participantId, state, onError }: HistoryProps) {
  async function remove(id: string) {
    if (!confirm("Delete this visit? The due timer will use the remaining history.")) return;
    try {
      await api.deleteVisit(participantId, id);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not delete that visit.");
    }
  }

  return (
    <section className="panel history">
      <header className="panel-head">
        <p className="eyebrow">What actually happened</p>
        <h2>Visits</h2>
      </header>
      {state.visits.length === 0 ? (
        <p className="empty">No meals logged yet. Confirm a spin or tap “We went”.</p>
      ) : (
        <ol className="visit-list">
          {state.visits.map((visit) => (
            <li key={visit.id}>
              <time dateTime={visit.visitedAt}>{formatDate(visit.visitedAt)}</time>
              <strong>{visit.restaurantName}</strong>
              <span>{visit.source === "confirmed_spin" ? "Wheel" : "Manual"}</span>
              <button type="button" className="text-btn" onClick={() => void remove(visit.id)}>
                Forget
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
