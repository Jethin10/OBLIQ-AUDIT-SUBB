import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { destroySession } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    await destroySession();
    return Response.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
