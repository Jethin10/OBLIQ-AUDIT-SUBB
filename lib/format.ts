/** Formats SQLite UTC 'YYYY-MM-DD HH:MM:SS' timestamps for display. */
export function formatDateTime(sqliteUtc: string | null | undefined): string {
  if (!sqliteUtc) return "—";
  const normalized = sqliteUtc.includes("T") ? sqliteUtc : `${sqliteUtc.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return sqliteUtc;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export const ACTION_LABELS: Record<string, string> = {
  CLIENT_CREATED: "Client created",
  DOCUMENT_REQUIRED: "Document required",
  DOCUMENT_UPLOADED: "Uploaded",
  REVIEW_STARTED: "Review started",
  DOCUMENT_APPROVED: "Approved",
  CORRECTION_REQUESTED: "Correction requested",
};

export const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600 ring-slate-200",
  UPLOADED: "bg-blue-50 text-blue-700 ring-blue-200",
  UNDER_REVIEW: "bg-amber-50 text-amber-700 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CORRECTION_REQUIRED: "bg-red-50 text-red-700 ring-red-200",
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  UPLOADED: "Uploaded",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  CORRECTION_REQUIRED: "Correction Required",
};
