import { handleApiError } from "@/lib/errors";
import { getSessionUser } from "@/lib/auth";
import { json, requirePermission, requireUser } from "@/lib/http";
import {
  getDocumentForUser,
  listEventsForDocument,
  listVersionsForDocument,
} from "@/lib/documents";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireUser(await getSessionUser());
    requirePermission(user, "document:view");
    const { id } = await params;
    const documentId = Number(id);
    if (!Number.isInteger(documentId)) {
      return json({ error: "Invalid document id" }, 400);
    }
    const document = getDocumentForUser(documentId, user);
    return json({
      document,
      versions: listVersionsForDocument(documentId, user.firmId),
      events: listEventsForDocument(documentId, user.firmId),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
