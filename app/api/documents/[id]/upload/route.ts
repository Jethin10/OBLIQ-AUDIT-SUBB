import { NextRequest } from "next/server";
import { handleApiError, ApiError } from "@/lib/errors";
import { getSessionUser } from "@/lib/auth";
import { json, requirePermission, requireUser } from "@/lib/http";
import { storeUpload } from "@/lib/documents";
import { requireSameOrigin } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireSameOrigin(request);
    const user = requireUser(await getSessionUser());
    requirePermission(user, "document:upload");
    const { id } = await params;
    const documentId = Number(id);
    if (!Number.isInteger(documentId)) throw new ApiError(400, "Invalid document id");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "A file is required");
    const rawVersion = form.get("version");
    const expectedVersion =
      typeof rawVersion === "string" && /^-?\d+$/.test(rawVersion)
        ? Number(rawVersion)
        : null;

    await storeUpload(user, documentId, file, expectedVersion);
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
