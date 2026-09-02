import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_DUE_AFTER_DAYS } from "../../../shared/constants.ts";
import { loadConfig } from "../config.ts";
import { migrate, openDatabase, type Db } from "../db.ts";
import { buildApp } from "../app.ts";
import { EventBus } from "../events.ts";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

export async function createTestApp(
  options: { random?: () => number; dueAfterDays?: number } = {},
) {
  const db = openDatabase(":memory:");
  migrate(db, migrationsDir);
  const events = new EventBus();
  const config = loadConfig({
    databasePath: ":memory:",
    dueAfterDays: options.dueAfterDays ?? DEFAULT_DUE_AFTER_DAYS,
    clientDir: null,
    migrationsDir,
    logLevel: "error",
    advertiseHost: "10.0.0.181",
  });
  const app = await buildApp({
    config,
    db,
    events,
    random: options.random,
  });

  return {
    app,
    db,
    events,
    async close() {
      await app.close();
      db.close();
    },
  };
}

export function seedRestaurants(db: Db, names: string[]): string[] {
  const now = new Date().toISOString();
  const ids: string[] = [];
  const insert = db.prepare(
    "INSERT INTO restaurants (id, name, notes, created_at, archived_at) VALUES (?, ?, NULL, ?, NULL)",
  );
  for (const [index, name] of names.entries()) {
    const id = `rest-${index + 1}`;
    insert.run(id, name, now);
    ids.push(id);
  }
  return ids;
}

export function headers(participantId: "a" | "b") {
  return {
    "x-participant-id": participantId,
    "content-type": "application/json",
  };
}
