import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/errors";
import { createSession, verifyPassword } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { parseJsonBody, requireSameOrigin, requireString } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await parseJsonBody(request);
    const email = requireString(body.email, "email", 200).toLowerCase();
    const password = requireString(body.password, "password", 200);

    const row = queryOne<{
      id: number;
      password_hash: string;
    }>(`SELECT id, password_hash FROM users WHERE email = ?`, [email]);
    if (!row || !verifyPassword(password, row.password_hash)) {
      throw new ApiError(401, "Invalid email or password");
    }

    const { id, maxAgeSeconds } = await createSession(Number(row.id));
    const response = NextResponse.json({ ok: true });
    response.cookies.set("obliq_session", id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
