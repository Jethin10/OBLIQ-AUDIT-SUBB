import { AUDIT_ACTIONS } from "./audit";
import { DEFAULT_DOC_TYPES } from "./clients";
import { initSchema, queryOne, runInsert } from "./db";

/**
 * The landing page's two stat cards.
 *
 * They read the same database the workspace writes to, so the numbers on the
 * page are the numbers in the product. On a fresh clone the database has not
 * been seeded yet (`npm run seed`), so the cards fall back to what the code
 * guarantees regardless of data: the size of the standard checklist and the
 * number of actions the audit log can hold.
 */
export interface LandingCounts {
  documents: number;
  events: number;
  live: boolean;
}

export function landingCounts(): LandingCounts {
  try {
    const documents = queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM documents")?.n;
    const events = queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM audit_events")?.n;
    if (typeof documents !== "number" || typeof events !== "number") throw new Error("unreadable");
    return { documents, events, live: true };
  } catch {
    return { documents: DEFAULT_DOC_TYPES.length, events: AUDIT_ACTIONS.length, live: false };
  }
}

export interface LandingMessageInput {
  kind: "contact" | "subscribe";
  name?: string | null;
  email: string;
  message?: string | null;
}

/**
 * Landing-page enquiries are written straight into the product database.
 * `initSchema` is idempotent and creates the file if it is missing, so the
 * endpoint works on an install that has never been seeded.
 */
export function saveLandingMessage(input: LandingMessageInput): number {
  initSchema();
  return runInsert(
    `INSERT INTO landing_messages (kind, name, email, message) VALUES (?, ?, ?, ?)`,
    [input.kind, input.name ?? null, input.email, input.message ?? null],
  );
}