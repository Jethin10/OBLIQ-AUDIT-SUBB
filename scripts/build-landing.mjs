/**
 * Generates the OBLIQ landing page from the reference theme.
 *
 * The landing page at "/" is not a lookalike - it is the reference theme's own
 * markup and stylesheet, with the firm's copy swapped for OBLIQ's and the
 * firm's photography swapped for freely licensed stock. That keeps every
 * transition the reference ships (preloader, line reveals, pinned hero, 3D
 * practice cube, partner hover swaps, recognition marquee, cursor) working,
 * because the theme's own GSAP bundle is what drives them.
 *
 *   reference-ui/ario-raw.html                       (source markup, pre-JS)
 *   public/landing/.../assets/css/app.css            (source stylesheet)
 *        |
 *        +-> app/landing-content.ts   markup, OBLIQ copy, local asset paths
 *        +-> app/landing.css          stylesheet, scoped to html.obliq-landing
 *
 * Scoping works by prefixing every selector with `html.obliq-landing`. The
 * root layout's inline bootstrap adds that class to <html> on "/" before the
 * first paint, so the theme's `body`-level typography and its scroll setup
 * still land on the real document - exactly as they do on the reference -
 * without leaking into /login or /clients.
 *
 *   node scripts/build-landing.mjs
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import * as csstree from "css-tree";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REFERENCE_HTML = join(ROOT, "reference-ui", "ario-raw.html");
const THEME_DIR = join(ROOT, "public", "landing", "wp-content", "themes", "ario", "assets");
const THEME_URL = "/landing/wp-content/themes/ario/assets";
const CONTENT_OUT = join(ROOT, "app", "landing-content.ts");
const CSS_OUT = join(ROOT, "app", "landing.css");
const SCOPE = "html.obliq-landing";

/**
 * Photography and footage for the port. Everything is a freely licensed
 * replacement (StockSnap CC0 stills, Coverr footage); none of it is generated.
 */
