import { NextRequest } from "next/server";
import { handleApiError, ApiError } from "@/lib/errors";
import { getSessionUser } from "@/lib/auth";
import { json, requirePermission, requireUser } from "@/lib/http";
import { setDocumentDueDate } from "@/lib/documents";
import { parseJsonBody, requireSameOrigin, optionalDate } from "@/lib/validation";

/**
 * Set or clear a document's due date. Reviewer-only (enforced again inside the
 * service). Body: { dueDate: "YYYY-MM-DD" | null }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireSameOrigin(request);
    const user = requireUser(await getSessionUser());
    requirePermission(user, "document:review");
    const { id } = await params;
    const documentId = Number(id);
    if (!Number.isInteger(documentId)) throw new ApiError(400, "Invalid document id");

    const body = await parseJsonBody(request);
    const dueDate = optionalDate(body.dueDate, "dueDate");

    setDocumentDueDate(user, documentId, dueDate);
    return json({ ok: true, dueDate });
  } catch (err) {
    return handleApiError(err);
  }
}
