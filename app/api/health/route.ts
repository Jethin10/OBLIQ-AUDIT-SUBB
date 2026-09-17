import { handleApiError } from "@/lib/errors";

export async function GET() {
  try {
    return Response.json({ ok: true, service: "obliq-audit" });
  } catch (err) {
    return handleApiError(err);
  }
}
