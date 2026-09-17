import { ApiError } from "./errors";
import { query, queryOne, run, runInsert, transaction } from "./db";
import { recordAudit, recordSystemAudit } from "./audit";
import type { SessionUser } from "./auth";

/**
 * Client + document-checklist service. All reads/writes are firm-scoped by
 * the session; a reviewer can create clients (and their default checklist),
 * while staff only see clients assigned to them.
 */

const DEFAULT_DOC_TYPES = [
  "Bank Statement",
  "Sales Register",
  "Purchase Register",
  "GST Return",
  "Expense Summary",
];

export interface ClientListRow {
  id: number;
  name: string;
  assigned_staff_id: number | null;
  staff_name: string | null;
  total: number;
  approved: number;
  corrections: number;
}

export function listClientsForUser(user: SessionUser): ClientListRow[] {
  const base = `
    SELECT c.id, c.name, c.assigned_staff_id, u.name AS staff_name,
           (SELECT COUNT(*) FROM documents d WHERE d.client_id = c.id) AS total,
           (SELECT COUNT(*) FROM documents d WHERE d.client_id = c.id AND d.status = 'APPROVED') AS approved,
           (SELECT COUNT(*) FROM documents d WHERE d.client_id = c.id AND d.status = 'CORRECTION_REQUIRED') AS corrections
      FROM clients c
      LEFT JOIN users u ON u.id = c.assigned_staff_id
     WHERE c.firm_id = ?`;

  if (user.role === "REVIEWER") {
    return query<ClientListRow>(base + " ORDER BY c.name ASC", [user.firmId]);
  }
  return query<ClientListRow>(
    base + " AND c.assigned_staff_id = ? ORDER BY c.name ASC",
    [user.firmId, user.id]
  );
}

export function listStaffForUser(user: SessionUser) {
  if (user.role !== "REVIEWER") return [];
  return query<{ id: number; name: string }>(
    `SELECT id, name FROM users WHERE firm_id = ? AND role = 'STAFF' ORDER BY name ASC`,
    [user.firmId]
  );
}

export interface ClientRow {
  id: number;
  name: string;
  assigned_staff_id: number | null;
  staff_name: string | null;
}

export function getClientForUser(clientId: number, user: SessionUser): ClientRow {
  const base = `SELECT c.id, c.name, c.assigned_staff_id, u.name AS staff_name
      FROM clients c LEFT JOIN users u ON u.id = c.assigned_staff_id
     WHERE c.id = ? AND c.firm_id = ?`;

  const client =
    user.role === "REVIEWER"
      ? queryOne<ClientRow>(base, [clientId, user.firmId])
      : queryOne<ClientRow>(base + " AND c.assigned_staff_id = ?", [clientId, user.firmId, user.id]);

  if (!client) throw new ApiError(404, "Client not found");
  return client;
}

export interface DocumentListRow {
  id: number;
  doc_type: string;
  status: string;
  version: number;
  uploaded_at: string | null;
  uploader_name: string | null;
  correction_comment: string | null;
}

export function listDocumentsForClient(clientId: number, firmId: number): DocumentListRow[] {
  return query<DocumentListRow>(
    `SELECT d.id, d.doc_type, d.status, d.version, d.uploaded_at,
            up.name AS uploader_name, d.correction_comment
       FROM documents d
       LEFT JOIN users up ON up.id = d.uploaded_by
      WHERE d.firm_id = ? AND d.client_id = ?
      ORDER BY d.id ASC`,
    [firmId, clientId]
  );
}

export interface EventRow {
  id: number;
  actor_name: string;
  actor_role: string;
  action: string;
  version: number | null;
  detail: string | null;
  created_at: string;
  document_id: number | null;
}

export function listRecentEventsForClient(clientId: number, firmId: number): EventRow[] {
  return query<EventRow>(
    `SELECT id, actor_name, actor_role, action, version, detail, created_at, document_id
       FROM audit_events
      WHERE firm_id = ? AND client_id = ?
      ORDER BY id DESC
      LIMIT 20`,
    [firmId, clientId]
  );
}

export function createClient(
  user: SessionUser,
  name: string,
  assignedStaffId: number
) {
  if (user.role !== "REVIEWER") {
    throw new ApiError(403, "Only reviewers can create clients");
  }
  return transaction(() => {
    const staff = queryOne<{ id: number }>(
      `SELECT id FROM users WHERE id = ? AND firm_id = ? AND role = 'STAFF'`,
      [assignedStaffId, user.firmId]
    );
    if (!staff) throw new ApiError(400, "Assigned staff must be a user of your firm");
    const existing = queryOne<{ id: number }>(
      `SELECT id FROM clients WHERE firm_id = ? AND name = ?`,
      [user.firmId, name]
    );
    if (existing) throw new ApiError(409, "A client with this name already exists");
    const clientId = runInsert(
      `INSERT INTO clients (firm_id, name, assigned_staff_id) VALUES (?, ?, ?)`,
      [user.firmId, name, staff.id]
    );
    for (const docType of DEFAULT_DOC_TYPES) {
      runInsert(
        `INSERT INTO documents (firm_id, client_id, doc_type) VALUES (?, ?, ?)`,
        [user.firmId, clientId, docType]
      );
    }
    recordAudit({
      firmId: user.firmId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      clientId,
      documentId: null,
      action: "CLIENT_CREATED",
      detail: `Client created with ${DEFAULT_DOC_TYPES.length}-document checklist`,
    });
    recordSystemAudit(
      user.firmId,
      "DOCUMENT_REQUIRED",
      `Checklist created: ${DEFAULT_DOC_TYPES.join(", ")}`,
      clientId
    );
    return clientId;
  });
}
