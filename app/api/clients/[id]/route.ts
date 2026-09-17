import { handleApiError } from "@/lib/errors";
import { getSessionUser } from "@/lib/auth";
import { json, requirePermission, requireUser } from "@/lib/http";
import {
  getClientForUser,
  listDocumentsForClient,
  listRecentEventsForClient,
} from "@/lib/clients";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireUser(await getSessionUser());
    requirePermission(user, "client:view");
    const { id } = await params;
    const clientId = Number(id);
    if (!Number.isInteger(clientId)) {
      return json({ error: "Invalid client id" }, 400);
    }
    const client = getClientForUser(clientId, user);
    return json({
      client,
      documents: listDocumentsForClient(clientId, user.firmId),
      events: listRecentEventsForClient(clientId, user.firmId),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
