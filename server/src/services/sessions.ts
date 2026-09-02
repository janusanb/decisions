import { randomUUID } from "node:crypto";
import type { ParticipantId } from "../../../shared/types.ts";
import type { Db } from "../db.ts";
import { badRequest, conflict, notFound } from "../errors.ts";
import {
  buildTickets,
  excludePrevious,
  layoutSlices,
  pickWeighted,
  rotationForResult,
  totalTickets,
  uniqueChoices,
} from "./spin.ts";
import {
  ensureSubmission,
  getActiveSession,
  getRestaurant,
  lastResultRestaurantId,
  listChoices,
  nowIso,
  restaurantNames,
} from "./queries.ts";
import { createVisit } from "./visits.ts";

function requireActive(db: Db) {
  const session = getActiveSession(db);
  if (!session) throw notFound("There is no active round.");
  return session;
}

export function createSession(db: Db, createdBy: ParticipantId) {
  const existing = getActiveSession(db);
  if (existing) {
    throw conflict("A round is already in progress.");
  }

  const id = randomUUID();
  const createdAt = nowIso();
  const previous = lastResultRestaurantId(db);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO sessions (
        id, status, created_at, revealed_at, spun_at, resolved_at,
        result_restaurant_id, previous_result_restaurant_id, rotation_degrees, created_by
      ) VALUES (?, 'open', ?, NULL, NULL, NULL, NULL, ?, NULL, ?)`,
    ).run(id, createdAt, previous, createdBy);
    ensureSubmission(db, id, "a", createdAt);
    ensureSubmission(db, id, "b", createdAt);
  })();

  return id;
}

export function saveChoices(db: Db, participantId: ParticipantId, restaurantIds: unknown) {
  if (!Array.isArray(restaurantIds) || restaurantIds.some((id) => typeof id !== "string")) {
    throw badRequest("VALIDATION", "Choices must be an array of restaurant ids.");
  }

  const session = requireActive(db);
  if (session.status !== "open") {
    throw conflict("Choices are locked for this round.");
  }

  const submission = db
    .prepare("SELECT locked_at FROM submissions WHERE session_id = ? AND participant_id = ?")
    .get(session.id, participantId) as { locked_at: string | null } | undefined;
  if (submission?.locked_at) {
    throw conflict("Your picks are locked. Unlock them to make changes.");
  }

  const unique = uniqueChoices(restaurantIds);
  for (const id of unique) {
    const restaurant = getRestaurant(db, id);
    if (!restaurant || restaurant.archived_at) {
      throw badRequest("VALIDATION", "One of the selected restaurants is no longer available.");
    }
  }

  const updatedAt = nowIso();
  db.transaction(() => {
    ensureSubmission(db, session.id, participantId, updatedAt);
    db.prepare("DELETE FROM submission_choices WHERE session_id = ? AND participant_id = ?").run(
      session.id,
      participantId,
    );
    const insert = db.prepare(
      "INSERT INTO submission_choices (session_id, participant_id, restaurant_id) VALUES (?, ?, ?)",
    );
    for (const id of unique) {
      insert.run(session.id, participantId, id);
    }
    db.prepare(
      "UPDATE submissions SET updated_at = ? WHERE session_id = ? AND participant_id = ?",
    ).run(updatedAt, session.id, participantId);
  })();
}

export function lockChoices(db: Db, participantId: ParticipantId) {
  const session = requireActive(db);
  if (session.status !== "open") {
    throw conflict("This round is already locked.");
  }

  const otherId = participantId === "a" ? "b" : "a";
  const lockedAt = nowIso();

  db.transaction(() => {
    ensureSubmission(db, session.id, participantId, lockedAt);
    const current = db
      .prepare("SELECT locked_at FROM submissions WHERE session_id = ? AND participant_id = ?")
      .get(session.id, participantId) as { locked_at: string | null };
    if (current.locked_at) return;

    const other = db
      .prepare("SELECT locked_at FROM submissions WHERE session_id = ? AND participant_id = ?")
      .get(session.id, otherId) as { locked_at: string | null } | undefined;

    db.prepare(
      "UPDATE submissions SET locked_at = ?, updated_at = ? WHERE session_id = ? AND participant_id = ?",
    ).run(lockedAt, lockedAt, session.id, participantId);

    if (other?.locked_at) {
      reveal(db, session.id, session.previous_result_restaurant_id, lockedAt);
    }
  })();
}

export function unlockChoices(db: Db, participantId: ParticipantId) {
  const session = requireActive(db);
  if (session.status !== "open") {
    throw conflict("Picks cannot be changed after both people have locked in.");
  }

  const result = db
    .prepare(
      "UPDATE submissions SET locked_at = NULL, updated_at = ? WHERE session_id = ? AND participant_id = ?",
    )
    .run(nowIso(), session.id, participantId);
  if (result.changes === 0) {
    throw notFound("Submission not found.");
  }
}

function reveal(db: Db, sessionId: string, previousId: string | null, at: string) {
  const choicesA = listChoices(db, sessionId, "a");
  const choicesB = listChoices(db, sessionId, "b");
  const raw = buildTickets([choicesA, choicesB]);
  if (totalTickets(raw) === 0) {
    throw badRequest("NO_CANDIDATES", "At least one person needs to pick a restaurant.");
  }

  const effective = excludePrevious(raw, previousId);
  const names = restaurantNames(db, [...effective.keys()]);
  const slices = layoutSlices(effective, names);

  db.prepare("DELETE FROM spin_candidates WHERE session_id = ?").run(sessionId);
  const insert = db.prepare(
    `INSERT INTO spin_candidates (session_id, restaurant_id, tickets, slice_start_degrees, slice_angle_degrees)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const slice of slices) {
    insert.run(
      sessionId,
      slice.restaurantId,
      slice.tickets,
      slice.sliceStartDegrees,
      slice.sliceAngleDegrees,
    );
  }

  db.prepare("UPDATE sessions SET status = 'revealed', revealed_at = ? WHERE id = ?").run(
    at,
    sessionId,
  );
}

