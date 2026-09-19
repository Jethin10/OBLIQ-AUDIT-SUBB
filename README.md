# OBLIQ Audit — Mini Document Review System

A focused audit-workflow prototype for small CA firms: staff upload client
documents, reviewers approve or request corrections, and **every action is
recorded in an append-only audit trail**.

## Quick start

**Requirements:** Node.js **≥ 23.4** (the built-in `node:sqlite` driver is
unflagged from 23.4; on Node 22.5–22.x start the server with
`NODE_OPTIONS=--experimental-sqlite`). No other services, no env files —
`DATA_DIR` optionally overrides the default `./data` directory.

```bash
npm install
npm run seed     # idempotent — safe to re-run. Creates data/audit.db with
                 # 2 firms, 5 users, 5 clients at different workflow stages,
                 # real PDF/CSV files and a 2–3 week audit history.
npm run dev      # http://localhost:3000
```

**Demo accounts** (password: `DemoAudit!2026`):

| Email | Role | Firm |
|---|---|---|
| `rohit@abc.test` | STAFF | ABC & Co. |
| `vikram@abc.test` | STAFF | ABC & Co. |
| `aman@abc.test` | REVIEWER | ABC & Co. |
| `priya@xyz.test` | STAFF | XYZ & Co. |
| `neha@xyz.test` | REVIEWER | XYZ & Co. |

### Suggested 3-minute tour (the database is pre-loaded)

The seed is a lived-in firm, not an empty checklist — every document below
already has downloadable files and a full history:

1. Log in as **Aman (reviewer)** → open **Sharma Textiles Pvt. Ltd.** →
   expand **History** on the Bank Statement. You will see the complete
   correction loop: upload 10:20 → review started 10:31 → *"Page 3 is
   missing. Please upload the complete bank statement."* → re-upload with
   all three pages → approved. Both versions download with distinct bytes.
2. Same client: the **GST Return** sits in Correction Required with a
   reconciliation comment, and the **Purchase Register** is mid-review.
3. Log in as **Neha (reviewer, XYZ & Co.)** → open **XYZ Retail**: an
   approved statement after a short-month correction, a vendor-invoice
   correction on the Purchase Register, and a GST Return under review.
4. Log in as **Rohit (staff)** → open **ABC Traders**: a pristine
   all-pending checklist — the starting point for performing the workflow
   yourself (upload → review as Aman → correct → re-upload → approve).

## The workflow

```
PENDING ──upload──▶ UPLOADED ──start review──▶ UNDER_REVIEW ──┬─approve──▶ APPROVED
                                                              └─request correction──▶ CORRECTION_REQUIRED ──re-upload──▶ UPLOADED
```

The state machine (`lib/state.ts`) is an explicit allow-list: any transition not
in the table is rejected by the **server** with `409 Conflict`. The UI hiding a
button is not part of the security model.

## Deploy (Railway / Render / Fly / Docker)

This app is intentionally self-contained: Next.js + embedded SQLite + local file
storage, so it deploys as a single container. It does **not** run on Vercel —
Vercel is serverless with a read-only filesystem and no `node:sqlite`.

**Docker (works everywhere):**

```bash
docker build -t obliq-audit .
docker run -p 3000:3000 -v obliq_data:/app/data obliq-audit
```

The container builds the app, then `scripts/start-production.mjs` seeds the demo
data on first boot only (never wipes existing data) and starts the server. Mount
a volume at `/app/data` so the database and uploaded files persist across restarts.

**One-click configs included:**
- `railway.toml` — Railway (attach a Volume at `/app/data`)
- `render.yaml` — Render (provisions a 1 GB disk at `/app/data`)
- `fly.toml` — Fly.io (run `fly volumes create obliq_data --size 1` first)

Health check for every platform: `GET /api/health`.

## Architecture

```
┌────────────────────────────────┐
│ Next.js App Router (RSC + client islands)      │
│ /login · /clients · /clients/[id]              │
│ Server Components read via the same services   │
└──────────────┬─────────────────┘
               │ fetch (HttpOnly session cookie, same-origin)
┌──────────────▼─────────────────┐
│ API routes: auth → role → tenancy → state machine
│ every mutation: BEGIN IMMEDIATE → change + audit → COMMIT
└──────────────┬─────────────────┘
┌──────────────▼─────────────────┐
│ lib/ services over SQLite: firms · users · clients ·
│ documents · document_versions · audit_events · sessions
└────────────────────────────────┘
```

