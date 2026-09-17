import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const schema = readFileSync(new URL("../lib/schema.sql", import.meta.url), "utf8");

test("documents must belong to the same firm as their client", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(schema);
    db.exec(`
      INSERT INTO firms (id, name) VALUES (1, 'ABC & Co.'), (2, 'XYZ & Co.');
      INSERT INTO clients (id, firm_id, name) VALUES (10, 1, 'ABC Traders'), (20, 2, 'XYZ Traders');
    `);
    const insert = db.prepare("INSERT INTO documents (firm_id, client_id, doc_type) VALUES (?, ?, ?)");
    assert.doesNotThrow(() => insert.run(1, 10, "Bank Statement"));
    assert.throws(() => insert.run(1, 20, "Bank Statement"), /FOREIGN KEY constraint failed/);
    assert.throws(() => insert.run(2, 10, "Bank Statement"), /FOREIGN KEY constraint failed/);
    assert.throws(
      () => db.exec("UPDATE documents SET client_id = 20 WHERE firm_id = 1"),
      /FOREIGN KEY constraint failed/,
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM documents").get().count, 1);
  } finally {
    db.close();
  }
});


test("clients must belong to the same firm as their assigned staff", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(schema);
    db.exec(`
      INSERT INTO firms (id, name) VALUES (1, 'ABC & Co.'), (2, 'XYZ & Co.');
      INSERT INTO users (id, firm_id, name, email, password_hash, role) VALUES
        (100, 1, 'Rohit', 'rohit@abc.test', 'x', 'STAFF'),
        (200, 2, 'Priya', 'priya@xyz.test', 'x', 'STAFF');
    `);
    const insert = db.prepare("INSERT INTO clients (firm_id, name, assigned_staff_id) VALUES (?, ?, ?)");
    assert.doesNotThrow(() => insert.run(1, "ABC Traders", 100));
    assert.throws(() => insert.run(1, "DEF Traders", 200), /FOREIGN KEY constraint failed/);
  } finally {
    db.close();
  }
});


test("audit events must reference documents in the same firm", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(schema);
    db.exec(`
      INSERT INTO firms (id, name) VALUES (1, 'ABC & Co.'), (2, 'XYZ & Co.');
      INSERT INTO clients (id, firm_id, name) VALUES (10, 1, 'ABC Traders');
      INSERT INTO documents (id, firm_id, client_id, doc_type) VALUES (500, 1, 10, 'Bank Statement');
    `);
    const insert = db.prepare(`
      INSERT INTO audit_events (firm_id, actor_name, actor_role, document_id, action)
      VALUES (?, 'Someone', 'REVIEWER', ?, 'DOCUMENT_UPLOADED')
    `);
    assert.doesNotThrow(() => insert.run(1, 500));
    assert.throws(() => insert.run(1, 999), /FOREIGN KEY constraint failed/);
    assert.throws(() => insert.run(2, 500), /FOREIGN KEY constraint failed/);
  } finally {
    db.close();
  }
});

test("fresh file-backed schema preserves audit tenant constraints after reopening", () => {
  const directory = mkdtempSync(join(tmpdir(), "obliq-schema-"));
  const filename = join(directory, "test.db");
  let db;
  try {
    db = new DatabaseSync(filename);
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(schema);
    db.exec(`
      INSERT INTO firms (id, name) VALUES (1, 'ABC & Co.'), (2, 'XYZ & Co.');
      INSERT INTO clients (id, firm_id, name) VALUES (10, 1, 'ABC Traders');
      INSERT INTO documents (id, firm_id, client_id, doc_type) VALUES (500, 1, 10, 'Bank Statement');
    `);
    db.close();
    db = undefined;
    db = new DatabaseSync(filename);
    db.exec("PRAGMA foreign_keys = ON");
    const insert = db.prepare(`
      INSERT INTO audit_events (firm_id, actor_name, actor_role, document_id, action)
      VALUES (?, 'Reviewer', 'REVIEWER', 500, 'REVIEW_STARTED')
    `);
    assert.doesNotThrow(() => insert.run(1));
    assert.throws(() => insert.run(2), /FOREIGN KEY constraint failed/);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit_events").get().count, 1);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