const MEDIA = {
  "https://ario.law/wp-content/uploads/2024/05/img_4639-1.mp4": "/landing/media/hero.mp4",

  // Audit-trail grid: the demo engagement's recorded events, on paperwork.
  "https://ario.law/wp-content/uploads/2019/11/ario0147-1-scaled.jpg": "/landing/media/person-01.jpg",
  "https://ario.law/wp-content/uploads/2019/11/untitled-capture42444444444-2-1-scaled.jpg": "/landing/media/person-02.jpg",
  "https://ario.law/wp-content/uploads/2019/11/55336208653_a650b3d235_6k-1-scaled.jpg": "/landing/media/person-03.jpg",
  "https://ario.law/wp-content/uploads/2019/11/55336221593_6ab43856bb_6k-1-scaled.jpg": "/landing/media/person-04.jpg",
  "https://ario.law/wp-content/uploads/2019/11/dyzajn-bez-nazvanyia-85-1-scaled.png": "/landing/media/person-05.jpg",
  "https://ario.law/wp-content/uploads/2019/11/55336486875_0e6d1cb68c_6k-1-scaled.jpg": "/landing/media/person-06.jpg",
  "https://ario.law/wp-content/uploads/2024/03/untitled-capture1277-2-scaled.jpg": "/landing/media/person-07.jpg",
  "https://ario.law/wp-content/uploads/2024/03/untitled-capture0998-2-scaled.jpg": "/landing/media/person-08.jpg",
  "https://ario.law/wp-content/uploads/2019/11/ario0510-1-1-scaled.jpg": "/landing/media/review-01.jpg",
  "https://ario.law/wp-content/uploads/2019/11/ario0844-1-2-scaled.jpg": "/landing/media/review-02.jpg",
  "https://ario.law/wp-content/uploads/2019/11/ario1542-1-scaled.jpg": "/landing/media/review-03.jpg",
  "https://ario.law/wp-content/uploads/2019/11/ario1428-2-scaled.jpg": "/landing/media/person-01.jpg",
  "https://ario.law/wp-content/uploads/2024/03/untitled-capture0738-2-scaled.jpg": "/landing/media/person-02.jpg",
  "https://ario.law/wp-content/uploads/2024/03/untitled-capture0354-3-2-scaled.jpg": "/landing/media/person-03.jpg",
  "https://ario.law/wp-content/uploads/2019/11/55336278104_2ac604ef3b_6k-1-scaled.jpg": "/landing/media/person-04.jpg",
  "https://ario.law/wp-content/uploads/2019/11/55336224593_d992518c54_6k-1-scaled.jpg": "/landing/media/person-05.jpg",
  "https://ario.law/wp-content/uploads/2019/11/ario0926-3-scaled.jpg": "/landing/media/person-06.jpg",
  "https://ario.law/wp-content/uploads/2019/11/ario0725-1-2-1-scaled.jpg": "/landing/media/person-07.jpg",

  // Workflow cube: five faces of documents at work.
  "https://ario.law/wp-content/uploads/2019/11/blue-gradient-creative-business-facebook-cover-23.png": "/landing/media/person-01.jpg",
  "https://ario.law/wp-content/uploads/2019/11/blue-gradient-creative-business-facebook-cover-5-1.png": "/landing/media/person-04.jpg",
  "https://ario.law/wp-content/uploads/2019/11/blue-gradient-creative-business-facebook-cover-7-1.png": "/landing/media/person-06.jpg",
  "https://ario.law/wp-content/uploads/2020/08/dyzajn-bez-nazvanyia-16.png": "/landing/media/review-02.jpg",
  "https://ario.law/wp-content/uploads/2024/04/article-gradient-1.jpg": "/landing/media/person-08.jpg",

  // Team: two people working a review, plus a portrait.
  "https://ario.law/wp-content/uploads/2024/03/dyzajn-bez-nazvanyia-23-1.png": "/landing/media/person-featured.jpg",
  "https://ario.law/wp-content/uploads/2024/03/na-sajt-1.png": "/landing/media/person-05.jpg",
  "https://ario.law/wp-content/uploads/2024/03/dyzajn-bez-nazvanyia-20-1.png": "/landing/media/review-03.jpg",
};

/**
 * Where each link in the reference goes now. Anything not listed falls through
 * to the sign-in page, which is the only door into the product.
 */
const LINKS = {
  "https://ario.law/en/": "#hm-in",
  "https://ario.law/": "/login",
  "/en/about-us/": "#hm-abt",
  "/en/practice/": "#hm-prcts",
  "/en/team/": "#hm-tm",
  "/en/press_center/": "#hm-rcgnt",
  "#contacts": "#contacts",
  "https://ario.law/en/team/#prts": "#prts",
  "https://ario.law/en/privacy-policy-ario-law-firm/": "/login",
  "https://www.facebook.com/ario.lawfirm/": "/login",
  "https://t.me/ariolawfirm": "/clients",
  "https://www.linkedin.com/company/17981799/admin/": "/api/health",
  "https://instagram.com/ario_law_firm?igshid=55ud834zcw22": "#contacts",
  "https://www.youtube.com/channel/UCDhTKQpxRNKipmU8zU2cdGA": "#prts",
  "tel:+380442475577": "tel:+919845213670",
  "mailto:office@ario.law": "mailto:connect@obliq.in",
};

/** Everything else on the reference site (practice pages, articles, profiles). */
const LINK_PREFIXES = [
  ["https://ario.law/en/practice/", "#hm-prcts"],
  ["https://ario.law/en/faces_practice/", "#prts"],
  ["https://ario.law/en/press_center/", "#hm-nws"],
];

function hrefFor(href) {
  if (!href) return href;
  if (LINKS[href]) return LINKS[href];
  for (const [prefix, target] of LINK_PREFIXES) {
    if (href.startsWith(prefix)) return target;
  }
  if (href.startsWith("#")) return href;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return href;
  return "/login";
}

