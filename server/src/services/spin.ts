import { EXTRA_WHEEL_SPINS } from "../../../shared/constants.ts";

export type TicketMap = Map<string, number>;

export type Slice = {
  restaurantId: string;
  tickets: number;
  probability: number;
  sliceStartDegrees: number;
  sliceAngleDegrees: number;
};

export function uniqueChoices(restaurantIds: string[]): string[] {
  return [...new Set(restaurantIds)];
}

export function buildTickets(choiceLists: string[][]): TicketMap {
  const tickets: TicketMap = new Map();
  for (const list of choiceLists) {
    for (const id of uniqueChoices(list)) {
      tickets.set(id, (tickets.get(id) ?? 0) + 1);
    }
  }
  return tickets;
}

export function totalTickets(tickets: TicketMap): number {
  let total = 0;
  for (const count of tickets.values()) total += count;
  return total;
}

export function excludePrevious(tickets: TicketMap, previousId: string | null): TicketMap {
  if (!previousId || !tickets.has(previousId) || tickets.size <= 1) {
    return new Map(tickets);
  }
  const next = new Map(tickets);
  next.delete(previousId);
  return next;
}

export function sortedTicketEntries(
  tickets: TicketMap,
  names: Map<string, string>,
): Array<[string, number]> {
  return [...tickets.entries()].sort((a, b) => {
    const nameA = names.get(a[0]) ?? a[0];
    const nameB = names.get(b[0]) ?? b[0];
    const byName = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    return byName !== 0 ? byName : a[0].localeCompare(b[0]);
  });
}

export function layoutSlices(tickets: TicketMap, names: Map<string, string>): Slice[] {
  const entries = sortedTicketEntries(tickets, names);
  const total = totalTickets(tickets);
  if (total === 0) return [];

  let cursor = 0;
  return entries.map(([restaurantId, count]) => {
    const sliceAngleDegrees = (count / total) * 360;
    const slice: Slice = {
      restaurantId,
      tickets: count,
      probability: count / total,
      sliceStartDegrees: cursor,
      sliceAngleDegrees,
    };
    cursor += sliceAngleDegrees;
    return slice;
  });
}

export function pickWeighted(tickets: TicketMap, random: () => number = Math.random): string {
  const entries = [...tickets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const total = totalTickets(tickets);
  if (total === 0) {
    throw new Error("NO_CANDIDATES");
  }

  let remaining = random() * total;
  for (const [id, count] of entries) {
    remaining -= count;
    if (remaining < 0) return id;
  }
  return entries[entries.length - 1]![0];
}

export function rotationForResult(
  slices: Slice[],
  resultId: string,
  random: () => number = Math.random,
  extraSpins = EXTRA_WHEEL_SPINS,
): number {
  const slice = slices.find((item) => item.restaurantId === resultId);
  if (!slice) {
    throw new Error("RESULT_NOT_IN_SLICES");
  }

  const padding = Math.min(6, slice.sliceAngleDegrees * 0.18);
  const usable = Math.max(slice.sliceAngleDegrees - padding * 2, slice.sliceAngleDegrees * 0.4);
  const landing = slice.sliceStartDegrees + padding + random() * usable;
  return extraSpins * 360 + (360 - landing);
}
