import type { ParticipantId } from "../../shared/types.ts";
import { isParticipantId } from "../../shared/constants.ts";

const STORAGE_KEY = "decision-wheel-seat";

export function readSeat(): ParticipantId | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value && isParticipantId(value) ? value : null;
}

export function writeSeat(id: ParticipantId): void {
  localStorage.setItem(STORAGE_KEY, id);
}

export function clearSeat(): void {
  localStorage.removeItem(STORAGE_KEY);
}
