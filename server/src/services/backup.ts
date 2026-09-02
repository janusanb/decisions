import type {
  BackupPayload,
  ParticipantId,
  SessionStatus,
  VisitSource,
} from "../../../shared/types.ts";
import { isParticipantId } from "../../../shared/constants.ts";
import type { Db } from "../db.ts";
import { badRequest } from "../errors.ts";

const SESSION_STATUSES = new Set<SessionStatus>([
  "open",
  "revealed",
  "spun",
  "confirmed",
  "rejected",
  "cancelled",
]);
const VISIT_SOURCES = new Set<VisitSource>(["confirmed_spin", "manual"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function exportBackup(db: Db, dueAfterDays: number): BackupPayload {
  const participants = db.prepare("SELECT id, name, updated_at FROM participants").all() as Array<{
    id: ParticipantId;
    name: string;
    updated_at: string;
  }>;
  const restaurants = db.prepare("SELECT * FROM restaurants").all() as Array<{
    id: string;
    name: string;
    notes: string | null;
    created_at: string;
    archived_at: string | null;
  }>;
  const visits = db.prepare("SELECT * FROM visits").all() as Array<{
    id: string;
    restaurant_id: string;
    visited_at: string;
    source: VisitSource;
    session_id: string | null;
    notes: string | null;
    created_at: string;
  }>;
  const sessions = db.prepare("SELECT * FROM sessions").all() as Array<{
    id: string;
    status: SessionStatus;
    created_at: string;
    revealed_at: string | null;
    spun_at: string | null;
    resolved_at: string | null;
    result_restaurant_id: string | null;
    previous_result_restaurant_id: string | null;
    rotation_degrees: number | null;
    created_by: ParticipantId;
  }>;
  const submissions = db.prepare("SELECT * FROM submissions").all() as Array<{
    session_id: string;
    participant_id: ParticipantId;
    locked_at: string | null;
    updated_at: string;
  }>;
  const choices = db.prepare("SELECT * FROM submission_choices").all() as Array<{
    session_id: string;
    participant_id: ParticipantId;
    restaurant_id: string;
  }>;
  const spinCandidates = db.prepare("SELECT * FROM spin_candidates").all() as Array<{
    session_id: string;
    restaurant_id: string;
    tickets: number;
    slice_start_degrees: number;
    slice_angle_degrees: number;
  }>;

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    dueAfterDays,
    participants: participants.map((row) => ({
      id: row.id,
      name: row.name,
      updatedAt: row.updated_at,
    })),
    restaurants: restaurants.map((row) => ({
      id: row.id,
      name: row.name,
      notes: row.notes,
      createdAt: row.created_at,
      archivedAt: row.archived_at,
    })),
    visits: visits.map((row) => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      visitedAt: row.visited_at,
      source: row.source,
      sessionId: row.session_id,
      notes: row.notes,
      createdAt: row.created_at,
    })),
    sessions: sessions.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      revealedAt: row.revealed_at,
      spunAt: row.spun_at,
      resolvedAt: row.resolved_at,
      resultRestaurantId: row.result_restaurant_id,
      previousResultRestaurantId: row.previous_result_restaurant_id,
      rotationDegrees: row.rotation_degrees,
      createdBy: row.created_by,
    })),
    submissions: submissions.map((row) => ({
      sessionId: row.session_id,
      participantId: row.participant_id,
      lockedAt: row.locked_at,
      updatedAt: row.updated_at,
      restaurantIds: choices
        .filter(
          (choice) =>
            choice.session_id === row.session_id && choice.participant_id === row.participant_id,
        )
        .map((choice) => choice.restaurant_id),
    })),
    spinCandidates: spinCandidates.map((row) => ({
      sessionId: row.session_id,
      restaurantId: row.restaurant_id,
      tickets: row.tickets,
      sliceStartDegrees: row.slice_start_degrees,
      sliceAngleDegrees: row.slice_angle_degrees,
    })),
  };
}

