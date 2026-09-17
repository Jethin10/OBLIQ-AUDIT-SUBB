import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getSessionUser } from "@/lib/auth";
import { json, requirePermission, requireUser } from "@/lib/http";
import { createClient, listClientsForUser, listStaffForUser } from "@/lib/clients";
import { parseJsonBody, requireInt, requireSameOrigin, requireString } from "@/lib/validation";

export async function GET() {
  try {
    const user = requireUser(await getSessionUser());
    requirePermission(user, "client:view");
    return json({ clients: listClientsForUser(user), staff: listStaffForUser(user) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const user = requireUser(await getSessionUser());
    requirePermission(user, "client:create");
    const body = await parseJsonBody(request);
    const name = requireString(body.name, "Client name", 120);
    const assignedStaffId = requireInt(body.assignedStaffId, "assignedStaffId");
    const clientId = createClient(user, name, assignedStaffId);
    return json({ id: clientId }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
