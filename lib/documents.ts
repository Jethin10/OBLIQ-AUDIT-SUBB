import { ApiError } from "./errors";
import { query, queryOne, run, runInsert, transaction } from "./db";
import { recordAudit } from "./audit";
import type { SessionUser } from "./auth";
import {
  actionAllowedForRole,
  nextStatus,
  STATUS_LABELS,
  type DocumentAction,
} from "./state";
import { UPLOAD_MAX_BYTES, isAllowedMime, isSafeBaseName } from "./validation";

/**
 * Document workflow service. Every mutation runs inside one transaction that
 * also writes the audit event, and every read/update filters on the session's
 * firm — authorization and traceability are enforced here, not in the UI.
 */

export interface DocumentRow {
  id: number;
  firm_id: number;
  client_id: number;
  client_name: string;
  doc_type: string;
  status: string;
  version: number;
  file_name: string | null;
  file_mime: string | null;
  file_size: number | null;
  uploaded_at: string | null;
  review_started_by: number | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  correction_comment: string | null;
  uploader_name: string | null;
  reviewer_name: string | null;
  due_date: string | null;
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status;
}

export function getDocumentForUser(documentId: number, user: SessionUser): DocumentRow {
  const doc = queryOne<
    DocumentRow & { assigned_staff_id: number | null }
  >(
    `SELECT d.id, d.firm_id, d.client_id, d.doc_type, d.status, d.version,
            d.file_name, d.file_mime, d.file_size, d.uploaded_at,
            d.review_started_by, d.reviewed_by, d.reviewed_at,
            d.correction_comment, d.due_date,
            c.name AS client_name, c.assigned_staff_id,
            up.name AS uploader_name, rv.name AS reviewer_name
       FROM documents d
       JOIN clients c ON c.id = d.client_id AND c.firm_id = d.firm_id
       LEFT JOIN users up ON up.id = d.uploaded_by
       LEFT JOIN users rv ON rv.id = d.reviewed_by
      WHERE d.id = ? AND d.firm_id = ?`,
    [documentId, user.firmId]
  );
  if (!doc) throw new ApiError(404, "Document not found");
  // Staff may only read documents for clients assigned to them. Reviewers
  // see every client in their firm. Return 404 (not 403) so an unassigned
  // staff member cannot probe for the existence of other clients' docs —
  // consistent with getClientForUser which filters by assignment.
  if (user.role === "STAFF" && doc.assigned_staff_id !== user.id) {
    throw new ApiError(404, "Document not found");
  }
  // Strip the internal assignment column before returning to callers.
  const { assigned_staff_id, ...publicDoc } = doc;
  void assigned_staff_id;
  return publicDoc as DocumentRow;
}

export function listEventsForDocument(documentId: number, firmId: number) {
  return query(
    `SELECT id, actor_name, actor_role, action, version, detail, created_at
       FROM audit_events
      WHERE firm_id = ? AND document_id = ?
      ORDER BY id ASC`,
    [firmId, documentId]
  );
}

export function listVersionsForDocument(documentId: number, firmId: number) {
  return query(
    `SELECT v.version, v.file_name, v.file_size, v.uploaded_at, u.name AS uploader_name
       FROM document_versions v
       JOIN users u ON u.id = v.uploaded_by
      WHERE v.firm_id = ? AND v.document_id = ?
      ORDER BY v.version ASC`,
    [firmId, documentId]
  );
}

export function getVersionFile(documentId: number, version: number, firmId: number) {
  return queryOne<{ content: Uint8Array; file_name: string; file_mime: string }>(
    `SELECT v.content, v.file_name, v.file_mime
       FROM document_versions v
      WHERE v.firm_id = ? AND v.document_id = ? AND v.version = ?`,
    [firmId, documentId, version]
  );
}

/** Loads the document and enforces staff assignment. Shared by upload/review. */
function loadOwnedDocument(user: SessionUser, documentId: number) {
  const doc = queryOne<{
    id: number;
    client_id: number;
    doc_type: string;
    status: string;
    version: number;
    review_started_by: number | null;
    assigned_staff_id: number | null;
  }>(
    `SELECT d.id, d.client_id, d.doc_type, d.status, d.version,
            d.review_started_by, c.assigned_staff_id
       FROM documents d
       JOIN clients c ON c.id = d.client_id
      WHERE d.id = ? AND d.firm_id = ?`,
    [documentId, user.firmId]
  );
  if (!doc) throw new ApiError(404, "Document not found");
  // Same 404 as getDocumentForUser: an unassigned staffer must not be able
  // to distinguish "another client's document" from "no such document".
  if (user.role === "STAFF" && doc.assigned_staff_id !== user.id) {
    throw new ApiError(404, "Document not found");
  }
  return doc;
}

