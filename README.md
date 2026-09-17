# OBLIQ Audit — Mini Document Review System

A focused audit-workflow prototype for small CA firms: staff upload client
documents, reviewers approve or request corrections, and **every action is
recorded in an append-only audit trail**.

## Quick start

```bash
npm install
npm run seed     # creates data/audit.db: 2 firms, 4 users, 2 clients, checklists
npm run dev      # http://localhost:3000
```

**Demo accounts** (password: `DemoAudit!2026`):

| Email | Role | Firm |
|---|---|---|
| `rohit@abc.test` | STAFF | ABC & Co. |
| `aman@abc.test` | REVIEWER | ABC & Co. |
| `priya@xyz.test` | STAFF | XYZ & Co. |
| `neha@xyz.test` | REVIEWER | XYZ & Co. |

## The workflow

```
PENDING ──upload──▶ UPLOADED ──start review──▶ UNDER_REVIEW ──┬─approve──▶ APPROVED
                                                              └─request correction──▶ CORRECTION_REQUIRED ──re-upload──▶ UPLOADED
```

The state machine (`lib/state.ts`) is an explicit allow-list: any transition not
in the table is rejected by the **server** with `409 Conflict`. The UI hiding a
button is not part of the security model.

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
2. **Composite foreign keys** bind every child row to its parent *within the same
   firm* (`FOREIGN KEY (firm_id, client_id) REFERENCES clients(firm_id, id)` and
   equivalents). Even a hypothetical missing WHERE clause could not create a
   cross-firm link. `PRAGMA foreign_keys = ON` is set on every connection;
   `tests/schema.test.mjs` proves insert/update rejections.
3. **Role ≠ tenancy.** A firm-B *staff* gets the same 403 on Firm A documents as on
   their own (role check fires first, leaking nothing); a firm-B *reviewer* — who
   has the permission but not the tenancy — gets **404**. Both cases are asserted,
   demonstrating authentication ≠ authorization and frontend hiding ≠ security.

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
run-tests.cmd                        # kill server → wipe+reseed DB → fresh server →
                                     # wait for health → run acceptance suite
node --test tests/schema.test.mjs    # in-memory tenant-integrity checks
```

The acceptance suite (`tests/api.test.mjs`, 10 tests) covers: bad credentials;
401 handling; assigned-client scoping; cross-origin rejection; role enforcement
(staff cannot review, reviewers cannot upload); the full
upload → review → correction → re-upload → approve loop; stale-version (409) and
approved-document immutability; exact audit-event ordering with actors, versions
and reasons; versioned downloads with distinct bytes; cross-tenant 404 on read
and all four mutation paths; and logout invalidation. **Current status: 10/10.**

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

- **Cline (Claude):** pair-programmed the full implementation — scaffolding,
  schema, API, UI, tests, and this README. Debugging was driven by real evidence
  (server logs, failing tests), not assumptions.

**How AI was used:** as an implementation accelerator under my direction. I can
explain every part of the system: the transition table, composite-FK tenant
model, transactional audit writes, the null-prototype → plain-object RSC
boundary fix, and the deterministic test lifecycle. I also made — and can defend
— the deliberate trade-offs: 404-not-403 for cross-tenant reads,
approved-document immutability, review ownership, and the Origin-based CSRF
posture.
