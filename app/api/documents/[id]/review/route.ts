import { NextRequest } from "next/server";
import { handleApiError, ApiError } from "@/lib/errors";
import { getSessionUser } from "@/lib/auth";
import { json, requirePermission, requireUser } from "@/lib/http";
import { reviewAction } from "@/lib/documents";
import type { DocumentAction } from "@/lib/state";
import { parseJsonBody, requireSameOrigin } from "@/lib/validation";

const ACTIONS = new Set(["START_REVIEW", "APPROVE", "REQUEST_CORRECTION"]);

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
    const action = body.action;
    if (
      typeof action !== "string" ||
      !ACTIONS.has(action)
    ) {
      throw new ApiError(400, "action must be START_REVIEW, APPROVE or REQUEST_CORRECTION");
    }
    const comment =
      typeof body.comment === "string" && body.comment.trim().length > 0
        ? body.comment.trim().slice(0, 1000)
        : null;
    const expectedVersion =
      typeof body.version === "number" && Number.isInteger(body.version)
        ? body.version
        : null;

    reviewAction(user, documentId, action as DocumentAction, comment, expectedVersion);
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
