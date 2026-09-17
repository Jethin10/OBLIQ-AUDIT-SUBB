/**
 * Seeds two firms (ABC & Co., XYZ & Co.), one staff + one reviewer each,
 * a client per firm with the default 5-document checklist, and a couple of
 * context audit events. Idempotent: wipes and recreates the runtime data.
 *
 * Demo passwords are intentionally public — this is an evaluation prototype.
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
db.exec("PRAGMA foreign_keys=ON;");
db.exec(fs.readFileSync(path.join(root, "lib", "schema.sql"), "utf8"));

// Wipe rows in foreign-key-safe order instead of deleting the file, so this
// is safe to run while the dev server holds the database open.
db.exec(`
  DELETE FROM audit_events;
  DELETE FROM document_versions;
  DELETE FROM sessions;
  DELETE FROM documents;
  DELETE FROM clients;
  DELETE FROM sessions;
  DELETE FROM users;
  DELETE FROM firms;
  DELETE FROM sqlite_sequence;
`);

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$N=16384,r=8,p=1$${salt}$${hash.toString("hex")}`;
}

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
const insertEvent = db.prepare(
  `INSERT INTO audit_events
     (firm_id, actor_id, actor_name, actor_role, client_id, document_id, action, version, detail)
   VALUES (?, NULL, 'System', 'SYSTEM', ?, NULL, ?, NULL, ?)`
);

const DOC_TYPES = [
  "Bank Statement",
  "Sales Register",
  "Purchase Register",
  "GST Return",
  "Expense Summary",
];

const seed = () => {
  db.exec("BEGIN");
  const abcId = insertFirm.run("ABC & Co.").lastInsertRowid;
  const xyzId = insertFirm.run("XYZ & Co.").lastInsertRowid;

  const rohit = insertUser.run(abcId, "Rohit Sharma", "rohit@abc.test", hashPassword(PASSWORD), "STAFF").lastInsertRowid;
  insertUser.run(abcId, "Aman Verma", "aman@abc.test", hashPassword(PASSWORD), "REVIEWER");
  const priya = insertUser.run(xyzId, "Priya Nair", "priya@xyz.test", hashPassword(PASSWORD), "STAFF").lastInsertRowid;
  insertUser.run(xyzId, "Neha Kulkarni", "neha@xyz.test", hashPassword(PASSWORD), "REVIEWER");

  const abcClient = insertClient.run(abcId, "ABC Traders Pvt. Ltd.", rohit).lastInsertRowid;
  const xyzClient = insertClient.run(xyzId, "XYZ Retail Pvt. Ltd.", priya).lastInsertRowid;

  for (const docType of DOC_TYPES) {
    insertDoc.run(abcId, abcClient, docType);
    insertDoc.run(xyzId, xyzClient, docType);
  }

  insertEvent.run(abcId, abcClient, "CLIENT_CREATED", "Client onboarded with 5-document checklist (seed data)");
  insertEvent.run(xyzId, xyzClient, "CLIENT_CREATED", "Client onboarded with 5-document checklist (seed data)");
  db.exec("COMMIT");
};

seed();

const counts = {
  firms: db.prepare("SELECT COUNT(*) n FROM firms").get().n,
  users: db.prepare("SELECT COUNT(*) n FROM users").get().n,
  clients: db.prepare("SELECT COUNT(*) n FROM clients").get().n,
  documents: db.prepare("SELECT COUNT(*) n FROM documents").get().n,
  audit_events: db.prepare("SELECT COUNT(*) n FROM audit_events").get().n,
};
db.close();

console.log("Seed complete:", JSON.stringify(counts));
console.log("Login accounts (password DemoAudit!2026):");
console.log("  rohit@abc.test (STAFF, ABC & Co.)   | priya@xyz.test (STAFF, XYZ & Co.)");
console.log("  aman@abc.test  (REVIEWER, ABC & Co.)| neha@xyz.test (REVIEWER, XYZ & Co.)");