**Stack:** Next.js 15 · TypeScript · Tailwind · Node's built-in `node:sqlite`
(zero native dependencies). Uploaded files are stored as immutable version rows
inside the database.

## How Firm A stays isolated from Firm B

Three independent layers, each covered by tests:

1. **Every query filters on the session's firm.** No API route accepts a client or
   document id without re-scoping it to the caller's firm (`lib/clients.ts`,
   `lib/documents.ts`). Firm B users get **404** (existence not disclosed) on all
   Firm A reads, downloads and mutations — asserted in `tests/api.test.mjs`.
2. **Staff assignment is enforced on reads, not just writes.** `getClientForUser`
   filters by `assigned_staff_id`, and `getDocumentForUser` / `loadOwnedDocument`
   return **404** when a staffer probes another client's document — so a direct
   URL reveals nothing. Covered by the "unassigned same-firm staff" test with
   two staffers in one firm (Rohit ↔ Vikram).
3. **Composite foreign keys** bind every child row to its parent *within the same
   firm* (`FOREIGN KEY (firm_id, client_id) REFERENCES clients(firm_id, id)` and
   equivalents). Even a hypothetical missing WHERE clause could not create a
   cross-firm link. `PRAGMA foreign_keys = ON` is set on every connection;
   `tests/schema.test.mjs` proves insert/update rejections.
3. **Role ≠ tenancy.** A firm-B *staff* gets the same 403 on Firm A documents as on
   their own (role check fires first, leaking nothing); a firm-B *reviewer* — who
   has the permission but not the tenancy — gets **404**. Both cases are asserted,
   demonstrating authentication ≠ authorization and frontend hiding ≠ security.

## Reviewing a document (what the reviewer sees)

Staff upload real files; every upload creates an immutable version row and the
checklist shows the latest file name (📎 `statement.pdf`). Reviewers get:

- **Open '\<filename\>'** — downloads the latest version via
  `GET /api/documents/:id/file?version=N` (per-version links too).
- **History** — expands inline to show every version (file name, size,
  uploader, timestamp, each with its own download link) plus the
  document-scoped audit trail (actor, action, version, reason, timestamp).
- **Start review / Approve / Request correction** — correction requires a
  reason (frontend + server enforced); stale versions get `409`.

Reviewers can also create clients (client list → "New client", assigned to a
firm staffer with the default 5-document checklist) and add required documents
from the workspace ("+ Required document").

## Screenshots

> Screenshots are taken from the local dev server (`npm run seed && npm run dev`).
> Demo password for all accounts: `DemoAudit!2026`.

| # | View | File |
|---|---|---|
| 1 | Login with one-click demo accounts | `docs/screenshots/01-login.png` |
| 2 | Client list with approval progress + new-client form (reviewer) | `docs/screenshots/02-clients.png` |
| 3 | Workspace checklist with file names, status badges, upload control | `docs/screenshots/03-workspace.png` |
| 4 | Reviewer controls + correction comment box | `docs/screenshots/04-review.png` |
| 5 | Expanded History (versions + per-document audit trail) | `docs/screenshots/05-history.png` |
| 6 | Recent activity feed (client-level audit trail) | `docs/screenshots/06-activity.png` |

## Audit trail

- `recordAudit` writes into `audit_events` **inside the same transaction** as the
  change it records — a status change without its log entry is impossible by
  construction.
- Schema triggers abort any `UPDATE`/`DELETE` on `audit_events` (and on
  `document_versions`) — the log is append-only at the database level, not just
  in the UI.
