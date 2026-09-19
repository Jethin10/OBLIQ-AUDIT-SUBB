import { handleApiError, ApiError } from "@/lib/errors";
import { getSessionUser } from "@/lib/auth";
import { requirePermission, requireUser } from "@/lib/http";
import { getClientForUser } from "@/lib/clients";
import { query } from "@/lib/db";

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Download the client's full audit trail as CSV. Every material action, in
 * order, firm-scoped exactly like the on-screen history. This is the portable
 * record a CA firm hands over when it needs to evidence the review.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireUser(await getSessionUser());
    requirePermission(user, "client:view");
    const { id } = await params;
    const clientId = Number(id);
    if (!Number.isInteger(clientId)) throw new ApiError(400, "Invalid client id");

    const client = getClientForUser(clientId, user);
    const events = query(
      `SELECT ae.id, ae.created_at, ae.actor_name, ae.actor_role, ae.action,
              ae.version, ae.detail, d.doc_type
         FROM audit_events ae
         LEFT JOIN documents d ON d.id = ae.document_id AND d.firm_id = ae.firm_id
        WHERE ae.firm_id = ? AND ae.client_id = ?
        ORDER BY ae.id ASC`,
      [user.firmId, client.id]
    );

    const header = ["id", "timestamp_utc", "actor", "role", "action", "document", "version", "detail"];
    const lines = [header.join(",")];
    for (const e of events as Array<Record<string, unknown>>) {
      lines.push([
        e.id, e.created_at, e.actor_name, e.actor_role, e.action,
        e.doc_type ?? "", e.version ?? "", e.detail ?? "",
      ].map(csvCell).join(","));
    }

    const filename = `${client.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-audit-trail.csv`;
    return new Response(lines.join("\r\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