function localAsset(url) {
  if (!url) return url;
  if (MEDIA[url]) return MEDIA[url];
  if (url.startsWith("https://ario.law/wp-content/themes/ario/assets/")) {
    return url.replace("https://ario.law/wp-content/themes/ario/assets", THEME_URL);
  }
  if (url.startsWith("https://ario.law/wp-content/uploads/")) {
    return url.replace("https://ario.law/wp-content/uploads/", "/landing/media/");
  }
  return url;
}

/**
 * The copy. Every string the reference renders is listed here with the OBLIQ
 * text that replaces it, in document order, so the markup can stay untouched.
 *
 *   text:    replaces an element's own text (first text node wins, the rest go)
 *   replace: rewrites matching strings inside the element and its descendants
 *
 * Counts injected by the page (`{{STAT_*}}`) come from the product database.
 */
const TEXT_RULES = [
  // Wordmark that sits behind the page.
  { sel: "#hm-lg .pr-logo", text: ["OBLIQ"] },
  { sel: "#prldr .pr-logo", text: ["OBLIQ"] },

  // Header.
  { sel: "header nav a", text: ["Product", "Workflow", "Team", "Trust", "Contact"] },
  { sel: "header .lngs .lng-lnk", text: ["Log in"] },

  // Fullscreen menu.
  { sel: "#mn .itm a", text: ["Product", "Workflow", "Team", "Trust", "Contact"] },
  { sel: "#mn .lngs .lng-lnk", text: ["Log in"] },

  // Hero.
  {
    sel: "#hm-in .cntnt h1",
    text: [
      "Five documents per client. Every upload versioned. Every correction explained. Every decision written down.",
    ],
  },

  // The product.
  { sel: "#hm-abt h2", text: ["The product"] },
  { sel: "#hm-abt .lt .txt", text: ["Evidence in. Every decision recorded."] },
  { sel: "#hm-abt .stats-crd .cnt", text: ["{{STAT_DOCUMENTS}}", "{{STAT_EVENTS}}"] },
  {
    sel: "#hm-abt .stats-crd .cpt-dwn",
    text: ["documents under review", "audit events written down"],
  },

  // Workflow.
  { sel: "#hm-prcts h2", text: ["Workflow"] },
  { sel: "#hm-prcts .lt .txt", text: ["Four moves from upload to approval"] },
  {
    sel: "#hm-prcts .lt .hnt",
    text: [
      "Staff upload the evidence, reviewers approve or ask for a fix, and every correction carries a written reason.",
    ],
  },
  {
    sel: "#hm-prcts .prct-crd .lbl",
    text: ["Client onboarding", "Evidence upload", "Review with reasons", "Locked approval"],
  },
  {
    sel: "#hm-prcts .prct-crd .lns .rw .-l",
    text: ["Trigger", "Result", "Trigger", "Result", "Trigger", "Result", "Trigger", "Result"],
  },
  {
    sel: "#hm-prcts .prct-crd .lns .rw .-r",
    text: [
      "A reviewer adds the client",
      "Five documents on the checklist",
      "Staff submit a real file",
      "A new immutable version",
      "The reviewer opens the document",
      "Approve, or ask for a fix",
      "The corrected file comes back",
      "Version 2 kept beside version 1",
    ],
  },

  // Team.
  { sel: "#hm-tm .lt .txt", text: ["First and foremost, OBLIQ is a"] },
  {
    sel: "#hm-ppl .ttl-wr p",
    text: [
      "Teams that",
      "keep every version",
      "ask for the fix",
      "write the reason",
      "approve on the record",
      "never lose a decision",
    ],
  },

// Audit trail - the featured card opens on the first recorded event.
  { sel: ".prtn-crd .ftr h3", text: ["Client created"] },
  { sel: ".prtn-crd .ftr .lns .-l", text: ["Aman Verma, Reviewer"] },
  { sel: ".prtn-crd .ftr .lns .-r", text: ["Five-document checklist created"] },
  { sel: ".prts .cell-btns a", text: ["Every event"] },
  { sel: ".prts .cell-btns button", text: ["Decisions"] },

  // Controls.
  { sel: "#hm-rcgnt h2", text: ["Controls"] },
  {
    sel: "#hm-rcgnt .awrd a",
    text: [
      "A firm only ever sees its own clients",
      "Documents belong to the firm that created them",
      "Staff see the engagements assigned to them",
      "Every download is checked against the session firm",
      "A cross-firm request is refused and recorded",
      "Files are stored with their real bytes and MIME type",
      "An upload never overwrites the version before it",
      "Every version keeps its own uploader and timestamp",
      "The checklist state is visible at a glance",
      "Approving is a deliberate act, never a default",
      "A correction request cannot go out without a reason",
      "Approved documents are locked from further edits",
      "The reason travels with the version it belongs to",
      "The audit log accepts inserts and nothing else",
      "Database triggers reject updates and deletes",
      "Actor, role and timestamp are stored on every event",
      "Sessions are httpOnly and bound to a single firm",
    ],
  },
  {
    sel: "#hm-rcgnt .awrd .year",
    text: [
      "Scope", "Scope", "Access", "Access", "Access",
      "Files", "Files", "Files",
      "Review", "Review", "Review",
      "Approve", "Approve",
      "Trail", "Trail", "Trail", "Trail",
    ],
  },

  // Product notes.
  { sel: "#hm-nws h2", text: ["Product notes"] },
  {
    sel: "#hm-nws .art-crd .a-ttl",
    text: [
      "Audit trail export now carries the reviewer's written reason",
      "Uploading a corrected file keeps the version it replaces",
      "Correction requests cannot go out without a reason",
      "Firm isolation now records every refused cross-firm request",
    ],
  },
  { sel: "#hm-nws .art-crd .lns .-l", text: ["Trail", "Uploads", "Review", "Files"] },
  {
    sel: "#hm-nws .art-crd .lns .-r",
    text: [
      "Release note", "12 March 2026",
      "Product note", "28 February 2026",
      "Product note", "9 January 2026",
      "Release note", "14 November 2025",
    ],
  },

  // Footer.
  { sel: "footer .frm h3", text: ["Want a walkthrough?"] },
  { sel: "footer .again-btn", replace: [["Ask another question", "Send another"]] },
  { sel: "footer .wgt.-navs .wgt-ttl", replace: [["Navigation", "Navigate"]] },
  { sel: "footer .wgt.-navs .nav a", text: ["Product", "Workflow", "Team", "Trust"] },
  { sel: "footer .wgt.-scls .wgt-ttl", replace: [["Social", "Demo accounts"]] },
  {
    sel: "footer .wgt.-scls .nav a",
    text: ["Staff, Rohit", "Reviewer, Aman", "Staff, Priya", "Reviewer, Neha", "Open the workspace"],
  },
  { sel: "footer .wgt.-lngs .wgt-ttl", replace: [["Languages", "Access"]] },
  { sel: "footer .wgt.-lngs .nav .lng-lnk", text: ["Log in"] },
  { sel: "footer .wgt.-cntcs .wgt-ttl", replace: [["Contacts", "Contact"]] },
  {
    sel: "footer .wgt.-cntcs .add p",
    text: ["Koramangala, Bengaluru 560095, India", "", "Bandra West, Mumbai 400050, India", ""],
  },
  { sel: "footer .wgt.-cntcs .eml", text: ["+91 98452 13670", "connect@obliq.in"] },
  { sel: "footer .wgt.-a .wgt-ttl", replace: [["Newsletter Subscription", "Product updates"]] },
  {
    sel: "footer .wgt.-a .dscr",
    replace: [
      ["Be aware of latest news", "Occasional notes on the review workflow"],
      ["and goverement changes", "and the audit trail"],
    ],
  },
  { sel: "footer .sign", text: ["OBLIQ"] },
  { sel: "footer .sign .hi-t", text: [" Audit"] },

  // Cookie banner.
  {
    sel: "#acpt-policy p",
    replace: [
      ["This website use ", "This site keeps one "],
      ["cookies", "session cookie"],
      [", for better user experience", ", and nothing else."],
    ],
  },
  { sel: "#acpt-policy button", text: ["OK"] },
];