export async function storeUpload(
  user: SessionUser,
  documentId: number,
  file: File,
  expectedVersion: number | null
): Promise<void> {
  if (!actionAllowedForRole(user.role, "UPLOAD")) {
    throw new ApiError(403, "Only staff members can upload documents");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) throw new ApiError(400, "Uploaded file is empty");
  if (bytes.length > UPLOAD_MAX_BYTES) {
    throw new ApiError(413, "File exceeds the 10 MB limit");
  }
  const fileName = file.name || "upload.bin";
  if (!isSafeBaseName(fileName)) {
    throw new ApiError(400, "Invalid file name");
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedMime(mime)) {
    throw new ApiError(
      400,
      "File type not allowed. Upload PDF, PNG, JPEG, CSV or Excel files."
    );
  }

  transaction(() => {
    const doc = loadOwnedDocument(user, documentId);

    if (doc.status === "APPROVED") {
      throw new ApiError(
        409,
        "This document is approved and can no longer be modified"
      );
    }
    const target = nextStatus(doc.status as never, "UPLOAD");
    if (!target) {
      throw new ApiError(
        409,
        `Upload is not allowed while the document is '${statusLabel(doc.status)}'`
      );
    }
    if (expectedVersion !== null && expectedVersion !== doc.version) {
      throw new ApiError(
        409,
        "Someone else updated this document. Refresh and try again."
      );
    }

    const newVersion = doc.version + 1;
    run(
      `UPDATE documents SET
         status = ?, version = ?, file_name = ?, file_mime = ?, file_size = ?,
         uploaded_by = ?, uploaded_at = datetime('now'),
         review_started_by = NULL, review_started_at = NULL,
         reviewed_by = NULL, reviewed_at = NULL, correction_comment = NULL
       WHERE id = ? AND firm_id = ?`,
      [target, newVersion, fileName, mime, bytes.length, user.id, doc.id, user.firmId]
    );
    runInsert(
      `INSERT INTO document_versions
         (firm_id, document_id, version, file_name, file_mime, file_size, content, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.firmId, doc.id, newVersion, fileName, mime, bytes.length, bytes, user.id]
    );
    recordAudit({
      firmId: user.firmId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      clientId: doc.client_id,
      documentId: doc.id,
      action: "DOCUMENT_UPLOADED",
      version: newVersion,
      detail: `Uploaded '${fileName}' for ${doc.doc_type}`,
    });
  });
}

/**
 * Set (or clear) a document's due date. Reviewers own deadlines. This is a
 * workflow metadata change, so it is audited like every other material action.
 * `dueDate` is an ISO `YYYY-MM-DD` string, or null to clear.
 */
export function setDocumentDueDate(
  user: SessionUser,
  documentId: number,
  dueDate: string | null
): void {
  if (user.role !== "REVIEWER") {
    throw new ApiError(403, "Only reviewers can set due dates");
  }
  transaction(() => {
    const doc = loadOwnedDocument(user, documentId);
    run(
      `UPDATE documents SET due_date = ? WHERE id = ? AND firm_id = ?`,
      [dueDate, doc.id, user.firmId]
    );
    recordAudit({
      firmId: user.firmId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      clientId: doc.client_id,
      documentId: doc.id,
      action: "DUE_DATE_SET",
      version: doc.version,
      detail: dueDate
        ? `Due date set to ${dueDate} for '${doc.doc_type}'`
        : `Due date cleared for '${doc.doc_type}'`,
    });
  });
}

export function reviewAction(
  user: SessionUser,
  documentId: number,
  action: DocumentAction,
  comment: string | null,
  expectedVersion: number | null
): void {
  if (!actionAllowedForRole(user.role, action)) {
    throw new ApiError(
      403,
      `Role '${user.role}' cannot perform '${action}' — reviews are done by reviewers`
    );
  }

  transaction(() => {
    const doc = loadOwnedDocument(user, documentId);

    if (expectedVersion !== null && expectedVersion !== doc.version) {
      throw new ApiError(
        409,
        "Someone else updated this document. Refresh and try again."
      );
    }

    const target = nextStatus(doc.status as never, action);
    if (!target) {
      throw new ApiError(
        409,
        `'${action}' is not allowed while the document is '${statusLabel(doc.status)}'`
      );
    }
    if (
      (action === "APPROVE" || action === "REQUEST_CORRECTION") &&
      doc.review_started_by !== null &&
      doc.review_started_by !== user.id
    ) {
      throw new ApiError(409, "Another reviewer has started reviewing this document");
    }
    if (action === "REQUEST_CORRECTION" && !comment) {
      throw new ApiError(400, "A correction reason is required");
    }

    if (action === "START_REVIEW") {
      run(
        `UPDATE documents SET status = ?,
           review_started_by = ?, review_started_at = datetime('now'),
           assigned_reviewer_id = ?
         WHERE id = ? AND firm_id = ?`,
        [target, user.id, user.id, doc.id, user.firmId]
      );
      recordAudit({
        firmId: user.firmId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        clientId: doc.client_id,
        documentId: doc.id,
        action: "REVIEW_STARTED",
        version: doc.version,
        detail: `Started reviewing '${doc.doc_type}'`,
      });
      return;
    }

    if (action === "APPROVE") {
      run(
        `UPDATE documents SET status = ?,
           reviewed_by = ?, reviewed_at = datetime('now'), correction_comment = NULL
         WHERE id = ? AND firm_id = ?`,
        [target, user.id, doc.id, user.firmId]
      );
      recordAudit({
        firmId: user.firmId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        clientId: doc.client_id,
        documentId: doc.id,
        action: "DOCUMENT_APPROVED",
        version: doc.version,
        detail: comment ? `Approved. ${comment}` : "Approved",
      });
      return;
    }

    // REQUEST_CORRECTION
    run(
      `UPDATE documents SET status = ?,
         correction_comment = ?, reviewed_by = ?, reviewed_at = datetime('now')
       WHERE id = ? AND firm_id = ?`,
      [target, comment, user.id, doc.id, user.firmId]
    );
    recordAudit({
      firmId: user.firmId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      clientId: doc.client_id,
      documentId: doc.id,
      action: "CORRECTION_REQUESTED",
      version: doc.version,
      detail: comment ?? "",
    });
  });
}