export function importBackup(db: Db, payload: unknown) {
  if (!isRecord(payload) || payload.version !== 1) {
    throw badRequest("VALIDATION", "Backup must be a version 1 Decision Wheel export.");
  }
  if (!Array.isArray(payload.participants) || !Array.isArray(payload.restaurants)) {
    throw badRequest("VALIDATION", "Backup is missing restaurants or participants.");
  }

  const participants = payload.participants as BackupPayload["participants"];
  const restaurants = payload.restaurants as BackupPayload["restaurants"];
  const visits = (payload.visits as BackupPayload["visits"] | undefined) ?? [];
  const sessions = (payload.sessions as BackupPayload["sessions"] | undefined) ?? [];
  const submissions = (payload.submissions as BackupPayload["submissions"] | undefined) ?? [];
  const spinCandidates =
    (payload.spinCandidates as BackupPayload["spinCandidates"] | undefined) ?? [];

  for (const participant of participants) {
    if (!isParticipantId(participant.id) || typeof participant.name !== "string") {
      throw badRequest("VALIDATION", "Backup contains an invalid participant.");
    }
  }
  for (const restaurant of restaurants) {
    if (typeof restaurant.id !== "string" || typeof restaurant.name !== "string") {
      throw badRequest("VALIDATION", "Backup contains an invalid restaurant.");
    }
  }
  for (const visit of visits) {
    if (!VISIT_SOURCES.has(visit.source)) {
      throw badRequest("VALIDATION", "Backup contains an invalid visit.");
    }
  }
  for (const session of sessions) {
    if (!SESSION_STATUSES.has(session.status) || !isParticipantId(session.createdBy)) {
      throw badRequest("VALIDATION", "Backup contains an invalid session.");
    }
  }

  db.transaction(() => {
    db.exec(`
      DELETE FROM spin_candidates;
      DELETE FROM submission_choices;
      DELETE FROM submissions;
      DELETE FROM visits;
      DELETE FROM sessions;
      DELETE FROM restaurants;
    `);

    const upsertParticipant = db.prepare(
      "UPDATE participants SET name = ?, updated_at = ? WHERE id = ?",
    );
    for (const participant of participants) {
      upsertParticipant.run(
        participant.name,
        participant.updatedAt ?? new Date().toISOString(),
        participant.id,
      );
    }

    const insertRestaurant = db.prepare(
      "INSERT INTO restaurants (id, name, notes, created_at, archived_at) VALUES (?, ?, ?, ?, ?)",
    );
    for (const restaurant of restaurants) {
      insertRestaurant.run(
        restaurant.id,
        restaurant.name,
        restaurant.notes ?? null,
        restaurant.createdAt,
        restaurant.archivedAt ?? null,
      );
    }

    const insertSession = db.prepare(
      `INSERT INTO sessions (
        id, status, created_at, revealed_at, spun_at, resolved_at,
        result_restaurant_id, previous_result_restaurant_id, rotation_degrees, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const session of sessions) {
      insertSession.run(
        session.id,
        session.status,
        session.createdAt,
        session.revealedAt,
        session.spunAt,
        session.resolvedAt,
        session.resultRestaurantId,
        session.previousResultRestaurantId,
        session.rotationDegrees,
        session.createdBy,
      );
    }

    const insertVisit = db.prepare(
      `INSERT INTO visits (id, restaurant_id, visited_at, source, session_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const visit of visits) {
      insertVisit.run(
        visit.id,
        visit.restaurantId,
        visit.visitedAt,
        visit.source,
        visit.sessionId,
        visit.notes,
        visit.createdAt,
      );
    }

    const insertSubmission = db.prepare(
      "INSERT INTO submissions (session_id, participant_id, locked_at, updated_at) VALUES (?, ?, ?, ?)",
    );
    const insertChoice = db.prepare(
      "INSERT INTO submission_choices (session_id, participant_id, restaurant_id) VALUES (?, ?, ?)",
    );
    for (const submission of submissions) {
      insertSubmission.run(
        submission.sessionId,
        submission.participantId,
        submission.lockedAt,
        submission.updatedAt,
      );
      for (const restaurantId of submission.restaurantIds) {
        insertChoice.run(submission.sessionId, submission.participantId, restaurantId);
      }
    }

    const insertCandidate = db.prepare(
      `INSERT INTO spin_candidates (session_id, restaurant_id, tickets, slice_start_degrees, slice_angle_degrees)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const candidate of spinCandidates) {
      insertCandidate.run(
        candidate.sessionId,
        candidate.restaurantId,
        candidate.tickets,
        candidate.sliceStartDegrees,
        candidate.sliceAngleDegrees,
      );
    }
  })();
}
