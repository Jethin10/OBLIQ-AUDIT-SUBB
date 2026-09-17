import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getSessionUser } from "@/lib/auth";
import { json, requirePermission, requireUser } from "@/lib/http";
import { ApiError } from "@/lib/errors";
import { queryOne, runInsert, transaction } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getClientForUser } from "@/lib/clients";
import { parseJsonBody, requireInt, requireSameOrigin, requireString } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireSameOrigin(request);
    const user = requireUser(await getSessionUser());
    requirePermission(user, "client:create");
    const { id } = await params;
    const clientId = Number(id);
    if (!Number.isInteger(clientId)) throw new ApiError(400, "Invalid client id");

    const body = await parseJsonBody(request);
    const docType = requireString(body.name, "Document name", 120);

    const result = transaction(() => {
      const client = getClientForUser(clientId, user);
      const existing = queryOne<{ id: number }>(
        `SELECT id FROM documents WHERE firm_id = ? AND client_id = ? AND doc_type = ?`,
        [user.firmId, client.id, docType]
      );
      if (existing) {
        throw new ApiError(409, "This document already exists for the client");
      }
      const documentId = runInsert(
        `INSERT INTO documents (firm_id, client_id, doc_type) VALUES (?, ?, ?)`,
        [user.firmId, client.id, docType]
      );
      recordAudit({
        firmId: user.firmId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        clientId: client.id,
        documentId,
        action: "DOCUMENT_REQUIRED",
        detail: `Added required document '${docType}'`,
      });
      return documentId;
    });
    return json({ id: result }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
