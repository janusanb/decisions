import type { AppState, ParticipantId } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { Wheel } from "./Wheel.tsx";

type SessionProps = {
  participantId: ParticipantId;
  state: AppState;
  selected: Set<string>;
  onError: (message: string) => void;
};

export function Session({ participantId, state, selected, onError }: SessionProps) {
  const session = state.session;
  const you = state.participants.find((person) => person.id === participantId);
  const other = state.participants.find((person) => person.id !== participantId);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      onError(error instanceof Error ? error.message : "That action failed.");
    }
  }

  if (!session) {
    return (
      <section className="panel session">
        <header className="panel-head">
          <p className="eyebrow">Tonight’s round</p>
          <h2>No wheel yet</h2>
        </header>
        <p className="lede">
          Start a round when you are both ready. Each of you will privately ticket the places you
          want, then the wheel is built from those tickets.
        </p>
        <button
          type="button"
          className="btn btn-chili"
          data-testid="start-round"
          onClick={() => void run(() => api.startSession(participantId))}
        >
          Start a round
        </button>
      </section>
    );
  }

  if (session.status === "open") {
    return (
      <section className="panel session">
        <header className="panel-head">
          <p className="eyebrow">Sealed tickets</p>
          <h2>Build the wheel</h2>
        </header>
        <div className="status-row">
          <span className={session.you.locked ? "stool is-ready" : "stool"}>
            {you?.name ?? "You"} {session.you.locked ? "locked in" : "still choosing"}
          </span>
          <span className={session.other.locked ? "stool is-ready" : "stool"}>
            {session.other.name} {session.other.locked ? "locked in" : "still choosing"}
          </span>
        </div>
        <p className="lede">
          Check every place you would accept. If you both ticket the same kitchen, it earns a larger
          slice.
          {other ? ` ${other.name} cannot see your list until you both lock in.` : null}
        </p>
        <p className="ticket-count" data-testid="your-ticket-count">
          {selected.size} ticket{selected.size === 1 ? "" : "s"} on your stub
        </p>
        <div className="action-row">
          {session.you.locked ? (
            <button
              type="button"
              className="btn btn-ink"
              onClick={() => void run(() => api.unlock(participantId))}
            >
              Unlock my picks
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-chili"
              data-testid="lock-picks"
              onClick={() =>
                void run(async () => {
                  await api.saveChoices(participantId, [...selected]);
                  await api.lock(participantId);
                })
              }
            >
              Lock in
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void run(() => api.cancel(participantId))}
          >
            Cancel round
          </button>
        </div>
      </section>
    );
  }

  const spinning = session.status === "spun" || session.status === "confirmed";

  return (
    <section className="panel session session-live">
      <header className="panel-head">
        <p className="eyebrow">
          {session.status === "revealed" ? "Odds are set" : "The house has spoken"}
        </p>
        <h2>{session.status === "revealed" ? "Spin when you are ready" : session.result?.name}</h2>
      </header>
      {session.skippedPrevious && session.previousResultName ? (
        <p className="skip-note">
          Last pick, {session.previousResultName}, is sitting this one out.
        </p>
      ) : null}
      {session.candidates ? (
        <Wheel
          candidates={session.candidates}
          rotationDegrees={session.result?.rotationDegrees ?? 0}
          spinning={spinning}
          resultName={session.status === "spun" ? session.result?.name : null}
        />
      ) : null}
      {session.candidates ? (
        <ul className="odds" data-testid="odds-list">
          {session.candidates.map((candidate) => (
            <li key={candidate.restaurantId}>
              <strong>{candidate.name}</strong>
              <span>
                {candidate.tickets} ticket{candidate.tickets === 1 ? "" : "s"} ·{" "}
                {Math.round(candidate.probability * 100)}%
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="action-row">
        {session.status === "revealed" ? (
          <button
            type="button"
            className="btn btn-chili"
            data-testid="spin-wheel"
            onClick={() => void run(() => api.spin(participantId))}
          >
            Spin
          </button>
        ) : null}
        {session.status === "spun" ? (
          <>
            <button
              type="button"
              className="btn btn-chili"
              data-testid="confirm-visit"
              onClick={() => void run(() => api.confirm(participantId))}
            >
              We went here
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void run(() => api.reject(participantId))}
            >
              Skip visit
            </button>
          </>
        ) : null}
        {session.status === "revealed" ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void run(() => api.cancel(participantId))}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}
