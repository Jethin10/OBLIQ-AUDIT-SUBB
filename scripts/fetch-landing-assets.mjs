/**
 * Fetches every third-party asset the landing page needs into public/landing/.
 *
 * The landing page at "/" is a faithful port of the reference theme in
 * reference-ui/ (ario.law). Two kinds of assets come with it:
 *
 *   1. Theme chrome - the compiled stylesheet, the Helvetica faces and the
 *      gradient textures it points at. These are copied verbatim into the same
 *      directory shape the stylesheet expects, so its own relative
 *      `url(../fonts/...)` / `url(../images/...)` references keep resolving and
 *      app.css never has to be edited.
 *
 *   2. Photography and footage - the reference's own photos are the firm's
 *      brand imagery, so the landing page uses freely licensed replacements:
 *      StockSnap (CC0) for stills and Coverr (free licence) for the hero clip.
 *      No generated imagery is used anywhere.
 *
 * Assets are committed, so this script only needs re-running to change them.
 * It prefers the local mirror in reference-ui/ when present and falls back to
 * the live site, which keeps it usable from a fresh clone.
 *
 *   node scripts/fetch-landing-assets.mjs
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const THEME_ASSETS = "wp-content/themes/ario/assets";
const PUBLIC_THEME = join(ROOT, "public", "landing", THEME_ASSETS);
const PUBLIC_MEDIA = join(ROOT, "public", "landing", "media");
const MIRROR_CANDIDATES = [
  join(ROOT, "reference-ui", "ario-law", "ario.law", "ario.law"),
  join(ROOT, "reference-ui", "ario-law", "ario.law"),
];
const MIRROR = MIRROR_CANDIDATES.find((candidate) => existsSync(join(candidate, THEME_ASSETS))) ?? MIRROR_CANDIDATES[0];
const ORIGIN = "https://ario.law";

/** Theme chrome copied byte-for-byte. */
const THEME_FILES = [
  "css/app.css",
  "js/app.js",
  "fonts/Helvetica/Helvetica-Regular.woff",
  "fonts/Helvetica/Helvetica-Bold.woff",
  "images/general/preloader-bg.jpg",
  "images/general/more-gradient.jpg",
  "images/general/article-gradient.jpg",
  "images/general/footer-gradient.jpg",
];

/**
 * StockSnap is CC0 - no attribution required, commercial use allowed.
 * Every entry is portrait-oriented so the theme's `object-position: center top`
 * framing keeps faces in frame.
 */
const PHOTOS = [
  ["person-01.jpg", "7U4SPRJEIE"],
  ["person-02.jpg", "1ZUIKQTAF4"],
  ["person-03.jpg", "OLT5TSPKH5"],
  ["person-04.jpg", "20NNP2BSL6"],
  ["person-05.jpg", "XTPQ1UMFH1"],
  ["person-06.jpg", "HXDODYZKFS"],
  ["person-07.jpg", "TTOM5R7SFF"],
  ["person-08.jpg", "ZL2KWPMLLI"],
  ["person-featured.jpg", "ZTNVVRFBWS"],
  ["review-01.jpg", "B4SX9OQECA"],
  ["review-02.jpg", "FPQIEQBMPA"],
  ["review-03.jpg", "UTEZRDTKPP"],
];

/** Coverr, free licence. A dark close-up of documents leaving a printer. */
const VIDEO_SLUG = "coverr-a-printer-at-work-in-the-office-5252";
const VIDEO_URL = `https://cdn.coverr.co/videos/${VIDEO_SLUG}/1080p.mp4`;

