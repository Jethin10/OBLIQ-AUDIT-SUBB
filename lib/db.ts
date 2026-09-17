import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// SQLite keeps the prototype self-contained. PostgreSQL would require changes
// to SQL, transaction handling and the synchronous driver contract.
let db: DatabaseSync | null = null;
export type DbValue = string | number | bigint | null | Uint8Array;
export function getDb(): DatabaseSync {
  if (!db) {
    const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(path.join(dir, "audit.db"));
    db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  }
  return db;
}
export function initSchema(): void {
  getDb().exec(fs.readFileSync(path.join(process.cwd(), "lib", "schema.sql"), "utf8"));
}
function toPlainObject<T>(row: T): T {
  // node:sqlite rows have null prototypes, which React Server Components
  // refuse to serialize across the server/client boundary — spread into a
  // plain object at the single query boundary.
  return row ? ({ ...(row as object) } as T) : row;
}

export function query<T = Record<string, unknown>>(sql: string, params: DbValue[] = []): T[] {
  const rows = getDb().prepare(sql).all(...params) as T[];
  return rows.map((row) => toPlainObject(row));
}
export function queryOne<T = Record<string, unknown>>(sql: string, params: DbValue[] = []): T | null {
  const row = getDb().prepare(sql).get(...params) as T | undefined;
  return row ? toPlainObject(row) : null;
}
export function run(sql: string, params: DbValue[] = []): void {
  getDb().prepare(sql).run(...params);
}
export function runInsert(sql: string, params: DbValue[] = []): number {
  return Number(getDb().prepare(sql).run(...params).lastInsertRowid);
}
// Only synchronous callbacks: the write lock spans validation, mutation and log.
export function transaction<T>(fn: () => T): T {
  const database = getDb();
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    database.exec("COMMIT");
    return result;
  } catch (err) {
    database.exec("ROLLBACK");
    throw err;
  }
}
