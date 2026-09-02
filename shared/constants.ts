export const PARTICIPANT_IDS = ["a", "b"] as const;

export const DEFAULT_DUE_AFTER_DAYS = 21;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_PORT = 3000;
export const DEFAULT_HOST = "0.0.0.0";
export const EXTRA_WHEEL_SPINS = 6;

export function isParticipantId(value: string): value is "a" | "b" {
  return value === "a" || value === "b";
}
