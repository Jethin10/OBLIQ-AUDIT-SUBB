import { runInsert, type DbValue } from "./db";

/**
 * Audit trail.
 *
 * `recordAudit` is a raw INSERT into audit_events. The schema installs
 * triggers that reject UPDATE/DELETE on that table, so the log is
 * append-only at the database level. Writes happen inside the same
 * transaction as the action being recorded (see callers in lib/documents.ts).
 */

export type AuditAction =
  | "CLIENT_CREATED"
  | "DOCUMENT_REQUIRED"
  | "DOCUMENT_UPLOADED"
  | "REVIEW_STARTED"
  | "DOCUMENT_APPROVED"
  | "CORRECTION_REQUESTED"
  | "ACCESS_DENIED";

export interface AuditEventInput {
  firmId: number;
  actorId: number | null;
  actorName: string;
  actorRole: "STAFF" | "REVIEWER" | "ADMIN" | "SYSTEM";
  clientId: number | null;
  documentId: number | null;
  action: AuditAction;
  version?: number | null;
  detail?: string | null;
}

export function recordAudit(event: AuditEventInput): number {
  const params: DbValue[] = [
    event.firmId,
    event.actorId,
    event.actorName,
    event.actorRole,
    event.clientId,
    event.documentId,
    event.action,
    event.version ?? null,
    event.detail ?? null,
  ];
  return runInsert(
    `INSERT INTO audit_events
       (firm_id, actor_id, actor_name, actor_role, client_id, document_id, action, version, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params
  );
}

/** Used only by the seeder for pre-evaluation context lines. */
export function recordSystemAudit(
  firmId: number,
  action: AuditAction,
  detail: string,
  clientId: number | null = null
): number {
  return runInsert(
    `INSERT INTO audit_events
       (firm_id, actor_id, actor_name, actor_role, client_id, document_id, action, version, detail)
     VALUES (?, NULL, 'System', 'SYSTEM', ?, NULL, ?, NULL, ?)`,
    [firmId, clientId, action, detail]
  );
}