- Every event stores who (actor name + role), what (action), when (UTC), which
  document/client, the version, and the full reason (e.g. "Page 3 is missing.
  Please upload the complete bank statement.").
- Uploads never overwrite: each upload creates a new immutable
  `document_versions` row; reviewers can download every historical version.

## Tests

```bash
run-tests.cmd                        # kill :3000 → wipe+reseed DB → fresh server →
                                     # wait for health → run acceptance suite
                                     # (works from any clone path; exits with the
                                     # suite's own exit code for CI)
npm test                             # schema (4) + API acceptance (12) suites
npm run test:schema                  # in-memory tenant-integrity checks
npm run test:api                     # API suite (needs `npm run dev` running)
```

The acceptance suite (`tests/api.test.mjs`, 12 tests) covers: bad credentials;
401 handling; assigned-client scoping; cross-origin rejection; role enforcement
(staff cannot review, reviewers cannot upload); reviewer client creation with
the default checklist; the full
upload → review → correction → re-upload → approve loop; stale-version (409) and
approved-document immutability; exact audit-event ordering with actors, versions
and reasons; file-name metadata in list + detail responses; versioned downloads
with distinct bytes; same-firm unassigned-staff 404 on read/download/upload;
cross-tenant 404 on read and all four mutation paths; and logout invalidation.
**Current status: 12/12.**

## Design decisions worth calling out

- **Approved documents are locked.** A sign-off must never be silently mutated.
  Corrections after approval would need a new review cycle; this prototype blocks
  them entirely — a deliberate, stated limit.
- **Segregation of duties.** Staff produce evidence; reviewers judge it
  (`actionAllowedForRole` in `lib/state.ts`).
- **Optimistic concurrency.** Mutations carry the caller's seen `version`; a stale
  value gets 409 instead of a lost update.
- **Review ownership.** `START_REVIEW` records who picked the document up, and
  decisions from `UNDER_REVIEW` are only accepted from that reviewer — matching the
  spec's example narrative.
- **404 over 403 for cross-tenant resources** so existence is never disclosed;
  role failures stay 403 because they are tenant-independent.

## Known limits (stated, not hidden)

- Demo passwords are public by design; production needs rate limiting, password
  reset, and proper user management.
- CSRF is handled via same-origin `Origin` checks, not tokens.
- No notifications or follow-up reminders — the biggest product gap.
- Files live inside SQLite with a 10 MB cap; wrong for production scale.

## What would you improve with one more week?

I would not add features — I would harden the three things that make a CA firm
trust this system:

1. **Tamper-evident audit log.** The log is already append-only (triggers abort
   any UPDATE/DELETE), but that is only as strong as the people with DB access.
   I'd hash-chain events — each record carries the hash of the previous — so any
   retroactive edit, even directly in the database, becomes detectable. For a CA
   firm whose own deliverable is an audit, traceable isn't enough; it must be
   tamper-evident.
2. **Close the follow-up loop.** This tool replaces WhatsApp+Excel chasing. I'd
   add per-document due dates and a simple overdue view per staff member,
   turning the checklist into a managed process rather than a status board.
3. **Production data layer.** PostgreSQL instead of SQLite — the data-access
   layer is one file, but the migration is real work (async driver, SQL dialect,
   transaction semantics) — plus per-firm encryption at rest and object storage
   with signed URLs instead of BLOBs.

I would consciously skip notifications and integrations: valuable, but only
after the trust and accountability core is solid.

## AI Tools Used

ChatGPT: not used.
Claude: pair-programmed the full implementation via Cline — scaffolding,
schema, API, UI, tests, and this README. Also drove the follow-up polish pass:
replaced the landing media with product-appropriate stock, fixed a malformed
inline script that was silently breaking the landing animation runtime,
redesigned the workspace into a cleaner light product-tool UI, added due dates,
a needs-attention queue, workspace status filters, and CSV export of the audit
trail, and made the app container-deployable. Debugging was driven by real
evidence (server logs, failing tests, in-browser DOM inspection), not assumptions.
Gemini: not used.
Cursor: not used.
GitHub Copilot: not used.
Other (Muse Spark): post-review hardening pass — reviewer file open/download +
History panel, same-firm read authorization fix, idempotent lived-in reseed
(real PDF/CSV files, multi-week audit history), `npm test` scripts,
client-creation UI, lint/consistency cleanup, and the extra same-firm +
file-metadata acceptance tests.

**How AI was used:** as an implementation accelerator under my direction. I can
explain every part of the system: the transition table, composite-FK tenant
model, transactional audit writes, the null-prototype → plain-object RSC
boundary fix, and the deterministic test lifecycle. I also made — and can defend
— the deliberate trade-offs: 404-not-403 for cross-tenant reads,
approved-document immutability, review ownership, the Origin-based CSRF
posture, and keeping the stack self-contained (SQLite + local storage) instead
of reaching for services the brief explicitly said were out of scope.
