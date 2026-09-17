import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return json({ error: err.message }, err.status);
  }
  console.error("[api] unhandled error:", err);
  return json({ error: "Internal server error" }, 500);
}
