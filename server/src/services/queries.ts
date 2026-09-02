import type { ParticipantId, SessionStatus, VisitSource } from "../../../shared/types.ts";
import type { Db } from "../db.ts";

export type RestaurantRow = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  archived_at: string | null;
};

export type SessionRow = {
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
};

export type SubmissionRow = {
  session_id: string;
  participant_id: ParticipantId;
  locked_at: string | null;
  updated_at: string;
};

export type VisitRow = {
  id: string;
  restaurant_id: string;
  visited_at: string;
  source: VisitSource;
  session_id: string | null;
  notes: string | null;
  created_at: string;
};

export type CandidateRow = {
  session_id: string;
  restaurant_id: string;
  tickets: number;
  slice_start_degrees: number;
  slice_angle_degrees: number;
  name: string;
};

export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

export function getRestaurant(db: Db, id: string): RestaurantRow | undefined {
  return db.prepare("SELECT * FROM restaurants WHERE id = ?").get(id) as RestaurantRow | undefined;
}

export function listActiveRestaurants(db: Db): RestaurantRow[] {
  return db
    .prepare("SELECT * FROM restaurants WHERE archived_at IS NULL ORDER BY name COLLATE NOCASE")
    .all() as RestaurantRow[];
}

export function lastVisitAt(db: Db, restaurantId: string): string | null {
  const row = db
    .prepare(
      "SELECT visited_at FROM visits WHERE restaurant_id = ? ORDER BY visited_at DESC LIMIT 1",
    )
    .get(restaurantId) as { visited_at: string } | undefined;
  return row?.visited_at ?? null;
}

export function getActiveSession(db: Db): SessionRow | undefined {
  return db
    .prepare(
      `SELECT * FROM sessions
       WHERE status IN ('open', 'revealed', 'spun')
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get() as SessionRow | undefined;
}

export function getSession(db: Db, id: string): SessionRow | undefined {
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
}

export function lastResultRestaurantId(db: Db): string | null {
  const row = db
    .prepare(
      `SELECT result_restaurant_id FROM sessions
       WHERE result_restaurant_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get() as { result_restaurant_id: string } | undefined;
  return row?.result_restaurant_id ?? null;
}

export function getSubmission(
  db: Db,
  sessionId: string,
  participantId: ParticipantId,
): SubmissionRow | undefined {
  return db
    .prepare("SELECT * FROM submissions WHERE session_id = ? AND participant_id = ?")
    .get(sessionId, participantId) as SubmissionRow | undefined;
}

export function listChoices(db: Db, sessionId: string, participantId: ParticipantId): string[] {
  return (
    db
      .prepare(
        "SELECT restaurant_id FROM submission_choices WHERE session_id = ? AND participant_id = ? ORDER BY restaurant_id",
      )
      .all(sessionId, participantId) as Array<{ restaurant_id: string }>
  ).map((row) => row.restaurant_id);
}

export function ensureSubmission(
  db: Db,
  sessionId: string,
  participantId: ParticipantId,
  at: string,
): void {
  db.prepare(
    `INSERT INTO submissions (session_id, participant_id, locked_at, updated_at)
     VALUES (?, ?, NULL, ?)
     ON CONFLICT(session_id, participant_id) DO NOTHING`,
  ).run(sessionId, participantId, at);
}

export function restaurantNames(db: Db, ids: string[]): Map<string, string> {
  const names = new Map<string, string>();
  if (ids.length === 0) return names;
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT id, name FROM restaurants WHERE id IN (${placeholders})`)
    .all(...ids) as Array<{ id: string; name: string }>;
  for (const row of rows) names.set(row.id, row.name);
  return names;
}

export function listCandidates(db: Db, sessionId: string): CandidateRow[] {
  return db
    .prepare(
      `SELECT c.*, r.name
       FROM spin_candidates c
       JOIN restaurants r ON r.id = c.restaurant_id
       WHERE c.session_id = ?
       ORDER BY r.name COLLATE NOCASE, c.restaurant_id`,
    )
    .all(sessionId) as CandidateRow[];
}
