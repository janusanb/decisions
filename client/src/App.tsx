import { useMemo, useState } from "react";
import type { ParticipantId } from "../../shared/types.ts";
import { api } from "./api.ts";
import { Backup } from "./components/Backup.tsx";
import { LanHint } from "./components/LanHint.tsx";
import { History } from "./components/History.tsx";
import { Places } from "./components/Places.tsx";
import { SeatGate } from "./components/SeatGate.tsx";
import { Session } from "./components/Session.tsx";
import { clearSeat, readSeat, writeSeat } from "./seat.ts";
import { useAppState } from "./useAppState.ts";

export function App() {
  const [seat, setSeat] = useState<ParticipantId | null>(() => readSeat());
  const { state, error, loading, setError } = useAppState(seat);
  const [draft, setDraft] = useState<{ sessionId: string; choices: string[] } | null>(null);

  const selected = useMemo(() => {
    if (state?.session?.status === "open" && draft?.sessionId === state.session.id) {
      return draft.choices;
    }
    return state?.session?.you.choices ?? [];
  }, [draft, state?.session]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selecting = Boolean(
    state?.session && state.session.status === "open" && !state.session.you.locked,
  );

  function chooseSeat(id: ParticipantId) {
    writeSeat(id);
    setSeat(id);
  }

  async function togglePlace(id: string) {
    if (!seat || !state?.session || state.session.you.locked) return;
    const next = selectedSet.has(id) ? selected.filter((item) => item !== id) : [...selected, id];
    setDraft({ sessionId: state.session.id, choices: next });
    try {
      await api.saveChoices(seat, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your picks.");
    }
  }

  if (!seat) {
    return (
      <>
        <SeatGate onChoose={chooseSeat} />
        <LanHint />
      </>
    );
  }

  if (loading && !state) {
    return (
      <main className="gate">
        <p className="eyebrow">Decision Wheel</p>
        <h1>Lighting the lamps…</h1>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="gate">
        <p className="eyebrow">Decision Wheel</p>
        <h1>{error ?? "Could not reach the host."}</h1>
        <button type="button" className="btn btn-chili" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  }

  const you = state.participants.find((person) => person.id === seat);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Shared on this LAN</p>
          <h1>Decision Wheel</h1>
        </div>
        <form
          className="you-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const name = String(data.get("name") ?? "");
            void api.rename(seat, name).catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Could not rename.");
            });
          }}
        >
          <label>
            This seat
            <input name="name" defaultValue={you?.name ?? ""} maxLength={40} key={you?.name} />
          </label>
          <button type="submit" className="text-btn">
            Save name
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              clearSeat();
              setSeat(null);
            }}
          >
            Switch seat
          </button>
        </form>
      </header>

      {error ? (
        <p className="toast" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="layout">
        <Session participantId={seat} state={state} selected={selectedSet} onError={setError} />
        <Places
          participantId={seat}
          state={state}
          selected={selectedSet}
          selecting={selecting}
          onToggle={(id) => void togglePlace(id)}
          onError={setError}
        />
        <History participantId={seat} state={state} onError={setError} />
        <Backup participantId={seat} onError={setError} />
      </div>

      <LanHint />
    </div>
  );
}
