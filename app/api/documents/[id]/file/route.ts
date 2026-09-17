import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getSessionUser } from "@/lib/auth";
import { requirePermission, requireUser } from "@/lib/http";
import { getDocumentForUser, getVersionFile } from "@/lib/documents";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireUser(await getSessionUser());
    requirePermission(user, "document:view");
    const { id } = await params;
    const documentId = Number(id);
    if (!Number.isInteger(documentId)) {
      return Response.json({ error: "Invalid document id" }, { status: 400 });
    }
    // Existence + tenancy check first (404 must not leak file bytes either way)
    getDocumentForUser(documentId, user);

    const versionParam = request.nextUrl.searchParams.get("version");
    const current = getDocumentForUser(documentId, user).version;
    const version =
      versionParam && /^\d+$/.test(versionParam) ? Number(versionParam) : current;

    const file = getVersionFile(documentId, version, user.firmId);
    if (!file) {
      return Response.json({ error: "Version not found" }, { status: 404 });
    }
    const body = Buffer.from(file.content);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": file.file_mime || "application/octet-stream",
        "Content-Length": String(body.length),
        "Content-Disposition": `attachment; filename="${file.file_name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
