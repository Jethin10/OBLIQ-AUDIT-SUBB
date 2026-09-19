"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const ROOT_CLASS = "obliq-landing";
const RUNTIME_CLASS = "obliq-runtime";
const NO_MOTION_CLASS = "obliq-no-motion";
const MENU_OPEN_CLASS = "obliq-menu-open";
const THEME_SCRIPT = "/landing/wp-content/themes/ario/assets/js/app.js";
const FORMS_SCRIPT = "/landing/obliq-forms.js";
const RUNTIME_TIMEOUT_MS = 6000;

/**
 * Boots the reference theme's own animation runtime on "/" and owns the
 * fallbacks when that bundle cannot run. The runtime (GSAP + ScrollTrigger +
 * ScrollSmoother + Barba, patched so Barba never hijacks navigation) drives
 * the preloader intro, pinned hero, line reveals, 3D workflow cube, partner
 * hover swaps, marquee, cursor and fullscreen menu. This shell only flags
 * pre-paint CSS, marks runtime-ready vs no-motion fallback, toggles the
 * menu + cookie bar while the runtime is absent, and saves battery on the
 * hero clip off-screen.
 *
 * Reduced-motion users never load the runtime at all: the early bootstrap
 * in app/page.tsx flags html.obliq-no-motion pre-paint and the override
 * stylesheet reveals a fully static page instead.
 */
export function LandingShell() {
  // Decided once, before first paint, by the bootstrap in app/page.tsx.
  const [loadRuntime] = useState(
    () =>
      typeof window === "undefined" ||
      !document.documentElement.classList.contains(NO_MOTION_CLASS)
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(ROOT_CLASS);

    const button = document.querySelector<HTMLButtonElement>("button.brg-btn");
    const menu = document.querySelector<HTMLElement>("#mn");
    const cookieBar = document.querySelector<HTMLElement>("#acpt-policy");
    const cookieButton = cookieBar?.querySelector<HTMLButtonElement>("button.-yes");
    const heroVideo = document.querySelector<HTMLVideoElement>("#hm-in video");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const runtimeReady = () => root.classList.contains(RUNTIME_CLASS);
    const closeMenu = () => {
      root.classList.remove(MENU_OPEN_CLASS);
      button?.setAttribute("aria-expanded", "false");
    };
    const toggleMenuFallback = () => {
      // The theme binds its own GSAP menu timeline to the same button. Only
      // drive the CSS fallback while the runtime has not taken over.
      if (runtimeReady()) return;
      const isOpen = root.classList.toggle(MENU_OPEN_CLASS);
      button?.setAttribute("aria-expanded", String(isOpen));
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    const dismissCookie = () => cookieBar?.classList.add("is-dismissed");

    button?.setAttribute("aria-label", "Open navigation");
    button?.setAttribute("aria-expanded", "false");
    button?.addEventListener("click", toggleMenuFallback);
    menu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    cookieButton?.addEventListener("click", dismissCookie);
    document.addEventListener("keydown", handleKey);

    const markRuntime = () => {
      root.classList.add(RUNTIME_CLASS);
      root.classList.remove(NO_MOTION_CLASS, MENU_OPEN_CLASS);
    };

    // The bundle exposes no ready callback, so probe for its footprints:
    // the GSAP global, SplitText line masks, or the dismissed preloader.
    const probe = window.setInterval(() => {
      const win = window as unknown as Record<string, unknown>;
      const booted =
        win.gsap !== undefined ||
        document.querySelector("#hm-in .ln-msk, footer .ln-msk") !== null ||
        document.querySelector("#prldr[style*='visibility: hidden'], #prldr[style*='opacity: 0']") !== null;
      if (booted) {
        markRuntime();
        window.clearInterval(probe);
        window.clearTimeout(fallbackTimer);
      }
    }, 250);
    const fallbackTimer = window.setTimeout(() => {
      window.clearInterval(probe);
      if (!runtimeReady()) root.classList.add(NO_MOTION_CLASS);
    }, RUNTIME_TIMEOUT_MS);

    let videoObserver: IntersectionObserver | undefined;
    if (heroVideo) {
      heroVideo.muted = true;
      if (reduceMotion) {
        heroVideo.removeAttribute("autoplay");
        heroVideo.pause();
      } else {
        videoObserver = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              void heroVideo.play().catch(() => undefined);
            } else {
              heroVideo.pause();
            }
          },
          { rootMargin: "120px 0px", threshold: 0.05 }
        );
        videoObserver.observe(heroVideo);
      }
    }

    return () => {
      window.clearInterval(probe);
      window.clearTimeout(fallbackTimer);
      button?.removeEventListener("click", toggleMenuFallback);
      menu?.querySelectorAll("a").forEach((link) => link.removeEventListener("click", closeMenu));
      cookieButton?.removeEventListener("click", dismissCookie);
      document.removeEventListener("keydown", handleKey);
      videoObserver?.disconnect();
      root.classList.remove(ROOT_CLASS, RUNTIME_CLASS, MENU_OPEN_CLASS);
    };
  }, []);

  return (
    <>
      {loadRuntime && (
        <Script
          src={THEME_SCRIPT}
          strategy="afterInteractive"
          onError={() => document.documentElement.classList.add(NO_MOTION_CLASS)}
        />
      )}
      <Script src={FORMS_SCRIPT} strategy="afterInteractive" />
    </>
  );
}