/**
 * The audit-trail grid. Nine events, in the order the product recorded them,
 * taken from the seeded demo engagement (Sharma Textiles, ABC & Co.):
 * checklist, first upload, review, a correction with its written reason, the
 * corrected version, and the approval. Hovering a card swaps the featured
 * panel on the left, which is the reference's own behaviour.
 */
const TRAIL = [
  {
    title: "Client created",
    actor: "Aman Verma, Reviewer",
    detail: "Five-document checklist created",
    thumb: "/landing/media/person-01.jpg",
    featured: "/landing/media/review-01.jpg",
  },
  {
    title: "Checklist issued",
    actor: "System",
    detail: "Bank statement, Sales register, Purchase register, GST return, Expenses",
    thumb: "/landing/media/person-02.jpg",
    featured: "/landing/media/review-02.jpg",
  },
  {
    title: "Bank statement uploaded",
    actor: "Rohit Sharma, Staff",
    detail: "HDFC_Statement_Mar2026.pdf, version 1",
    thumb: "/landing/media/person-03.jpg",
    featured: "/landing/media/review-03.jpg",
  },
  {
    title: "Review started",
    actor: "Aman Verma, Reviewer",
    detail: "Bank statement, version 1",
    thumb: "/landing/media/person-04.jpg",
    featured: "/landing/media/person-07.jpg",
  },
  {
    title: "Correction requested",
    actor: "Aman Verma, Reviewer",
    detail: "Page 3 is missing. Please upload the complete bank statement.",
    thumb: "/landing/media/person-05.jpg",
    featured: "/landing/media/person-08.jpg",
  },
  {
    title: "Corrected file uploaded",
    actor: "Rohit Sharma, Staff",
    detail: "HDFC_Statement_Mar2026.pdf, version 2",
    thumb: "/landing/media/person-06.jpg",
    featured: "/landing/media/review-01.jpg",
  },
  {
    title: "Bank statement approved",
    actor: "Aman Verma, Reviewer",
    detail: "All three pages present. Closing balance verified.",
    thumb: "/landing/media/person-07.jpg",
    featured: "/landing/media/review-02.jpg",
  },
  {
    title: "Sales register approved",
    actor: "Aman Verma, Reviewer",
    detail: "Invoices ST-1181 to ST-1184 agree with the ledger.",
    thumb: "/landing/media/person-08.jpg",
    featured: "/landing/media/review-03.jpg",
  },
  {
    title: "GST return sent back",
    actor: "Aman Verma, Reviewer",
    detail: "Taxable value is short of the sales register. Please reconcile.",
    thumb: "/landing/media/review-01.jpg",
    featured: "/landing/media/person-01.jpg",
  },
];

