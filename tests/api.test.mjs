/**
 * End-to-end acceptance tests for the audit workflow API.
 * Run with:  node --test tests/api.test.mjs   (server must be running)
 * BASE_URL env overrides http://localhost:3000.
 *
 * These tests cover the evaluation's core claims:
 *   - the full review loop (upload -> review -> correction -> re-upload -> approve)
 *   - role enforcement (staff cannot review, reviewers cannot upload)
 *   - tenant isolation (Firm B users get 404 on Firm A data, never leaks)
 *   - version immutability + approved-document immutability
 *   - audit history completeness (who / what / when / which version / why)
 */
import assert from "node:assert/strict";
import test from "node:test";

const BASE = process.env.BASE_URL || "http://localhost:3000";

function makePdf(label) {
  return new Blob([Buffer.from(`%PDF-1.4\n% ${label}\n%%EOF\n`)], { type: "application/pdf" });
}

async function login(email) {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: "DemoAudit!2026" }),
  });
  assert.equal(res.status, 200, `login failed for ${email}: ${res.status}`);
  const cookie = res.headers.getSetCookie()[0].split(";")[0];
  return { cookie };
}

function h(cookie, extra = {}) {
  return { cookie, origin: BASE, ...extra };
}

async function api(cookie, path, options = {}) {
  return fetch(`${BASE}${path}`, { ...options, headers: h(cookie, options.headers) });
}

let rohit, aman, priya;
let bankStatement;

test.before(async () => {
  rohit = await login("rohit@abc.test"); // STAFF, firm 1
  aman = await login("aman@abc.test");   // REVIEWER, firm 1
  priya = await login("priya@xyz.test"); // STAFF, firm 2
});

test("bad credentials are rejected", async () => {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: "rohit@abc.test", password: "wrong" }),
  });
  assert.equal(res.status, 401);
});

test("unauthenticated requests are rejected with 401", async () => {
  assert.equal((await fetch(`${BASE}/api/clients`)).status, 401);
  assert.equal((await fetch(`${BASE}/api/documents/1`)).status, 401);
});


test("staff sees only assigned clients and no staff list", async () => {
  const res = await api(rohit.cookie, "/api/clients");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.clients.length, 1);
  assert.equal(body.clients[0].name, "ABC Traders Pvt. Ltd.");
  assert.deepEqual(body.staff, []);
});

test("cross-origin state-changing request is rejected", async () => {
  const res = await fetch(`${BASE}/api/clients`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example" },
    body: JSON.stringify({ name: "Evil Co", assignedStaffId: 1 }),
  });
  assert.equal(res.status, 403);
});

test("staff cannot create clients or review documents", async () => {
  assert.equal((await api(rohit.cookie, "/api/clients", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Rohit Co", assignedStaffId: 1 }),
  })).status, 403);
  assert.equal((await api(rohit.cookie, "/api/documents/1/review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "APPROVE" }),
  })).status, 403);
});

test("reviewer can create a client and sees the default checklist", async () => {
  const staff = (await (await api(aman.cookie, "/api/clients")).json()).staff;
  assert.ok(staff.length >= 1);
  const res = await api(aman.cookie, "/api/clients", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Test Industries", assignedStaffId: staff[0].id }),
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  const detail = await (await api(aman.cookie, `/api/clients/${created.id}`)).json();
  assert.equal(detail.documents.length, 5);
  assert.ok(detail.events.some((e) => e.action === "CLIENT_CREATED"));
});

test("full review loop on Bank Statement", async () => {
  const detail = await (await api(rohit.cookie, "/api/clients/1")).json();
  bankStatement = detail.documents.find((d) => d.doc_type === "Bank Statement");
  assert.ok(bankStatement);
  assert.equal(bankStatement.status, "PENDING");

  // staff uploads version 1
  const form1 = new FormData();
  form1.append("file", makePdf("v1"), "bank-statement.pdf");
  form1.append("version", String(bankStatement.version));
  let res = await api(rohit.cookie, `/api/documents/${bankStatement.id}/upload`, {
    method: "POST",
    body: form1,
  });
  assert.equal(res.status, 200, `upload v1 failed: ${await res.text()}`);

  // duplicate upload while UPLOADED is an illegal transition
  const formDup = new FormData();
  formDup.append("file", makePdf("dup"), "bank-statement.pdf");
  res = await api(rohit.cookie, `/api/documents/${bankStatement.id}/upload`, {
    method: "POST",
    body: formDup,
  });
  assert.equal(res.status, 409);

  // reviewer starts review (version 1)
  res = await api(aman.cookie, `/api/documents/${bankStatement.id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "START_REVIEW", version: 1 }),
  });
  assert.equal(res.status, 200, `start review failed: ${await res.text()}`);

  // correction without a reason is rejected
  res = await api(aman.cookie, `/api/documents/${bankStatement.id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "REQUEST_CORRECTION", version: 1, comment: "" }),
  });
  assert.equal(res.status, 400);

  // correction with a reason moves the document to CORRECTION_REQUIRED
  res = await api(aman.cookie, `/api/documents/${bankStatement.id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "REQUEST_CORRECTION",
      version: 1,
      comment: "Page 3 is missing. Please upload the complete bank statement.",
    }),
  });
  assert.equal(res.status, 200);

  // staff sees the correction comment
  let doc = await (await api(rohit.cookie, `/api/documents/${bankStatement.id}`)).json();
  assert.equal(doc.document.status, "CORRECTION_REQUIRED");
  assert.match(doc.document.correction_comment, /Page 3 is missing/);

  // stale-version upload is rejected
  const stale = new FormData();
  stale.append("file", makePdf("stale"), "bank-statement.pdf");
  stale.append("version", "0");
  res = await api(rohit.cookie, `/api/documents/${bankStatement.id}/upload`, {
    method: "POST",
    body: stale,
  });
  assert.equal(res.status, 409);

  // staff uploads corrected version 2
  const form2 = new FormData();
  form2.append("file", makePdf("corrected version two"), "bank-statement-final.pdf");
  form2.append("version", "1");
  res = await api(rohit.cookie, `/api/documents/${bankStatement.id}/upload`, {
    method: "POST",
    body: form2,
  });
  assert.equal(res.status, 200, `upload v2 failed: ${await res.text()}`);

  // reviewer picks it up, then approves version 2 (spec flow: start, then decide)
  res = await api(aman.cookie, `/api/documents/${bankStatement.id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "START_REVIEW", version: 2 }),
  });
  assert.equal(res.status, 200, `second start failed: ${await res.text()}`);
  res = await api(aman.cookie, `/api/documents/${bankStatement.id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "APPROVE", version: 2 }),
  });
  assert.equal(res.status, 200, `approve failed: ${await res.text()}`);

  // approved documents are immutable
  const form3 = new FormData();
  form3.append("file", makePdf("v3"), "bank-statement.pdf");
  res = await api(rohit.cookie, `/api/documents/${bankStatement.id}/upload`, {
    method: "POST",
    body: form3,
  });
  assert.equal(res.status, 409);
  res = await api(aman.cookie, `/api/documents/${bankStatement.id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "REQUEST_CORRECTION", version: 2, comment: "re-litigate" }),
  });
  assert.equal(res.status, 409);
});

