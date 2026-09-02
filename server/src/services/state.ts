import type {
  AppState,
  Candidate,
  ParticipantId,
  RestaurantView,
  SessionView,
  Visit,
} from "../../../shared/types.ts";
import { isParticipantId } from "../../../shared/constants.ts";
import type { Db } from "../db.ts";
import { daysSince, isDue } from "./due.ts";
import {
  getActiveSession,
  lastVisitAt,
  listActiveRestaurants,
  listCandidates,
  listChoices,
  type SessionRow,
} from "./queries.ts";

export function otherParticipant(id: ParticipantId): ParticipantId {
  return id === "a" ? "b" : "a";
}

export function restaurantViews(db: Db, now: Date, dueAfterDays: number): RestaurantView[] {
  return listActiveRestaurants(db).map((row) => {
    const lastVisitedAt = lastVisitAt(db, row.id);
    return {
      id: row.id,
      name: row.name,
      notes: row.notes,
      createdAt: row.created_at,
      archivedAt: row.archived_at,
      lastVisitedAt,
      daysSinceVisit: daysSince(lastVisitedAt, now),
      due: isDue(lastVisitedAt, now, dueAfterDays),
      neverVisited: lastVisitedAt === null,
    };
  });
}

export function listVisits(db: Db): Visit[] {
  return (
    db
      .prepare(
        `SELECT v.*, r.name AS restaurant_name
         FROM visits v
         JOIN restaurants r ON r.id = v.restaurant_id
         ORDER BY v.visited_at DESC, v.created_at DESC
         LIMIT 200`,
      )
      .all() as Array<{
      id: string;
      restaurant_id: string;
      restaurant_name: string;
      visited_at: string;
      source: Visit["source"];
      session_id: string | null;
      notes: string | null;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name,
    visitedAt: row.visited_at,
    source: row.source,
    sessionId: row.session_id,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

function sessionView(db: Db, session: SessionRow, participantId: ParticipantId): SessionView {
  const otherId = otherParticipant(participantId);
  const youLocked = Boolean(
    (
      db
        .prepare("SELECT locked_at FROM submissions WHERE session_id = ? AND participant_id = ?")
        .get(session.id, participantId) as { locked_at: string | null } | undefined
    )?.locked_at,
  );
  const otherLocked = Boolean(
    (
      db
        .prepare("SELECT locked_at FROM submissions WHERE session_id = ? AND participant_id = ?")
        .get(session.id, otherId) as { locked_at: string | null } | undefined
    )?.locked_at,
  );

  const revealed = session.status !== "open";
  const youChoices = listChoices(db, session.id, participantId);
  const otherChoices = revealed ? listChoices(db, session.id, otherId) : null;

  const candidateRows = revealed ? listCandidates(db, session.id) : [];
  const total = candidateRows.reduce((sum, row) => sum + row.tickets, 0);
  const candidates: Candidate[] | null = revealed
    ? candidateRows.map((row) => ({
        restaurantId: row.restaurant_id,
        name: row.name,
        tickets: row.tickets,
        probability: total === 0 ? 0 : row.tickets / total,
        sliceStartDegrees: row.slice_start_degrees,
        sliceAngleDegrees: row.slice_angle_degrees,
      }))
    : null;

  const other = db.prepare("SELECT name FROM participants WHERE id = ?").get(otherId) as {
    name: string;
  };

  let result: SessionView["result"] = null;
  if (session.result_restaurant_id) {
    const restaurant = db
      .prepare("SELECT name FROM restaurants WHERE id = ?")
      .get(session.result_restaurant_id) as { name: string } | undefined;
    result = {
      restaurantId: session.result_restaurant_id,
      name: restaurant?.name ?? "Unknown place",
      rotationDegrees: session.rotation_degrees ?? 0,
    };
  }

  let previousResultName: string | null = null;
  if (session.previous_result_restaurant_id) {
    previousResultName =
      (
        db
          .prepare("SELECT name FROM restaurants WHERE id = ?")
          .get(session.previous_result_restaurant_id) as { name: string } | undefined
      )?.name ?? null;
  }

  const skippedPrevious = Boolean(
    session.previous_result_restaurant_id &&
    candidates &&
    !candidates.some((item) => item.restaurantId === session.previous_result_restaurant_id),
  );

  return {
    id: session.id,
    status: session.status,
    createdAt: session.created_at,
    revealedAt: session.revealed_at,
    spunAt: session.spun_at,
    resolvedAt: session.resolved_at,
    createdBy: session.created_by,
    previousResultRestaurantId: session.previous_result_restaurant_id,
    previousResultName,
    skippedPrevious,
    you: {
      participantId,
      locked: youLocked,
      choices: youChoices,
    },
    other: {
      participantId: otherId,
      name: other.name,
      locked: otherLocked,
      choices: otherChoices,
    },
    candidates,
    result,
  };
}

export function readState(
  db: Db,
  participantId: ParticipantId,
  dueAfterDays: number,
  now = new Date(),
): AppState {
  const participants = (
    db.prepare("SELECT id, name, updated_at FROM participants ORDER BY id").all() as Array<{
      id: string;
      name: string;
      updated_at: string;
    }>
  ).flatMap((row) =>
    isParticipantId(row.id) ? [{ id: row.id, name: row.name, updatedAt: row.updated_at }] : [],
  );

  const session = getActiveSession(db);

  return {
    dueAfterDays,
    participants,
    restaurants: restaurantViews(db, now, dueAfterDays),
    visits: listVisits(db),
    session: session ? sessionView(db, session, participantId) : null,
  };
}
