import { loadConfig } from "./config.ts";
import { migrate, openDatabase } from "./db.ts";
import { buildApp } from "./app.ts";

const config = loadConfig();
const db = openDatabase(config.databasePath);
migrate(db, config.migrationsDir);

const app = await buildApp({ config, db });

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`Decision Wheel listening on port ${config.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down`);
  await app.close();
  db.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
