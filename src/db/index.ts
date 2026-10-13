import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { mkdirSync } from "node:fs";
import path from "node:path";

function createDb() {
  const dataDir = process.env.DATABASE_DIR ?? path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  const file = process.env.DATABASE_URL ?? path.join(dataDir, "yizhan.db");
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

const globalForDb = globalThis as unknown as { __yizhanDb?: ReturnType<typeof createDb> };

export const db = globalForDb.__yizhanDb ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__yizhanDb = db;
}

export type DB = typeof db;
export * as schema from "./schema";