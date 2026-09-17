import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { queryOne, run } from "./db";

/**
 * Authentication is separate from authorization.
 *
 * - Authentication: scrypt password hashes, opaque random session token in an
 *   HttpOnly cookie, sessions stored server-side with an expiry.
 * - Authorization: role -> permission table below. Tenancy is NOT a role
 *   permission: it is enforced on every query by filtering on the session's
 *   firm (see lib/documents.ts / lib/clients.ts). Hiding UI elements is not
 *   part of the security model — the API rejects unauthorized requests.
 */

export type Role = "STAFF" | "REVIEWER";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  firmId: number;
  firmName: string;
}

const SESSION_COOKIE = "obliq_session";
const SESSION_TTL_DAYS = 7;

const PERMISSIONS: Record<Role, string[]> = {
  STAFF: ["client:view", "document:view", "document:upload"],
  REVIEWER: [
    "client:view",
    "client:create",
    "document:view",
    "document:review",
    "audit:view",
  ],
};

export function can(user: SessionUser, permission: string): boolean {
  return PERMISSIONS[user.role].includes(permission);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const N = 16384, r = 8, p = 1;
  const hash = scryptSync(password, salt, 64, { N, r, p });
  return `scrypt$N=${N},r=${r},p=${p}$${salt}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const kv = new Map(
    parts[1].split(",").map((pair) => {
      const [key, value] = pair.split("=");
      return [key, value] as const;
    })
  );
  const salt = parts[2];
  const expected = Buffer.from(parts[3], "hex");
  const hash = scryptSync(password, salt, expected.length, {
    N: Number(kv.get("N") ?? 16384),
    r: Number(kv.get("r") ?? 8),
    p: Number(kv.get("p") ?? 1),
  });
  return timingSafeEqual(hash, expected);
}

export async function createSession(
  userId: number
): Promise<{ id: string; maxAgeSeconds: number }> {
  const id = randomBytes(32).toString("hex");
  const maxAgeSeconds = SESSION_TTL_DAYS * 24 * 60 * 60;
  run(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES (?, ?, datetime('now', '+${SESSION_TTL_DAYS} days'))`,
    [id, userId]
  );
  return { id, maxAgeSeconds };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (!sid) return null;

  const row = queryOne<{
    id: number;
    name: string;
    email: string;
    role: Role;
    firm_id: number;
    firm_name: string;
  }>(
    `SELECT u.id, u.name, u.email, u.role, u.firm_id, f.name AS firm_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN firms f ON f.id = u.firm_id
      WHERE s.id = ? AND s.expires_at > datetime('now')`,
    [sid]
  );
  if (!row) return null;

  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role) as Role,
    firmId: Number(row.firm_id),
    firmName: String(row.firm_name),
  };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (sid) run("DELETE FROM sessions WHERE id = ?", [sid]);
  store.delete(SESSION_COOKIE);
}
