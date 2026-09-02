import { useCallback, useEffect, useState } from "react";
import type { AppState, ParticipantId } from "../../shared/types.ts";
import { api } from "./api.ts";

export function useAppState(participantId: ParticipantId | null) {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!participantId) return;
    try {
      const next = await api.state(participantId);
      setState(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Decision Wheel.");
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useEffect(() => {
    if (!participantId) return undefined;

    const events = new EventSource("/api/events");
    const frame = window.setTimeout(() => {
      void refresh();
    }, 0);
    const onState = () => {
      void refresh();
    };
    events.addEventListener("state", onState);

    return () => {
      window.clearTimeout(frame);
      events.removeEventListener("state", onState);
      events.close();
    };
  }, [participantId, refresh]);

  return {
    state: participantId ? state : null,
    error: participantId ? error : null,
    loading: Boolean(participantId) && loading,
    refresh,
    setError,
  };
}
