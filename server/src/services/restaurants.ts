import { randomUUID } from "node:crypto";
import type { Db } from "../db.ts";
import { badRequest, conflict, notFound } from "../errors.ts";
import { getRestaurant, nowIso } from "./queries.ts";

function normalizeName(name: unknown): string {
  if (typeof name !== "string") {
    throw badRequest("VALIDATION", "Restaurant name is required.");
  }
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw badRequest("VALIDATION", "Restaurant name must be between 1 and 80 characters.");
  }
  return trimmed;
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

function isUniqueNameError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("restaurants_name_nocase");
}

export function createRestaurant(db: Db, input: { name?: unknown; notes?: unknown }) {
  const name = normalizeName(input.name);
  const notes = normalizeNotes(input.notes);
  const id = randomUUID();
  const createdAt = nowIso();

  try {
    db.prepare(
      "INSERT INTO restaurants (id, name, notes, created_at, archived_at) VALUES (?, ?, ?, ?, NULL)",
    ).run(id, name, notes, createdAt);
  } catch (error) {
    if (isUniqueNameError(error)) {
      throw conflict("A restaurant with that name already exists.");
    }
    throw error;
  }

  return getRestaurant(db, id)!;
}

export function updateRestaurant(db: Db, id: string, input: { name?: unknown; notes?: unknown }) {
  const existing = getRestaurant(db, id);
  if (!existing || existing.archived_at) {
    throw notFound("Restaurant not found.");
  }

  const name = input.name === undefined ? existing.name : normalizeName(input.name);
  const notes = input.notes === undefined ? existing.notes : normalizeNotes(input.notes);

  try {
    db.prepare("UPDATE restaurants SET name = ?, notes = ? WHERE id = ?").run(name, notes, id);
  } catch (error) {
    if (isUniqueNameError(error)) {
      throw conflict("A restaurant with that name already exists.");
    }
    throw error;
  }

  return getRestaurant(db, id)!;
}

export function archiveRestaurant(db: Db, id: string) {
  const existing = getRestaurant(db, id);
  if (!existing || existing.archived_at) {
    throw notFound("Restaurant not found.");
  }

  const active = db
    .prepare("SELECT status FROM sessions WHERE status IN ('open', 'revealed', 'spun') LIMIT 1")
    .get() as { status: string } | undefined;
  if (active) {
    throw conflict("Finish or cancel the current round before removing a restaurant.");
  }

  db.prepare("UPDATE restaurants SET archived_at = ? WHERE id = ?").run(nowIso(), id);
}
