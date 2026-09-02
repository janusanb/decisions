import { randomUUID } from "node:crypto";
import type { VisitSource } from "../../../shared/types.ts";
import type { Db } from "../db.ts";
import { badRequest, notFound } from "../errors.ts";
import { getRestaurant, nowIso } from "./queries.ts";

function parseVisitedAt(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw badRequest("VALIDATION", "Visit date must be a valid ISO timestamp.");
  }
  return new Date(value).toISOString();
}

function normalizeNotes(notes: unknown): string | null {
  if (notes === undefined || notes === null || notes === "") return null;
  if (typeof notes !== "string") {
    throw badRequest("VALIDATION", "Notes must be text.");
  }
  const trimmed = notes.trim();
  if (trimmed.length > 500) {
    throw badRequest("VALIDATION", "Notes must be 500 characters or fewer.");
  }
  return trimmed;
}

export function createVisit(
  db: Db,
  input: {
    restaurantId?: unknown;
    visitedAt?: unknown;
    notes?: unknown;
    source?: VisitSource;
    sessionId?: string | null;
  },
) {
  if (typeof input.restaurantId !== "string") {
    throw badRequest("VALIDATION", "Restaurant is required.");
  }
  const restaurant = getRestaurant(db, input.restaurantId);
  if (!restaurant || restaurant.archived_at) {
    throw notFound("Restaurant not found.");
  }

  const createdAt = nowIso();
  const id = randomUUID();
  const visitedAt = parseVisitedAt(input.visitedAt, createdAt);
  const notes = normalizeNotes(input.notes);
  const source = input.source ?? "manual";

  db.prepare(
    `INSERT INTO visits (id, restaurant_id, visited_at, source, session_id, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, restaurant.id, visitedAt, source, input.sessionId ?? null, notes, createdAt);

  return id;
}

export function updateVisit(db: Db, id: string, input: { visitedAt?: unknown; notes?: unknown }) {
  const existing = db.prepare("SELECT * FROM visits WHERE id = ?").get(id) as
    { id: string; visited_at: string; notes: string | null } | undefined;
  if (!existing) throw notFound("Visit not found.");

  const visitedAt =
    input.visitedAt === undefined
      ? existing.visited_at
      : parseVisitedAt(input.visitedAt, existing.visited_at);
  const notes = input.notes === undefined ? existing.notes : normalizeNotes(input.notes);
  db.prepare("UPDATE visits SET visited_at = ?, notes = ? WHERE id = ?").run(visitedAt, notes, id);
}

export function deleteVisit(db: Db, id: string) {
  const result = db.prepare("DELETE FROM visits WHERE id = ?").run(id);
  if (result.changes === 0) throw notFound("Visit not found.");
}
