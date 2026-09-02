import path from "node:path";
import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import Fastify, { LogController, type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.ts";
import type { Db } from "./db.ts";
import { EventBus } from "./events.ts";
import { HttpError } from "./errors.ts";
import { readParticipant } from "./participant.ts";
import { allowDevCors, applySecurityHeaders, isLocalDevOrigin } from "./security.ts";
import { exportBackup, importBackup } from "./services/backup.ts";
import { archiveRestaurant, createRestaurant, updateRestaurant } from "./services/restaurants.ts";
import {
  cancelSession,
  confirmSession,
  createSession,
  lockChoices,
  rejectSession,
  renameParticipant,
  saveChoices,
  spinSession,
  unlockChoices,
} from "./services/sessions.ts";
import { readState } from "./services/state.ts";
import { createVisit, deleteVisit, updateVisit } from "./services/visits.ts";

export type AppOptions = {
  config: AppConfig;
  db: Db;
  events?: EventBus;
  random?: () => number;
};

function sendError(
  error: unknown,
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
) {
  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
  }
  throw error;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { config, db } = options;
  const events = options.events ?? new EventBus();
  const random = options.random ?? Math.random;

  const app = Fastify({
    logController: new LogController({ disableRequestLogging: true }),
    logger: {
      level: config.logLevel,
      base: {},
    },
  });

  if (allowDevCors()) {
    await app.register(cors, {
      origin: (origin, callback) => {
        callback(null, !origin || isLocalDevOrigin(origin));
      },
    });
  }

  app.addHook("onRequest", async (request, reply) => {
    applySecurityHeaders(request, reply);
  });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    if (!body) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(String(body)));
    } catch (error) {
      done(error as Error);
    }
  });

  const changed = (reason: string) => events.emit(reason);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }
    const statusCode =
      typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 500;
    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: {
          code: "VALIDATION",
          message: error instanceof Error ? error.message : "Invalid request.",
        },
      });
    }
    if (process.env.NODE_ENV === "production") {
      app.log.error("internal error");
    } else {
      app.log.error(error);
    }
    return reply.status(500).send({
      error: { code: "INTERNAL", message: "Something went wrong." },
    });
  });

  app.get("/api/health", async () => {
    db.prepare("SELECT 1").get();
    return { ok: true, db: true };
  });

  app.get("/api/access", async (request) => {
    const advertiseHost = config.advertiseHost;
    const port = config.port;
    return {
      port,
      advertiseHost,
      shareUrl: advertiseHost ? `http://${advertiseHost}:${port}` : null,
      requestHost: request.hostname,
    };
  });

  app.get("/api/state", async (request) => {
    const participantId = readParticipant(request);
    return readState(db, participantId, config.dueAfterDays);
  });

  app.patch<{ Params: { id: string } }>("/api/participants/:id", async (request, reply) => {
    const actor = readParticipant(request);
    if (request.params.id !== actor) {
      return reply.status(403).send({
        error: { code: "FORBIDDEN", message: "You can only rename your own seat." },
      });
    }
    try {
      renameParticipant(db, actor, (request.body as { name?: unknown } | null)?.name);
      changed("participant.renamed");
      return { ok: true };
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.post("/api/restaurants", async (request, reply) => {
    readParticipant(request);
    try {
      const restaurant = createRestaurant(
        db,
        (request.body ?? {}) as { name?: unknown; notes?: unknown },
      );
      changed("restaurant.created");
      return reply.status(201).send({ id: restaurant.id });
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.patch<{ Params: { id: string } }>("/api/restaurants/:id", async (request, reply) => {
    readParticipant(request);
    try {
      updateRestaurant(
        db,
        request.params.id,
        (request.body ?? {}) as { name?: unknown; notes?: unknown },
      );
      changed("restaurant.updated");
      return { ok: true };
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.delete<{ Params: { id: string } }>("/api/restaurants/:id", async (request, reply) => {
    readParticipant(request);
    try {
      archiveRestaurant(db, request.params.id);
      changed("restaurant.archived");
      return { ok: true };
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.post("/api/visits", async (request, reply) => {
    readParticipant(request);
    try {
      const body = (request.body ?? {}) as {
        restaurantId?: unknown;
        visitedAt?: unknown;
        notes?: unknown;
      };
      const id = createVisit(db, body);
      changed("visit.created");
      return reply.status(201).send({ id });
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.patch<{ Params: { id: string } }>("/api/visits/:id", async (request, reply) => {
    readParticipant(request);
    try {
      updateVisit(
        db,
        request.params.id,
        (request.body ?? {}) as { visitedAt?: unknown; notes?: unknown },
      );
      changed("visit.updated");
      return { ok: true };
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.delete<{ Params: { id: string } }>("/api/visits/:id", async (request, reply) => {
    readParticipant(request);
    try {
      deleteVisit(db, request.params.id);
      changed("visit.deleted");
      return { ok: true };
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.post("/api/sessions", async (request, reply) => {
    const participantId = readParticipant(request);
    try {
      const id = createSession(db, participantId);
      changed("session.created");
      return reply.status(201).send({ id });
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.put("/api/sessions/current/choices", async (request, reply) => {
    const participantId = readParticipant(request);
    try {
      saveChoices(
        db,
        participantId,
        (request.body as { restaurantIds?: unknown } | null)?.restaurantIds,
      );
      changed("session.choices");
      return { ok: true };
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.post("/api/sessions/current/lock", async (request, reply) => {
    const participantId = readParticipant(request);
    try {
      lockChoices(db, participantId);
      changed("session.locked");
      return { ok: true };
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.post("/api/sessions/current/unlock", async (request, reply) => {
    const participantId = readParticipant(request);
    try {
      unlockChoices(db, participantId);
      changed("session.unlocked");
      return { ok: true };
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.post("/api/sessions/current/spin", async (request, reply) => {
    readParticipant(request);
    try {
      const result = spinSession(db, random);
      changed("session.spun");
      return result;
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.post("/api/sessions/current/confirm", async (request, reply) => {
    readParticipant(request);
    try {
      confirmSession(db);
      changed("session.confirmed");
      return { ok: true };
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.post("/api/sessions/current/reject", async (request, reply) => {
    readParticipant(request);
    try {
      rejectSession(db);
      changed("session.rejected");
      return { ok: true };
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.post("/api/sessions/current/cancel", async (request, reply) => {
    readParticipant(request);
    try {
      cancelSession(db);
      changed("session.cancelled");
      return { ok: true };
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.get("/api/export", async (request) => {
    readParticipant(request);
    return exportBackup(db, config.dueAfterDays);
  });

  app.post("/api/import", async (request, reply) => {
    readParticipant(request);
    try {
      importBackup(db, request.body);
      changed("backup.imported");
      return { ok: true };
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.get("/api/events", async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    reply.raw.write('event: state\ndata: {"reason":"connected"}\n\n');
    events.subscribe(reply);
  });

  const ping = setInterval(() => events.ping(), 15000);
  app.addHook("onClose", async () => {
    clearInterval(ping);
  });

  if (config.clientDir) {
    await app.register(staticFiles, {
      root: path.resolve(config.clientDir),
      wildcard: false,
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api")) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Not found." },
        });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}
