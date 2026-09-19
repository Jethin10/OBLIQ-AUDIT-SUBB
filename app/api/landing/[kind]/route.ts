import { ApiError, handleApiError } from "@/lib/errors";
import { json } from "@/lib/http";
import { saveLandingMessage } from "@/lib/landing";
import { parseJsonBody, requireSameOrigin, requireString } from "@/lib/validation";

/**
 * The landing page's two public forms.
 *
 *   POST /api/landing/contact    { name, email, message }
 *   POST /api/landing/subscribe  { email }
 *
 * Both write into `landing_messages` (see lib/landing.ts) and answer with the
 * line the theme prints in `.wpcf7-response-output`.
 */

const FORMS = {
  contact: { ok: "Thanks - we'll come back to you about the walkthrough." },
  subscribe: { ok: "You're on the list. Product notes only, no newsletter noise." },
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  try {
    requireSameOrigin(request);
    const { kind } = await params;
    const form = FORMS[kind as keyof typeof FORMS];
    if (!form) throw new ApiError(404, "Unknown landing form");

    const body = await parseJsonBody(request);
    const email = requireString(body.email, "email", 200).toLowerCase();
    if (!EMAIL.test(email)) throw new ApiError(400, "Enter a valid email address");

    const name = kind === "contact" ? requireString(body.name, "name", 120) : null;
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : null;

    saveLandingMessage({ kind: kind as "contact" | "subscribe", name, email, message });

    return json({ ok: true, message: form.ok });
  } catch (err) {
    return handleApiError(err);
  }
}