export function spinSession(db: Db, random: () => number = Math.random) {
  const session = requireActive(db);
  if (session.status !== "revealed") {
    throw conflict(
      session.status === "spun"
        ? "This round has already been spun."
        : "Both people need to lock in first.",
    );
  }

  const rows = db
    .prepare("SELECT restaurant_id, tickets FROM spin_candidates WHERE session_id = ?")
    .all(session.id) as Array<{ restaurant_id: string; tickets: number }>;
  const tickets = new Map(rows.map((row) => [row.restaurant_id, row.tickets]));
  if (totalTickets(tickets) === 0) {
    throw badRequest("NO_CANDIDATES", "There is nothing on the wheel.");
  }

  const names = restaurantNames(db, [...tickets.keys()]);
  const slices = layoutSlices(tickets, names);
  const resultId = pickWeighted(tickets, random);
  const rotation = rotationForResult(slices, resultId, random);
  const spunAt = nowIso();

  db.prepare(
    "UPDATE sessions SET status = 'spun', spun_at = ?, result_restaurant_id = ?, rotation_degrees = ? WHERE id = ?",
  ).run(spunAt, resultId, rotation, session.id);

  return { resultId, rotation };
}

export function confirmSession(db: Db) {
  const session = requireActive(db);
  if (session.status !== "spun" || !session.result_restaurant_id) {
    throw conflict("Spin the wheel before confirming a visit.");
  }

  const resolvedAt = nowIso();
  db.transaction(() => {
    createVisit(db, {
      restaurantId: session.result_restaurant_id,
      visitedAt: resolvedAt,
      source: "confirmed_spin",
      sessionId: session.id,
    });
    db.prepare("UPDATE sessions SET status = 'confirmed', resolved_at = ? WHERE id = ?").run(
      resolvedAt,
      session.id,
    );
  })();
}

export function rejectSession(db: Db) {
  const session = requireActive(db);
  if (session.status !== "spun") {
    throw conflict("There is no pending result to skip.");
  }
  db.prepare("UPDATE sessions SET status = 'rejected', resolved_at = ? WHERE id = ?").run(
    nowIso(),
    session.id,
  );
}

export function cancelSession(db: Db) {
  const session = requireActive(db);
  if (session.status === "spun") {
    throw conflict("This round already has a result. Confirm the visit or skip it.");
  }
  db.prepare("UPDATE sessions SET status = 'cancelled', resolved_at = ? WHERE id = ?").run(
    nowIso(),
    session.id,
  );
}

export function renameParticipant(db: Db, id: ParticipantId, name: unknown) {
  if (typeof name !== "string") {
    throw badRequest("VALIDATION", "Name is required.");
  }
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 40) {
    throw badRequest("VALIDATION", "Name must be between 1 and 40 characters.");
  }
  db.prepare("UPDATE participants SET name = ?, updated_at = ? WHERE id = ?").run(
    trimmed,
    nowIso(),
    id,
  );
}
