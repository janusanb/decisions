import type { FastifyRequest } from "fastify";
import { isParticipantId } from "../../shared/constants.ts";
import type { ParticipantId } from "../../shared/types.ts";
import { badRequest } from "./errors.ts";

export function readParticipant(request: FastifyRequest): ParticipantId {
  const header = request.headers["x-participant-id"];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !isParticipantId(value)) {
    throw badRequest("VALIDATION", "X-Participant-Id header must be 'a' or 'b'.");
  }
  return value;
}
