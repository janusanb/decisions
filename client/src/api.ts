import type { AppState, BackupPayload, ParticipantId } from "../../shared/types.ts";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  participantId: ParticipantId,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Participant-Id", participantId);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    let code = "HTTP";
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // keep defaults
    }
    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  state: (id: ParticipantId) => request<AppState>(id, "/api/state"),
  rename: (id: ParticipantId, name: string) =>
    request(id, `/api/participants/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  createRestaurant: (id: ParticipantId, name: string, notes?: string) =>
    request<{ id: string }>(id, "/api/restaurants", {
      method: "POST",
      body: JSON.stringify({ name, notes }),
    }),
  updateRestaurant: (
    id: ParticipantId,
    restaurantId: string,
    body: { name?: string; notes?: string },
  ) =>
    request(id, `/api/restaurants/${restaurantId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  archiveRestaurant: (id: ParticipantId, restaurantId: string) =>
    request(id, `/api/restaurants/${restaurantId}`, { method: "DELETE" }),
  createVisit: (id: ParticipantId, restaurantId: string, visitedAt?: string, notes?: string) =>
    request(id, "/api/visits", {
      method: "POST",
      body: JSON.stringify({ restaurantId, visitedAt, notes }),
    }),
  deleteVisit: (id: ParticipantId, visitId: string) =>
    request(id, `/api/visits/${visitId}`, { method: "DELETE" }),
  startSession: (id: ParticipantId) =>
    request<{ id: string }>(id, "/api/sessions", { method: "POST" }),
  saveChoices: (id: ParticipantId, restaurantIds: string[]) =>
    request(id, "/api/sessions/current/choices", {
      method: "PUT",
      body: JSON.stringify({ restaurantIds }),
    }),
  lock: (id: ParticipantId) => request(id, "/api/sessions/current/lock", { method: "POST" }),
  unlock: (id: ParticipantId) => request(id, "/api/sessions/current/unlock", { method: "POST" }),
  spin: (id: ParticipantId) => request(id, "/api/sessions/current/spin", { method: "POST" }),
  confirm: (id: ParticipantId) => request(id, "/api/sessions/current/confirm", { method: "POST" }),
  reject: (id: ParticipantId) => request(id, "/api/sessions/current/reject", { method: "POST" }),
  cancel: (id: ParticipantId) => request(id, "/api/sessions/current/cancel", { method: "POST" }),
  exportBackup: (id: ParticipantId) => request<BackupPayload>(id, "/api/export"),
  importBackup: (id: ParticipantId, payload: BackupPayload) =>
    request(id, "/api/import", { method: "POST", body: JSON.stringify(payload) }),
};