/** Footer "Demo accounts" column: one click signs you into a seeded account. */
const DEMO_ACCOUNTS = [
  ["/login?email=rohit@abc.test", "Staff, Rohit"],
  ["/login?email=aman@abc.test", "Reviewer, Aman"],
  ["/login?email=priya@xyz.test", "Staff, Priya"],
  ["/login?email=neha@xyz.test", "Reviewer, Neha"],
  ["/clients", "Open the workspace"],
];

/**
 * The reference header mark is drawn as paths. OBLIQ ships as text inside the
 * same viewBox, so `currentColor` and the theme's own `header .logo svg` sizing
 * keep working and nothing else about the header changes.
 */
const LOGO_SVG = [
  '<svg viewBox="0 0 875 385" fill="none" xmlns="http://www.w3.org/2000/svg">',
  '<text x="0" y="181" fill="currentColor" font-family="ario-sans, Helvetica, Arial, sans-serif" font-size="212" font-weight="700" letter-spacing="-9" textLength="874" lengthAdjust="spacingAndGlyphs">OBLIQ</text>',
  '<path d="M2 238.053H871.935" stroke="currentColor" fill="none" stroke-width="3.29105" stroke-linecap="square"></path>',
  '<text x="0" y="384" fill="currentColor" font-family="ario-sans, Helvetica, Arial, sans-serif" font-size="84" font-weight="400" letter-spacing="-2" textLength="330" lengthAdjust="spacingAndGlyphs">AUDIT</text>',
  '<text x="544" y="384" fill="currentColor" font-family="ario-sans, Helvetica, Arial, sans-serif" font-size="84" font-weight="400" letter-spacing="-2" textLength="330" lengthAdjust="spacingAndGlyphs">REVIEW</text>',
  "</svg>",
].join("");

