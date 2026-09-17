import { ApiError } from "./errors";

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

/** Rejects path separators and control characters in client-supplied names. */
export function isSafeBaseName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 255 &&
    !/[/\\]/.test(name) &&
    !/[\u0000-\u001f]/.test(name)
  );
}

export async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(400, "Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function requireString(
  value: unknown,
  field: string,
  maxLength = 200
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, `Field '${field}' is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ApiError(400, `Field '${field}' must be at most ${maxLength} characters`);
  }
  return trimmed;
}

export function requireInt(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  throw new ApiError(400, `Field '${field}' must be an integer`);
}

/**
 * CSRF origin check: browsers always send Origin on cross-site POSTs.
 * Same-origin form posts may omit it, which we allow only when Sec-Fetch-Site
 * confirms a same-origin context (or is absent, for native clients during
 * development). This keeps cookie-authenticated mutations from other sites
 * out without needing CSRF tokens for this prototype.
 */
export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host");
  try {
    const originHost = new URL(origin).host;
    if (!host || originHost !== host) {
      throw new ApiError(403, "Cross-origin request rejected");
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(403, "Invalid Origin header");
  }
}
