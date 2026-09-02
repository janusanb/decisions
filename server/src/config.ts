import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_DUE_AFTER_DAYS, DEFAULT_HOST, DEFAULT_PORT } from "../../shared/constants.ts";

export type AppConfig = {
  host: string;
  port: number;
  databasePath: string;
  dueAfterDays: number;
  clientDir: string | null;
  migrationsDir: string;
  logLevel: string;
  advertiseHost: string | null;
};

function findMigrationsDir(): string {
  if (process.env.MIGRATIONS_DIR) {
    return path.resolve(process.env.MIGRATIONS_DIR);
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "migrations"),
    path.join(process.cwd(), "dist/migrations"),
    path.join(process.cwd(), "server/src/migrations"),
  ];

  return candidates.find((dir) => fs.existsSync(dir)) ?? candidates[0];
}

function findClientDir(): string | null {
  if (process.env.CLIENT_DIR) {
    return path.resolve(process.env.CLIENT_DIR);
  }
  const built = path.join(process.cwd(), "dist/client");
  return fs.existsSync(built) ? built : null;
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const dueAfterDays = Number(process.env.DUE_AFTER_DAYS ?? DEFAULT_DUE_AFTER_DAYS);
  if (!Number.isInteger(dueAfterDays) || dueAfterDays < 1) {
    throw new Error("DUE_AFTER_DAYS must be a positive integer");
  }

  return {
    host: process.env.HOST ?? DEFAULT_HOST,
    port: Number(process.env.PORT ?? DEFAULT_PORT),
    databasePath: path.resolve(process.env.DATABASE_PATH ?? "./data/decisions.db"),
    dueAfterDays,
    clientDir: findClientDir(),
    migrationsDir: findMigrationsDir(),
    logLevel: process.env.LOG_LEVEL ?? "info",
    advertiseHost: process.env.ADVERTISE_HOST?.trim() || null,
    ...overrides,
  };
}