/** Every text node under `el`, in document order. */
function textNodesOf(el, out = []) {
  for (const node of el.childNodes) {
    if (node.nodeType === 3) out.push(node);
    else if (node.nodeType === 1) textNodesOf(node, out);
  }
  return out;
}

/** Replaces an element's own text: first node takes the value, siblings go. */
function setText(el, value, selector = "") {
  const nodes = el.childNodes.filter((node) => node.nodeType === 3);
  if (!nodes.length) {
    // The reference leaves a couple of these elements empty; give them a node.
    if (typeof el.insertAdjacentHTML !== "function") {
      throw new Error(`no text node to replace in <${el.tagName}> for ${selector}`);
    }
    el.insertAdjacentHTML("afterbegin", value);
    return;
  }
  nodes[0].rawText = value;
  for (const extra of nodes.slice(1)) extra.rawText = "";
}

function applyTextRules(body) {
  for (const rule of TEXT_RULES) {
    const targets = body.querySelectorAll(rule.sel);
    if (!targets.length) throw new Error(`copy rule matched nothing: ${rule.sel}`);
    targets.forEach((el, index) => {
      if (rule.text) {
        const value = rule.text[index];
        if (value === undefined) return;
        if (value === "") {
          el.childNodes
            .filter((node) => node.nodeType === 3)
            .forEach((node) => {
              node.rawText = "";
            });
          return;
        }
        setText(el, value, rule.sel);
        return;
      }
      for (const [from, to] of rule.replace) {
        textNodesOf(el).forEach((node) => {
          if (node.rawText.includes(from)) node.rawText = node.rawText.split(from).join(to);
        });
      }
    });
  }
}

/** Rewrites src / data-thmb-hvr / poster and inline background-image URLs. */
function localiseAssets(body) {
  for (const el of body.querySelectorAll("*")) {
    for (const attribute of ["src", "data-thmb-hvr", "poster"]) {
      const value = el.getAttribute(attribute);
      if (value) el.setAttribute(attribute, localAsset(value));
    }
    const style = el.getAttribute("style");
    if (style && style.includes("url(")) {
      el.setAttribute(
        "style",
        style.replace(/url\(([^)]+)(?:\)|$)/g, (_, url) => `url(${localAsset(url.trim())})`),
      );
    }
    if (el.tagName === "IMG" && el.getAttribute("alt") === undefined) el.setAttribute("alt", "");
  }
}

