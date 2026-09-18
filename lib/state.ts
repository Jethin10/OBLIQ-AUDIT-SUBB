/**
 * The document review state machine.
 *
 * The workflow spec suggests:
 *   Pending -> Uploaded -> Under Review -> Approved
 *   Correction Required -> Uploaded Again
 *
 * Implemented as an explicit allow-list of (currentStatus, action) pairs.
 * Any transition not in this table is rejected by the API with 409 Conflict —
 * the server, not the UI, is the single source of truth for workflow legality.
 */

export const DOCUMENT_STATUSES = [
  "PENDING",
  "UPLOADED",
  "UNDER_REVIEW",
  "APPROVED",
  "CORRECTION_REQUIRED",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export type DocumentAction =
  | "UPLOAD"
  | "START_REVIEW"
  | "APPROVE"
  | "REQUEST_CORRECTION";

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  PENDING: "Pending",
  UPLOADED: "Uploaded",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  CORRECTION_REQUIRED: "Correction Required",
};

/** key format: `${currentStatus}:${action}` */
const TRANSITIONS: Record<string, DocumentStatus> = {
  // Staff uploads a file for a pending checklist item
  "PENDING:UPLOAD": "UPLOADED",
  // Staff responds to a correction request with a revised file
  "CORRECTION_REQUIRED:UPLOAD": "UPLOADED",
  // NOTE: there is intentionally no "APPROVED:UPLOAD" transition.
  // An approved sign-off is immutable — storeUpload rejects uploads to
  // APPROVED documents with 409, and the acceptance suite asserts this.
  // Re-opening an approved item would need a new review cycle, which is
  // out of scope for this prototype.

  // Reviewer picks the document up
  "UPLOADED:START_REVIEW": "UNDER_REVIEW",
  // Reviewer re-opens a corrected submission
  "CORRECTION_REQUIRED:START_REVIEW": "UNDER_REVIEW",

  // Reviewer decides (direct decision from UPLOADED is allowed for small
  // firms where a reviewer may approve without a separate "start" click)
  "UPLOADED:APPROVE": "APPROVED",
  "UPLOADED:REQUEST_CORRECTION": "CORRECTION_REQUIRED",
  "UNDER_REVIEW:APPROVE": "APPROVED",
  "UNDER_REVIEW:REQUEST_CORRECTION": "CORRECTION_REQUIRED",
  // Reviewer can add more correction reasons while already in correction
  "CORRECTION_REQUIRED:REQUEST_CORRECTION": "CORRECTION_REQUIRED",
};

export function nextStatus(
  current: DocumentStatus,
  action: DocumentAction
): DocumentStatus | null {
  return TRANSITIONS[`${current}:${action}`] ?? null;
}

/**
 * Segregation of duties: the person who produces the evidence (STAFF) is not
 * the person who reviews it (REVIEWER).
 */
export function actionAllowedForRole(
  role: string,
  action: DocumentAction
): boolean {
  if (role === "ADMIN") return true;
  if (action === "UPLOAD") return role === "STAFF";
  return role === "REVIEWER";
}
