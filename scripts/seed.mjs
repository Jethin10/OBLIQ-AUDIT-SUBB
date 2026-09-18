/**
 * PART A — setup, clock helpers, dependency-free PDF builder.
 */
import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const dataDir = process.env.DATA_DIR || path.join(root, "data");
const dbPath = path.join(dataDir, "audit.db");

fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 10000;");
try {
  db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
} catch {
  // journal_mode may be delete on a fresh file — safe to ignore.
}
db.exec("PRAGMA foreign_keys=ON;");
db.exec(fs.readFileSync(path.join(root, "lib", "schema.sql"), "utf8"));

// Wipe rows in foreign-key-safe order. The append-only triggers on
// audit_events / document_versions would block plain DELETEs, so drop them
// first and recreate them afterwards via the schema.
db.exec(`
  DROP TRIGGER IF EXISTS audit_no_update;
  DROP TRIGGER IF EXISTS audit_no_delete;
  DROP TRIGGER IF EXISTS versions_no_update;
  DROP TRIGGER IF EXISTS versions_no_delete;
  DELETE FROM audit_events;
  DELETE FROM document_versions;
  DELETE FROM sessions;
  DELETE FROM documents;
  DELETE FROM clients;
  DELETE FROM users;
  DELETE FROM firms;
  DELETE FROM sqlite_sequence;
`);
db.exec(fs.readFileSync(path.join(root, "lib", "schema.sql"), "utf8"));

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$N=16384,r=8,p=1$${salt}$${hash.toString("hex")}`;
}

/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) for `daysAgo` days back at HH:MM IST. */
function ts(daysAgo, istHH, istMM) {
  const day = new Date(Date.now() - daysAgo * 86400000);
  const midnightUtc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  const at = new Date(midnightUtc + (istHH * 60 + istMM - 330) * 60000); // IST -> UTC
  return at.toISOString().slice(0, 19).replace("T", " ");
}

// ---------------------------------------------------------------------------
// Minimal valid-PDF builder (no dependencies). Helvetica text, N pages,
// readable by any PDF viewer; bytes start with "%PDF-1.4".
// NOTE: amounts use "Rs." — the rupee glyph is not in Helvetica/WinAnsi.
// ---------------------------------------------------------------------------
function pdfEscape(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(pages) {
  const parts = [];
  const size = () => parts.reduce((a, b) => a + b.length, 0);
  const push = (s) => parts.push(Buffer.from(s, "latin1"));
  push("%PDF-1.4\n");
  const pageNums = [];
  const contentNums = [];
  let next = 4;
  for (let i = 0; i < pages.length; i++) {
    pageNums.push(next++);
    contentNums.push(next++);
  }
  const total = next - 1;
  const offsets = {};
  const obj = (n, head, bodyBuf, tail = "") => {
    offsets[n] = size();
    push(`${n} 0 obj\n${head}\n`);
    if (bodyBuf) parts.push(bodyBuf);
    if (tail) push(tail);
  };
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  obj(2, `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`);
  obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  for (let i = 0; i < pages.length; i++) {
    obj(pageNums[i], `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNums[i]} 0 R >>\nendobj\n`);
    const ops = pages[i].map(
      (ln, idx) => (idx === 0 ? `BT /F1 10 Tf 50 800 Td (${pdfEscape(ln)}) Tj` : `0 -14 Td (${pdfEscape(ln)}) Tj`)
    );
    const stream = Buffer.from(ops.join("\n") + "\nET", "latin1");
    obj(contentNums[i], `<< /Length ${stream.length} >>\nstream\n`, stream, "\nendstream\nendobj\n");
  }
  const xrefAt = size();
  push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= total; n++) {
    push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);
  return Buffer.concat(parts);
}

function inr(n) {
  return "Rs." + n.toLocaleString("en-IN");
}
/**
 * PART B1 — realistic file-content builders (valid PDFs + CSVs).
 */

function bankPages(company, account, monthLabel, allTxns, pagesOf) {
  const header = [
    "HDFC BANK LTD - CURRENT ACCOUNT STATEMENT",
    `${company} | A/c No: ${account} | Period: ${monthLabel}`,
    "-------------------------------------------------------------------------------",
    "Date        Particulars                        Debit        Credit       Balance",
    "-------------------------------------------------------------------------------",
  ];
  return pagesOf.map((idxs, p) => {
    const lines = [...header];
    if (p > 0) lines[0] = `HDFC BANK LTD - STATEMENT (contd. page ${p + 1})`;
    for (const i of idxs) lines.push(allTxns[i]);
    return lines;
  });
}

function txn(date, particulars, debit, credit, balance) {
  const pad = (s, w) => String(s).padEnd(w).slice(0, w);
  return `${pad(date, 12)}${pad(particulars, 35)}${pad(debit ? inr(debit) : "-", 13)}${pad(credit ? inr(credit) : "-", 13)}${inr(balance)}`;
}

function salesCsv(company, gstin, rows) {
  const out = [`Sales Register - ${company} (GSTIN ${gstin})`, "Date,Invoice No,Customer,Customer GSTIN,Taxable Value,CGST,SGST,Invoice Total"];
  for (const r of rows) out.push(r.join(","));
  return Buffer.from(out.join("\n") + "\n", "utf8");
}

function purchaseCsv(company, rows) {
  const out = [`Purchase Register - ${company}`, "Date,Bill No,Supplier,Taxable Value,GST Paid,Bill Total"];
  for (const r of rows) out.push(r.join(","));
  return Buffer.from(out.join("\n") + "\n", "utf8");
}

function expenseCsv(company, rows) {
  const out = [`Expense Summary - ${company}`, "Head,March Amount (Rs)"];
  for (const r of rows) out.push(r.join(","));
  return Buffer.from(out.join("\n") + "\n", "utf8");
}

function gstrPdf(company, gstin, monthLabel, outward, itc, payable) {
  return buildPdf([[
    "GOODS AND SERVICES TAX - FORM GSTR-3B (Summary Return)",
    `Legal Name: ${company} | GSTIN: ${gstin} | Return Period: ${monthLabel}`,
    "-------------------------------------------------------------------------------",
    `Outward taxable supplies (net):              ${inr(outward)}`,
    `Input Tax Credit available:                  ${inr(itc)}`,
    `Net tax payable in cash:                     ${inr(payable)}`,
    "-------------------------------------------------------------------------------",
    "Status: Filed (ARN AA2703260012345) | Filed by: Authorised Signatory",
    "Note: figures auto-matched against GSTR-2B before reviewer sign-off.",
  ]]);
}
/**
 * PART B2 — prepared statements + helpers mirroring the app's semantics.
 */
const PASSWORD = "DemoAudit!2026";
const insertFirm = db.prepare("INSERT INTO firms (name) VALUES (?)");
const insertUser = db.prepare(
  "INSERT INTO users (firm_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)"
);
const insertClient = db.prepare(
  "INSERT INTO clients (firm_id, name, assigned_staff_id) VALUES (?, ?, ?)"
);
const insertDoc = db.prepare(
  "INSERT INTO documents (firm_id, client_id, doc_type) VALUES (?, ?, ?)"
);
const insertVersion = db.prepare(
  `INSERT INTO document_versions
     (firm_id, document_id, version, file_name, file_mime, file_size, content, uploaded_by, uploaded_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertEvent = db.prepare(
  `INSERT INTO audit_events
     (firm_id, actor_id, actor_name, actor_role, client_id, document_id, action, version, detail, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const DOC_TYPES = ["Bank Statement", "Sales Register", "Purchase Register", "GST Return", "Expense Summary"];

function emit(firmId, actor, clientId, docId, action, version, detail, at) {
  insertEvent.run(firmId, actor.id, actor.name, actor.role, clientId, docId, action, version, detail, at);
}

function onboardClient(name, firmId, staff, reviewer, createdDaysAgo) {
  const clientId = insertClient.run(firmId, name, staff.id).lastInsertRowid;
  const docIds = {};
  for (const dt of DOC_TYPES) docIds[dt] = insertDoc.run(firmId, clientId, dt).lastInsertRowid;
  emit(firmId, reviewer, clientId, null, "CLIENT_CREATED", null,
    "Client onboarded with 5-document checklist", ts(createdDaysAgo, 9, 32));
  insertEvent.run(firmId, null, "System", "SYSTEM", clientId, null, "DOCUMENT_REQUIRED", null,
    `Checklist created: ${DOC_TYPES.join(", ")}`, ts(createdDaysAgo, 9, 32));
  return { clientId, docIds };
}

function uploadVersion(firmId, clientId, docId, docType, version, file, staff, at) {
  db.prepare(
    `UPDATE documents SET status = 'UPLOADED', version = ?, file_name = ?, file_mime = ?,
       file_size = ?, uploaded_by = ?, uploaded_at = ?,
       review_started_by = NULL, review_started_at = NULL,
       reviewed_by = NULL, reviewed_at = NULL, correction_comment = NULL
     WHERE id = ? AND firm_id = ?`
  ).run(version, file.name, file.mime, file.content.length, staff.id, at, docId, firmId);
  insertVersion.run(firmId, docId, version, file.name, file.mime, file.content.length, file.content, staff.id, at);
  emit(firmId, staff, clientId, docId, "DOCUMENT_UPLOADED", version, `Uploaded '${file.name}' for ${docType}`, at);
}

function startReview(firmId, clientId, docId, docType, version, reviewer, at) {
  db.prepare(
    `UPDATE documents SET status = 'UNDER_REVIEW', review_started_by = ?,
       review_started_at = ?, assigned_reviewer_id = ? WHERE id = ? AND firm_id = ?`
  ).run(reviewer.id, at, reviewer.id, docId, firmId);
  emit(firmId, reviewer, clientId, docId, "REVIEW_STARTED", version, `Started reviewing '${docType}'`, at);
}

function approveDoc(firmId, clientId, docId, version, reviewer, comment, at) {
  db.prepare(
    `UPDATE documents SET status = 'APPROVED', reviewed_by = ?, reviewed_at = ?,
       correction_comment = NULL WHERE id = ? AND firm_id = ?`
  ).run(reviewer.id, at, docId, firmId);
  emit(firmId, reviewer, clientId, docId, "DOCUMENT_APPROVED", version,
    comment ? `Approved. ${comment}` : "Approved", at);
}

function requestCorrection(firmId, clientId, docId, version, reviewer, comment, at) {
  db.prepare(
    `UPDATE documents SET status = 'CORRECTION_REQUIRED', correction_comment = ?,
       reviewed_by = ?, reviewed_at = ? WHERE id = ? AND firm_id = ?`
  ).run(comment, reviewer.id, at, docId, firmId);
  emit(firmId, reviewer, clientId, docId, "CORRECTION_REQUESTED", version, comment, at);
}
/**
 * NARRATOR A — Firm A clients (runs inside one transaction).
 * Prereqs: firms ABC (1), XYZ (2); users in globalThis.__users.
 */
const seedNarrA = () => {
  const { rohit, aman, vikram } = globalThis.__users;
  const abcId = 1;
  db.exec("BEGIN");

  // -- ABC Traders stays PRISTINE for the acceptance suite ---------------
  onboardClient("ABC Traders Pvt. Ltd.", abcId, rohit, aman, 21);

  // -- Vikram Enterprises: Bank Statement approved, Sales Register fresh --
  const vik = onboardClient("Vikram Enterprises Pvt. Ltd.", abcId, vikram, aman, 17);
  {
    const { clientId, docIds } = vik;
    const tx = [
      txn("02-Mar-26", "UPI/Vikram Traders/3341", 0, 145000, 614500),
      txn("05-Mar-26", "NEFT/Aarti Mills yarn", 212400, 0, 402100),
      txn("09-Mar-26", "UPI/Retail counter coll.", 0, 86250, 488350),
      txn("14-Mar-26", "IMPS/GST payment Feb", 96400, 0, 391950),
      txn("21-Mar-26", "NEFT/Sharma Exports", 0, 230000, 621950),
      txn("27-Mar-26", "UPI/Power and wages", 78400, 0, 543550),
    ];
    const f = { name: "HDFC_Statement_Mar2026.pdf", mime: "application/pdf" };
    f.content = buildPdf(bankPages("Vikram Enterprises Pvt. Ltd.", "50200099887766",
      "01-Mar-2026 to 31-Mar-2026", tx, [[0, 1, 2], [3, 4, 5]]));
    uploadVersion(abcId, clientId, docIds["Bank Statement"], "Bank Statement", 1, f, vikram, ts(11, 10, 15));
    approveDoc(abcId, clientId, docIds["Bank Statement"], 1, aman,
      "Opening and closing balances verified.", ts(10, 15, 50));
    const s = { name: "Sales_Register_Mar.csv", mime: "text/csv" };
    s.content = salesCsv("Vikram Enterprises Pvt. Ltd.", "27AAKCV1234E1Z8", [
      ["03-Mar-26", "VE-241", "Sharma Exports", "27AAKCS8899Q1Z2", "230000", "20700", "20700", "271400"],
      ["18-Mar-26", "VE-242", "Aarti Mills", "27AAECA4455R1Z9", "145000", "13050", "13050", "171100"],
    ]);
    uploadVersion(abcId, clientId, docIds["Sales Register"], "Sales Register", 1, s, vikram, ts(3, 13, 20));
  }

  // -- Sharma Textiles: the showcase correction loop ----------------------
  const sharma = onboardClient("Sharma Textiles Pvt. Ltd.", abcId, rohit, aman, 17);
  {
    const { clientId, docIds } = sharma;
    const v1tx = [
      txn("02-Mar-26", "UPI/Fabric sale counter", 0, 184500, 952300),
      txn("04-Mar-26", "NEFT/Aarti Mills yarn", 326000, 0, 626300),
      txn("07-Mar-26", "NEFT/Kumar Exports", 0, 412000, 1038300),
      txn("11-Mar-26", "IMPS/GST payment Feb", 128400, 0, 909900),
      txn("15-Mar-26", "UPI/Dyeing unit charges", 96400, 0, 813500),
      txn("19-Mar-26", "NEFT/Sharma Exports", 0, 275000, 1088500),
    ];
    const v2tx = [...v1tx,
      txn("24-Mar-26", "NEFT/Powerloom wages", 152000, 0, 936500),
      txn("28-Mar-26", "UPI/Export realisation", 0, 198000, 1134500),
      txn("31-Mar-26", "IMPS/Bank charges", 1250, 0, 1133250),
    ];
    const acct = "50200012345678";
    const v1 = { name: "HDFC_Statement_Mar2026.pdf", mime: "application/pdf" };
    v1.content = buildPdf(bankPages("Sharma Textiles Pvt. Ltd.", acct,
      "01-Mar-2026 to 31-Mar-2026", v1tx, [[0, 1, 2], [3, 4, 5]]));
    uploadVersion(abcId, clientId, docIds["Bank Statement"], "Bank Statement", 1, v1, rohit, ts(16, 10, 20));
    startReview(abcId, clientId, docIds["Bank Statement"], "Bank Statement", 1, aman, ts(16, 10, 31));
    requestCorrection(abcId, clientId, docIds["Bank Statement"], 1, aman,
      "Page 3 is missing. Please upload the complete bank statement.", ts(16, 10, 34));
    const v2 = { name: "HDFC_Statement_Mar2026.pdf", mime: "application/pdf" };
    v2.content = buildPdf(bankPages("Sharma Textiles Pvt. Ltd.", acct,
      "01-Mar-2026 to 31-Mar-2026", v2tx, [[0, 1, 2], [3, 4, 5], [6, 7, 8]]));
    uploadVersion(abcId, clientId, docIds["Bank Statement"], "Bank Statement", 2, v2, rohit, ts(16, 11, 5));
    approveDoc(abcId, clientId, docIds["Bank Statement"], 2, aman,
      "All three pages present. Closing balance verified.", ts(16, 11, 12));

    const s = { name: "Sales_Register_Q1.csv", mime: "text/csv" };
    s.content = salesCsv("Sharma Textiles Pvt. Ltd.", "27AAKCS7788P1Z4", [
      ["05-Jan-26", "ST-1181", "Kumar Exports", "27AAKCK5566L1Z3", "412000", "20600", "20600", "453200"],
      ["22-Jan-26", "ST-1182", "Sharma Exports", "27AAKCS8899Q1Z2", "275000", "13750", "13750", "302500"],
      ["09-Feb-26", "ST-1183", "Retail counter", "URP", "184500", "9225", "9225", "203000"],
      ["27-Feb-26", "ST-1184", "Aarti Mills", "27AAECA4455R1Z9", "198000", "9900", "9900", "217800"],
    ]);
    uploadVersion(abcId, clientId, docIds["Sales Register"], "Sales Register", 1, s, rohit, ts(15, 11, 5));
    startReview(abcId, clientId, docIds["Sales Register"], "Sales Register", 1, aman, ts(15, 14, 40));
    approveDoc(abcId, clientId, docIds["Sales Register"], 1, aman,
      "Invoices ST-1181 to ST-1184 agree with the ledger.", ts(14, 16, 40));

    const p = { name: "Purchase_Register_Mar.csv", mime: "text/csv" };
    p.content = purchaseCsv("Sharma Textiles Pvt. Ltd.", [
      ["04-Mar-26", "AM-9031", "Aarti Mills", "326000", "29340", "355340"],
      ["12-Mar-26", "DY-2210", "City Dyeing Unit", "96400", "17352", "113752"],
      ["20-Mar-26", "TR-5571", "Metro Transport", "24500", "4410", "28910"],
    ]);
    uploadVersion(abcId, clientId, docIds["Purchase Register"], "Purchase Register", 1, p, rohit, ts(2, 12, 15));
    startReview(abcId, clientId, docIds["Purchase Register"], "Purchase Register", 1, aman, ts(1, 10, 5));

    const g = { name: "GSTR3B_Mar2026.pdf", mime: "application/pdf" };
    g.content = gstrPdf("Sharma Textiles Pvt. Ltd.", "27AAKCS7788P1Z4", "March 2026", 842500, 61200, 18900);
    uploadVersion(abcId, clientId, docIds["GST Return"], "GST Return", 1, g, rohit, ts(5, 15, 30));
    requestCorrection(abcId, clientId, docIds["GST Return"], 1, aman,
      "GSTR-3B taxable value (Rs.8,42,500) is short of the sales register March total. Please reconcile and re-upload.",
      ts(4, 11, 20));

    const e = { name: "Expense_Summary_Mar.csv", mime: "text/csv" };
    e.content = expenseCsv("Sharma Textiles Pvt. Ltd.", [
      ["Yarn and fabric", "326000"],
      ["Dyeing and processing", "96400"],
      ["Wages", "152000"],
      ["Power and fuel", "48600"],
      ["Transport", "24500"],
      ["Repairs", "18750"],
    ]);
    uploadVersion(abcId, clientId, docIds["Expense Summary"], "Expense Summary", 1, e, rohit, ts(6, 12, 20));
    approveDoc(abcId, clientId, docIds["Expense Summary"], 1, aman,
      "Heads agree with the trial balance.", ts(6, 16, 10));
  }
  db.exec("COMMIT");
};
/**
 * NARRATOR B — Kumar Exports + XYZ Retail (one transaction).
 */
const seedNarrB = () => {
  const { rohit, aman, priya, neha } = globalThis.__users;
  const abcId = 1;
  const xyzId = 2;
  db.exec("BEGIN");

  const kumar = onboardClient("Kumar Exports Pvt. Ltd.", abcId, rohit, aman, 9);
  {
    const { clientId, docIds } = kumar;
    const tx = [
      txn("03-Mar-26", "FIRC/Export proceeds", 0, 560000, 812000),
      txn("10-Mar-26", "NEFT/Freight forwarder", 148000, 0, 664000),
      txn("18-Mar-26", "NEFT/Packaging unit", 92600, 0, 571400),
      txn("25-Mar-26", "UPI/Customs duty", 64300, 0, 507100),
    ];
    const f = { name: "HDFC_Statement_Mar2026.pdf", mime: "application/pdf" };
    f.content = buildPdf(bankPages("Kumar Exports Pvt. Ltd.", "50200055667788",
      "01-Mar-2026 to 31-Mar-2026", tx, [[0, 1], [2, 3]]));
    uploadVersion(abcId, clientId, docIds["Bank Statement"], "Bank Statement", 1, f, rohit, ts(8, 14, 10));
    approveDoc(abcId, clientId, docIds["Bank Statement"], 1, aman,
      "Matches the export realisation entries.", ts(7, 12, 0));
    const s = { name: "Sales_Register_Mar.csv", mime: "text/csv" };
    s.content = salesCsv("Kumar Exports Pvt. Ltd.", "27AAKCK5566L1Z3", [
      ["06-Mar-26", "KE-091", "Gulf Textiles LLC", "EXP", "560000", "0", "0", "560000"],
      ["21-Mar-26", "KE-092", "Gulf Textiles LLC", "EXP", "198000", "0", "0", "198000"],
    ]);
    uploadVersion(abcId, clientId, docIds["Sales Register"], "Sales Register", 1, s, rohit, ts(1, 16, 45));
  }

  const xyz = onboardClient("XYZ Retail Pvt. Ltd.", xyzId, priya, neha, 13);
  {
    const { clientId, docIds } = xyz;
    const w1 = [
      txn("02-Mar-26", "UPI/Store collection", 0, 96500, 342100),
      txn("06-Mar-26", "NEFT/Fresh Foods supply", 182300, 0, 159800),
      txn("10-Mar-26", "UPI/Store collection", 0, 110400, 270200),
      txn("14-Mar-26", "IMPS/Staff salaries", 145000, 0, 125200),
    ];
    const w2 = [...w1,
      txn("18-Mar-26", "NEFT/City Distributors", 224600, 0, 125200),
      txn("22-Mar-26", "UPI/Store collection", 0, 132800, 258000),
      txn("27-Mar-26", "NEFT/Rent March", 85000, 0, 173000),
      txn("31-Mar-26", "IMPS/POS settlement", 0, 41200, 214200),
    ];
    const v1 = { name: "HDFC_Statement_Mar2026.pdf", mime: "application/pdf" };
    v1.content = buildPdf(bankPages("XYZ Retail Pvt. Ltd.", "50200011223344",
      "01-Mar-2026 to 31-Mar-2026", w1, [[0, 1], [2, 3]]));
    uploadVersion(xyzId, clientId, docIds["Bank Statement"], "Bank Statement", 1, v1, priya, ts(12, 10, 5));
    requestCorrection(xyzId, clientId, docIds["Bank Statement"], 1, neha,
      "The statement covers only 1-15 March. Please upload the full month.", ts(12, 15, 40));
    const v2 = { name: "HDFC_Statement_Mar2026.pdf", mime: "application/pdf" };
    v2.content = buildPdf(bankPages("XYZ Retail Pvt. Ltd.", "50200011223344",
      "01-Mar-2026 to 31-Mar-2026", w2, [[0, 1], [2, 3], [4, 5, 6, 7]]));
    uploadVersion(xyzId, clientId, docIds["Bank Statement"], "Bank Statement", 2, v2, priya, ts(11, 11, 30));
    approveDoc(xyzId, clientId, docIds["Bank Statement"], 2, neha,
      "Full-month statement verified.", ts(10, 17, 5));

    const s = { name: "Sales_Register_Mar.csv", mime: "text/csv" };
    s.content = salesCsv("XYZ Retail Pvt. Ltd.", "27AAKXR3344M1Z6", [
      ["07-Mar-26", "XR-3001", "Walk-in sales", "URP", "96500", "8670", "8670", "113840"],
      ["15-Mar-26", "XR-3002", "Walk-in sales", "URP", "110400", "9936", "9936", "130272"],
      ["23-Mar-26", "XR-3003", "Corporate order", "27AAKCS8899Q1Z2", "132800", "11952", "11952", "156704"],
    ]);
    uploadVersion(xyzId, clientId, docIds["Sales Register"], "Sales Register", 1, s, priya, ts(9, 12, 5));
    approveDoc(xyzId, clientId, docIds["Sales Register"], 1, neha,
      "POS settlements agree with the register.", ts(8, 16, 20));

    const p = { name: "Purchase_Register_Mar.csv", mime: "text/csv" };
    p.content = purchaseCsv("XYZ Retail Pvt. Ltd.", [
      ["05-Mar-26", "FF-7712", "Fresh Foods Ltd", "182300", "16407", "198707"],
      ["17-Mar-26", "CD-4410", "City Distributors", "224600", "40428", "265028"],
      ["24-Mar-26", "PK-1093", "Packwell Traders", "18400", "3312", "21712"],
      ["29-Mar-26", "PK-1101", "Packwell Traders", "7250", "1305", "8555"],
    ]);
    uploadVersion(xyzId, clientId, docIds["Purchase Register"], "Purchase Register", 1, p, priya, ts(4, 14, 0));
    startReview(xyzId, clientId, docIds["Purchase Register"], "Purchase Register", 1, neha, ts(4, 16, 30));
    requestCorrection(xyzId, clientId, docIds["Purchase Register"], 1, neha,
      "Vendor invoices are missing for two entries (Rs.18,400 and Rs.7,250). Please attach and re-upload.",
      ts(3, 10, 30));

    const g = { name: "GSTR3B_Mar2026.pdf", mime: "application/pdf" };
    g.content = gstrPdf("XYZ Retail Pvt. Ltd.", "27AAKXR3344M1Z6", "March 2026", 339700, 66800, 12400);
    uploadVersion(xyzId, clientId, docIds["GST Return"], "GST Return", 1, g, priya, ts(2, 15, 10));
    startReview(xyzId, clientId, docIds["GST Return"], "GST Return", 1, neha, ts(1, 9, 45));
  }
  db.exec("COMMIT");
};
/**
 * ENTRYPOINT — firms + users, then the narrators, then the report.
 */
const mkUser = (firmId, name, email, role) =>
  ({ id: Number(insertUser.run(firmId, name, email, hashPassword(PASSWORD), role).lastInsertRowid), name, role });

db.exec("BEGIN");
const abcId = insertFirm.run("ABC & Co.").lastInsertRowid;
const xyzId = insertFirm.run("XYZ & Co.").lastInsertRowid;
globalThis.__users = {
  rohit: mkUser(abcId, "Rohit Sharma", "rohit@abc.test", "STAFF"),
  aman: mkUser(abcId, "Aman Verma", "aman@abc.test", "REVIEWER"),
  vikram: mkUser(abcId, "Vikram Singh", "vikram@abc.test", "STAFF"),
  priya: mkUser(xyzId, "Priya Nair", "priya@xyz.test", "STAFF"),
  neha: mkUser(xyzId, "Neha Kulkarni", "neha@xyz.test", "REVIEWER"),
};
db.exec("COMMIT");

seedNarrA();
seedNarrB();

const counts = {
  firms: db.prepare("SELECT COUNT(*) n FROM firms").get().n,
  users: db.prepare("SELECT COUNT(*) n FROM users").get().n,
  clients: db.prepare("SELECT COUNT(*) n FROM clients").get().n,
  documents: db.prepare("SELECT COUNT(*) n FROM documents").get().n,
  versions: db.prepare("SELECT COUNT(*) n FROM document_versions").get().n,
  audit_events: db.prepare("SELECT COUNT(*) n FROM audit_events").get().n,
};
db.close();

console.log("Seed complete:", JSON.stringify(counts));
console.log("Login accounts (password DemoAudit!2026):");
console.log("  rohit@abc.test  (STAFF, ABC & Co.)   | priya@xyz.test (STAFF, XYZ & Co.)");
console.log("  vikram@abc.test (STAFF, ABC & Co.)   | neha@xyz.test  (REVIEWER, XYZ & Co.)");
console.log("  aman@abc.test   (REVIEWER, ABC & Co.)");
console.log("Demo map: Sharma Textiles > Bank Statement replays the brief's review narrative;");
console.log("          XYZ Retail shows every live workflow state in one checklist.");
