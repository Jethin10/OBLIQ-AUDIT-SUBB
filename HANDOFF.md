# OBLIQ handoff

## Mission

OBLIQ is a Next.js audit-document review demo for Indian CA firms. The product workflow is the functional source of truth. The extracted Ario site is the visual source of truth for the landing page only.

Keep the reference composition, typography, spacing, responsive rearrangement, and motion. Replace Ario's identity, legal copy, links, people, images, and video with OBLIQ material. Preserve the existing login, client, upload, review, authorization, and audit-trail behavior.

## Start here

- Product overview and demo accounts: `README.md`
- Current landing entry: `app/page.tsx`
- Client-side theme bootstrap and preloader fallback: `app/landing-shell.tsx`
- Deliberate CSS adaptations: `app/landing-overrides.css`
- Landing generator: `scripts/build-landing.mjs`
- Reference HTML and extracted site: `reference-ui/`
- Working visual reference: `http://localhost:4319/ario.law/index.html`
- Local replacement media and provenance: `public/landing/CREDITS.md`

The generated files `app/landing-content.ts` and `app/landing.css` are outputs. Change the generator or override file, then run `node scripts/build-landing.mjs`. Direct edits to generated files will be overwritten.

## Current architecture

`scripts/build-landing.mjs` reads `reference-ui/ario-raw.html`, removes WordPress and tracking plumbing, rewrites links and assets, injects OBLIQ copy, inserts live-stat tokens, scopes the reference CSS to `html.obliq-landing`, and writes the two generated app files.

`app/page.tsx` replaces the stat tokens with current database counts and flags
`html.obliq-landing` pre-paint (plus `html.obliq-no-motion` under reduced
motion). `app/landing-shell.tsx` boots the reference animation runtime (the
patched `public/landing/wp-content/themes/ario/assets/js/app.js`, which drives
the preloader intro, pinned hero, line reveals, 3D workflow cube, partner
hover swaps, marquee, cursor and fullscreen menu), probes for its footprints to
mark `html.obliq-runtime`, and owns the no-motion fallback: menu, cookie-bar
and video visibility when the bundle cannot run.

`app/layout.tsx` supplies the Barba wrapper attribute expected by the reference runtime. The copied runtime is isolated to the landing route and must not change product routes.

## Asset policy

The replacement portraits come from StockSnap under CC0. The hero clip comes from Coverr under its free commercial-use license. Keep provenance in `public/landing/CREDITS.md` when replacing assets.

The bundled Helvetica files are reference-theme assets with uncertain redistribution rights. The generated CSS currently maps typography to `public/fonts/obliq-regular.woff` and `public/fonts/obliq-bold.woff`. Preserve that mapping unless the project receives a licensed brand font.

The compiled animation bundle ships with the landing page and is required for
its motion. `npm run test:perf` guards the restored boundary (runtime present,
preloader + cursor markup present). Keep the Barba `prevent: () => true` patch
in `scripts/fetch-landing-assets.mjs` so the runtime never hijacks navigation.

## Known state

- Homepage asset paths, fonts, stale Ario contact text, malformed inline background URLs, the missing Barba wrapper, the stuck preloader, and the initially open fullscreen menu have been repaired.
- `LandingShell` owns a CSS fallback menu (`obliq-no-motion obliq-menu-open`) for
  when the runtime never boots; while the runtime is active the theme's own
  GSAP timeline owns the panel and the shell stays out of the way. Reduced
  motion skips the runtime entirely via the pre-paint `obliq-no-motion` flag.
- All animation overrides in `app/landing-overrides.css` are scoped to
  `html.obliq-no-motion` except pre-paint menu parking, the footer-sign scale,
  the Tailwind `.w-5` hero guard, and the Barba wrapper width fix, so the
  runtime's transforms are never fought while active.
- The custom `OPEN +` cursor starts transparent and appears only when the reference hover runtime activates it. It stays disabled below 1100px.
- Desktop and 390px mobile browser screenshots live in `output/playwright/`.
- Mobile hero width has an explicit override because Tailwind's `.w-5` utility collides with the reference theme's semantic `.w-5` class.
- The landing forms post to `app/api/landing/[kind]/route.ts` and use `public/landing/obliq-forms.js`.
- Lint and the production build pass with a 4096 MB Node heap.
- Development, production, and acceptance tests use separate Next output directories (`.next`, `.next-build`, and `.next-test`). Do not collapse them: concurrent Next processes sharing `.next` caused intermittent missing-chunk and missing-page 500 errors.
- `npm run build` and `npm start` use `scripts/run-next.mjs`, which selects `.next-build`. `run-tests.cmd` selects `.next-test` and now stops its temporary port-3000 server on success or failure.
- `npm run test:smoke` checks the landing page, login, health endpoint, stylesheet, and animation runtime against `OBLIQ_BASE_URL` (default `http://localhost:3002`).
- `npm run test:perf` now fails if the landing page stops shipping the animation
  runtime or loses the preloader/cursor markup it drives (boundary restored
  2026-09-19 per the reference-ui motion source of truth).
- The workflow section keeps a project-owned responsive CSS grid only as the
  `obliq-no-motion` fallback. With the runtime active the reference's 3D
  carousel drives the cards.
- Codex in-app browser QA confirmed the settled mobile hero, playable local video, opening fullscreen menu, menu-link close behavior, and navigation to `/login`.
- The deterministic API suite passes all 12 acceptance tests after reseeding; the schema suite passes all 4 tenant-integrity tests. `run-tests.cmd` deliberately resets `data/audit.db`, so do not run it against demo data that must be preserved.

## Verification loop

Run these after landing changes:

```powershell
node scripts/build-landing.mjs
node --max-old-space-size=4096 node_modules/eslint/bin/eslint.js .
cmd /c run-tests.cmd
npm run test:schema
npm run lint
$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run build
npm run test:smoke
```

Then compare `http://localhost:3000/` or the active dev port against the working reference at 1440x900 and 390x844. Check the intro handoff, header, fullscreen menu, hero video, scroll-triggered sections, card hovers, cookie dismissal, contact-form validation, login navigation, horizontal overflow, console errors, and reduced-motion behavior.

## Editing rules

Preserve unrelated dirty-worktree changes. Keep product routes and authorization boundaries intact. Fit OBLIQ copy to the reference geometry before changing layout. Keep external URLs and Ario identity out of generated markup. Use local, licensed media and record its source. Treat the extracted DOM as design evidence, not maintainable application source.

Completion means the generated asset check passes, desktop and mobile journeys work through visible controls, no landing asset fails to load, production build succeeds, and any remaining fidelity or licensing limit is recorded here.