function buildMarkup() {
  const root = parse(readFileSync(REFERENCE_HTML, "utf8"), {
    comment: false,
    blockTextElements: { script: true, style: true },
  });
  const body = root.querySelector("body");
  const drop = (selector) => body.querySelectorAll(selector).forEach((node) => node.remove());

  // WordPress plumbing: tag manager, plugin scripts, form handshakes.
  drop("noscript");
  drop("script");
  drop(".screen-reader-response");
  drop(".honeypot-field-wrap");
  // Keep the theme's own preloader, page-wipe and custom cursor. The
  // animation bundle drives them, so dropping them breaks the intro.
  // Only WordPress plumbing goes.
  body.querySelectorAll("form div[style]").forEach((div) => {
    if (div.getAttribute("style").includes("display: none")) div.remove();
  });

  // The two forms post to OBLIQ's own endpoint; obliq-forms.js drives them.
  const forms = body.querySelectorAll("form.wpcf7-form");
  if (forms.length !== 2) throw new Error(`expected 2 forms, found ${forms.length}`);
  forms.forEach((form, index) => {
    const kind = index === 0 ? "contact" : "subscribe";
    form.setAttribute("data-obliq-form", kind);
    form.setAttribute("action", `/api/landing/${kind}`);
    form.setAttribute("method", "post");
    form.removeAttribute("novalidate");
    form.removeAttribute("data-status");
    form.removeAttribute("id");
  });
  body.querySelectorAll(".wpcf7").forEach((wrapper) => {
    wrapper.removeAttribute("id");
    wrapper.setAttribute("class", wrapper.getAttribute("class").replace(/\bno-js\b/, "").trim());
  });

  // The theme's JS looks for this namespace to decide whether the home
  // preloader runs, and barba tags the container `ac` once it has loaded.
  body.querySelector("main").setAttribute("class", "ac");
  // The menu hides pre-paint this during its document bootstrap. React's
  // via landing-overrides.css; the theme timeline owns it after boot.
  // (menu inline-style hack removed: it froze the GSAP timeline)

  // The mark in the header and in the footer sign.
  body.querySelector("header .logo svg").replaceWith(parse(LOGO_SVG).firstChild);

  // Audit-trail grid: the featured panel plus nine recorded events.
  const items = body.querySelectorAll(".prts .prtn");
  if (items.length !== TRAIL.length) {
    throw new Error(`audit-trail grid has ${items.length} cards, expected ${TRAIL.length}`);
  }
  items.forEach((item, index) => {
    const event = TRAIL[index];
    item.setAttribute("href", "/login");
    item.setAttribute("data-pstn", event.actor);
    item.setAttribute("data-prc", event.detail);
    item.setAttribute("data-thmb-hvr", event.featured);
    item.querySelector("img.thmb").setAttribute("src", event.thumb);
    setText(item.querySelector("span"), event.title);
  });
  body.querySelector(".prtn-crd .thmb img").setAttribute("src", TRAIL[0].featured);

  // Doors into the product, before the reference's own links are translated.
  body.querySelectorAll(".prts .cell-btns a").forEach((a) => a.setAttribute("href", "#prts"));
  body.querySelectorAll("#hm-rcgnt .awrd a").forEach((a) => a.setAttribute("href", "#prts"));
  body.querySelectorAll("#hm-nws .art-crd").forEach((a) => a.setAttribute("href", "/login"));
  body.querySelectorAll("a.mr-crd").forEach((a) => {
    // The first "More" card points at the next section, the rest open the product.
    a.setAttribute("href", a.getAttribute("href") === "" ? "#hm-prcts" : "/login");
  });
  DEMO_ACCOUNTS.forEach(([href], index) => {
    body
      .querySelector(`footer .wgt.-scls .nav a:nth-child(${index + 1})`)
      .setAttribute("href", href);
  });

  // Everything else: the reference's own URLs, resolved to this app.
  body.querySelectorAll("a").forEach((a) => {
    const href = hrefFor(a.getAttribute("href") ?? "");
    a.setAttribute("href", href);
    if (href.startsWith("/") || href.startsWith("#")) {
      a.removeAttribute("target");
      a.removeAttribute("rel");
    }
  });

  localiseAssets(body);
  applyTextRules(body);

  return body.childNodes
    .map((node) => node.toString())
    .join("")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * The theme stylesheet is a single minified line whose selectors assume they
 * own the document (`body{...}`, `body>section{...}`). Prefixing every selector
 * with `html.obliq-landing` keeps that assumption on "/" and off every other
 * route, and uniform prefixes preserve the original cascade order.
 */
function scopeSelector(selector, scope) {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;
  if (/^html(?![\w-])/.test(trimmed)) return trimmed.replace(/^html/, scope);
  return `${scope} ${trimmed}`;
}

function scopeRule(rule, scope) {
  const scoped = rule.prelude.children
    .toArray()
    .map((selector) => scopeSelector(csstree.generate(selector), scope))
    .join(",");
  rule.prelude = csstree.parse(scoped, { context: "selectorList" });
}

function scopeStylesheet(css, scope) {
  const ast = csstree.parse(css);
  const walk = (container) => {
    const list = container.children;
    if (!list || typeof list.toArray !== "function") return;
    for (const node of list.toArray()) {
      if (node.type === "Atrule") {
        // Keyframe selectors (0%, to) are not element selectors: leave them.
        if (node.block && !node.name.toLowerCase().includes("keyframes")) walk(node.block);
      } else if (node.type === "Rule") {
        scopeRule(node, scope);
        if (node.block) walk(node.block);
      }
    }
  };
  walk(ast);
  return csstree.generate(ast);
}

const MARKUP_HEADER = `/**
 * GENERATED by scripts/build-landing.mjs - do not edit by hand.
 *
 * The reference theme's own markup for "/", with OBLIQ's copy, local asset
 * paths and links into this app. Tokens in curly braces are filled from the
 * product database as the page renders.
 */
`;

const CSS_HEADER = `/**
 * GENERATED by scripts/build-landing.mjs - do not edit by hand.
 *
 * The reference theme's compiled stylesheet (normalize.css v8.0.1, MIT, plus
 * the theme's own rules and utility classes), scoped to \`html.obliq-landing\`
 * so it only bites on the landing page.
 */
`;

console.log("Landing port");

const markup = buildMarkup();
if (!markup.includes("{{STAT_DOCUMENTS}}")) throw new Error("stat tokens missing from markup");
writeFileSync(CONTENT_OUT, `${MARKUP_HEADER}export const landingHtml =\n  ${JSON.stringify(markup)};\n`, "utf8");
console.log(`  app/landing-content.ts  ${Math.round(markup.length / 1024)} KB`);

const themeCss = readFileSync(join(THEME_DIR, "css", "app.css"), "utf8");
const scoped = scopeStylesheet(themeCss, SCOPE)
  .replaceAll("../fonts/Helvetica/Helvetica-Bold.woff", "/fonts/obliq-bold.woff")
  .replaceAll("../fonts/Helvetica/Helvetica-Regular.woff", "/fonts/obliq-regular.woff")
  .replaceAll("../fonts/Helvetica/Helvetica-Light.woff", "/fonts/obliq-regular.woff")
  .replaceAll(
    "../images/general/footer-gradient.jpg",
    "/landing/wp-content/themes/ario/assets/images/general/footer-gradient.jpg",
  );
writeFileSync(CSS_OUT, `${CSS_HEADER}${scoped}\n`, "utf8");
console.log(`  app/landing.css         ${Math.round(scoped.length / 1024)} KB`);

const unscoped = [];
const checkAst = csstree.parse(scoped);
const walkCheck = (container, inKeyframes) => {
  if (!container) return;
  const list = container.children;
  if (!list || typeof list.toArray !== "function") return;
  for (const node of list.toArray()) {
    if (node.type === "Atrule") {
      walkCheck(node.block, inKeyframes || node.name.toLowerCase().includes("keyframes"));
    } else if (node.type === "Rule" && !inKeyframes) {
      const selector = csstree.generate(node.prelude).trim();
      if (!selector.startsWith(SCOPE)) unscoped.push(selector);
    }
  }
};
walkCheck(checkAst, false);
if (unscoped.length) {
  throw new Error(`selectors escaped scoping: ${unscoped.slice(0, 5).join(" | ")}`);
}
console.log("  every selector scoped");

const missing = [...new Set([...markup.matchAll(/\/landing\/media\/[\w.-]+/g)].map((m) => m[0]))]
  .filter((asset) => !existsSync(join(ROOT, "public", asset.replace("/landing/", "landing/"))));
if (missing.length) throw new Error(`media referenced but not on disk: ${missing.join(", ")}`);
console.log("  every referenced asset is on disk");

console.log("done");
