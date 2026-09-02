import { MS_PER_DAY } from "../../../shared/constants.ts";

export function daysSince(isoDate: string | null, now: Date): number | null {
  if (!isoDate) return null;
  const then = Date.parse(isoDate);
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / MS_PER_DAY);
}

export function isDue(lastVisitedAt: string | null, now: Date, dueAfterDays: number): boolean {
  if (!lastVisitedAt) return true;
  const elapsed = daysSince(lastVisitedAt, now);
  if (elapsed === null) return true;
  return elapsed >= dueAfterDays;
}