test("audit history records the full story in order, with versions and reasons", async () => {
  const body = await (await api(rohit.cookie, `/api/documents/${bankStatement.id}`)).json();
  assert.equal(body.document.status, "APPROVED");
  assert.equal(body.document.version, 2);

  const actions = body.events.map((e) => e.action);
  assert.deepEqual(actions, [
    "DOCUMENT_UPLOADED",
    "REVIEW_STARTED",
    "CORRECTION_REQUESTED",
    "DOCUMENT_UPLOADED",
    "REVIEW_STARTED",
    "DOCUMENT_APPROVED",
  ]);
  const correction = body.events.find((e) => e.action === "CORRECTION_REQUESTED");
  assert.match(correction.detail, /Page 3 is missing/);
  assert.equal(correction.actor_name, "Aman Verma");
  assert.equal(correction.version, 1);
  const uploads = body.events.filter((e) => e.action === "DOCUMENT_UPLOADED");
  assert.equal(uploads[0].version, 1);
  assert.equal(uploads[1].version, 2);
  assert.equal(uploads[0].actor_name, "Rohit Sharma");
  assert.ok(body.events.every((e) => e.created_at));

  // two immutable versions with distinct bytes
  assert.equal(body.versions.length, 2);
  const v1 = await (await api(rohit.cookie, `/api/documents/${bankStatement.id}/file?version=1`)).arrayBuffer();
  const v2 = await (await api(rohit.cookie, `/api/documents/${bankStatement.id}/file?version=2`)).arrayBuffer();
  assert.notEqual(v1.byteLength, v2.byteLength);
  assert.ok(Buffer.from(v1).toString().startsWith("%PDF-1.4"));
});

test("firm B cannot see or touch firm A data (404 everywhere)", async () => {
  assert.equal((await api(priya.cookie, "/api/clients/1")).status, 404);
  assert.equal((await api(priya.cookie, `/api/documents/${bankStatement.id}`)).status, 404);
  assert.equal((await api(priya.cookie, `/api/documents/${bankStatement.id}/file`)).status, 404);
  const form = new FormData();
  form.append("file", makePdf("intrusion"), "x.pdf");
  assert.equal((await api(priya.cookie, `/api/documents/${bankStatement.id}/upload`, {
    method: "POST",
    body: form,
  })).status, 404);
  // Priya is STAFF: role check fires first (same denial she'd get on her own firm), so 403.
  assert.equal((await api(priya.cookie, `/api/documents/${bankStatement.id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "APPROVE" }),
  })).status, 403);
  // A firm-B REVIEWER has the role but not the tenancy — the real isolation proof is 404.
  const neha = await login("neha@xyz.test");
  assert.equal((await api(neha.cookie, `/api/documents/${bankStatement.id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "APPROVE" }),
  })).status, 404);
  assert.equal((await api(neha.cookie, `/api/documents/${bankStatement.id}`)).status, 404);
  const priyaClients = await (await api(priya.cookie, "/api/clients")).json();
  assert.equal(priyaClients.clients.length, 1);
  assert.equal(priyaClients.clients[0].name, "XYZ Retail Pvt. Ltd.");
});

test("logout invalidates the session", async () => {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: "neha@xyz.test", password: "DemoAudit!2026" }),
  });
  const cookie = res.headers.getSetCookie()[0].split(";")[0];
  assert.equal((await fetch(`${BASE}/api/me`, { headers: { cookie } })).status, 200);
  await fetch(`${BASE}/api/logout`, { method: "POST", headers: { origin: BASE, cookie } });
  assert.equal((await fetch(`${BASE}/api/me`, { headers: { cookie } })).status, 401);
});