async function download(url, destination) {
  const response = await fetch(url, { headers: { "user-agent": "OBLIQ-landing/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error(`empty response for ${url}`);
  writeFileSync(destination, bytes);
  return bytes.length;
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true });
}

function themeSource(relativePath) {
  const mirrored = join(MIRROR, THEME_ASSETS, relativePath);
  return existsSync(mirrored)
    ? { kind: "copy", path: mirrored }
    : { kind: "url", path: `${ORIGIN}/${THEME_ASSETS}/${relativePath}` };
}

async function fetchThemeFiles() {
  for (const relativePath of THEME_FILES) {
    const destination = join(PUBLIC_THEME, relativePath);
    ensureDirectory(dirname(destination));
    const source = themeSource(relativePath);
    if (source.kind === "copy") {
      copyFileSync(source.path, destination);
      console.log(`  copied  ${relativePath}`);
    } else {
      const size = await download(source.path, destination);
      console.log(`  fetched ${relativePath} (${Math.round(size / 1024)} KB)`);
    }
  }
}

/**
 * The reference theme is a Barba.js SPA: every internal link is intercepted and
 * swapped client-side. Here the product pages (/login, /clients) are Next.js
 * routes in a different root layout, so the landing page has to let the browser
 * navigate normally. Barba's `prevent` callback decides which links it hijacks;
 * returning true unconditionally hands every navigation back to the browser.
 *
 * This is the only edit made to the upstream bundle - the preloader, the
 * ScrollTrigger timelines and the ScrollSmoother set-up are untouched.
 */
const BARBA_PREVENT_FROM = 'init({prevent:({el:t})=>t.classList&&t.classList.contains("lng-lnk"),transitions:[{';
const BARBA_PREVENT_TO = "init({prevent:()=>!0,transitions:[{";

function patchThemeScript() {
  const target = join(PUBLIC_THEME, "js", "app.js");
  const source = readFileSync(target, "utf8");
  if (source.includes(BARBA_PREVENT_TO)) {
    console.log("  js/app.js already patched");
    return;
  }
  if (!source.includes(BARBA_PREVENT_FROM)) {
    throw new Error("app.js changed upstream: Barba prevent callback not found");
  }
  writeFileSync(target, source.replace(BARBA_PREVENT_FROM, BARBA_PREVENT_TO), "utf8");
  console.log("  patched js/app.js to leave navigation to the browser");
}

async function fetchPhotos() {
  for (const [filename, id] of PHOTOS) {
    const destination = join(PUBLIC_MEDIA, filename);
    const size = await download(`https://cdn.stocksnap.io/img-thumbs/960w/${id}.jpg`, destination);
    console.log(`  fetched media/${filename} (${Math.round(size / 1024)} KB)`);
  }
}

/**
 * The hero video is cropped to 4:3 because the theme scales it by a hardcoded
 * 1400/572 factor that assumes a 4:3 source, and re-encoded so the browser
 * streams it instead of buffering the whole file first.
 */
async function fetchHeroVideo() {
  const raw = join(PUBLIC_MEDIA, ".hero-source.mp4");
  const target = join(PUBLIC_MEDIA, "hero.mp4");
  const size = await download(VIDEO_URL, raw);
  console.log(`  fetched hero source (${Math.round((size / 1024 / 1024) * 10) / 10} MB)`);

  try {
    execFileSync(
      "ffmpeg",
      [
        "-y", "-loglevel", "error",
        "-i", raw,
        "-an",
        "-vf", "crop=1440:1080:240:0",
        "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-crf", "26", "-preset", "slow",
        "-movflags", "+faststart",
        target,
      ],
      { stdio: "inherit" },
    );
    console.log(`  encoded media/hero.mp4 (${Math.round((readFileSync(target).length / 1024 / 1024) * 10) / 10} MB)`);
  } finally {
    rmSync(raw, { force: true });
  }
}

function writeCredits() {
  writeFileSync(
    join(ROOT, "public", "landing", "CREDITS.md"),
    [
      "# Landing page assets",
      "",
      "## Theme chrome (`wp-content/themes/ario/assets/`)",
      "",
      "Compiled stylesheet, Helvetica webfonts and gradient textures carried over",
      "verbatim from the reference theme so the port keeps its exact layout and",
      "typography. The Helvetica faces are a licensed Monotype design - swap them",
      "for the OBLIQ brand font before this goes anywhere near production.",
      "",
      "## Photography (`media/person-*.jpg`, `media/review-*.jpg`)",
      "",
      "StockSnap, released under CC0 - free for commercial use, no attribution",
      "required. Replace with real firm photography when it exists.",
      "",
      "## Footage (`media/hero.mp4`)",
      "",
      `Coverr, free licence: <https://coverr.co/videos/${VIDEO_SLUG}>`,
      "Cropped to 4:3 and re-encoded locally.",
      "",
    ].join("\n"),
    "utf8",
  );
  console.log("  wrote CREDITS.md");
}

console.log("Landing assets");
ensureDirectory(PUBLIC_THEME);
ensureDirectory(PUBLIC_MEDIA);

console.log("theme chrome");
await fetchThemeFiles();
patchThemeScript();

console.log("photography");
await fetchPhotos();

console.log("footage");
await fetchHeroVideo();

console.log("credits");
writeCredits();

console.log("done");
