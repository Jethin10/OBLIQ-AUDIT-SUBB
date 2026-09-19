import type { Metadata } from "next";

import { landingCounts } from "@/lib/landing";

import { landingHtml } from "./landing-content";
import { LandingShell } from "./landing-shell";

import "./landing.css";
import "./landing-overrides.css";

/**
 * The landing page.
 *
 * The markup is the reference theme's own (see scripts/build-landing.mjs)
 * with OBLIQ's copy in it, so the theme's stylesheet and its compiled GSAP
 * bundle drive the page exactly as they drive the reference. This file only
 * fills in the live counts from the product database and starts that
 * runtime (see app/landing-shell.tsx). If the bundle cannot run, the shell
 * flags html.obliq-no-motion and landing-overrides.css reveals a static
 * fallback instead.
 */

export const metadata: Metadata = {
  title: "OBLIQ Audit | Every document, every decision, one record",
  description:
    "Audit document review for CA firms: five required documents per client, versioned uploads, reviewer decisions with a written reason and an append-only audit trail.",
};

// The stat cards read the database, so the page renders per request.
export const dynamic = "force-dynamic";

const EARLY_CLASS_JS =
  '(function(){try{var r=document.documentElement;if(window.location.pathname==="/"){r.classList.add("obliq-landing");if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)r.classList.add("obliq-no-motion");}}catch(e){}})();';

export default function Home() {
  const counts = landingCounts();
  const markup = landingHtml
    .replaceAll("{{STAT_DOCUMENTS}}", String(counts.documents))
    .replaceAll("{{STAT_EVENTS}}", String(counts.events));

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EARLY_CLASS_JS }} />
      <LandingShell />
      <div
        id="obliq-landing"
        className="obliq-landing"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </>
  );
}