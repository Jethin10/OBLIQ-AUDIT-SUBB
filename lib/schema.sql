-- OBLIQ Audit — schema
-- Every tenant-owned row carries firm_id so that firm isolation is enforced
-- both by foreign keys (data shape) and by every query's WHERE clause (data access).

CREATE TABLE IF NOT EXISTS firms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('STAFF', 'REVIEWER', 'ADMIN')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (firm_id, id)
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  name TEXT NOT NULL,
  assigned_staff_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (firm_id, assigned_staff_id) REFERENCES users(firm_id, id),
  UNIQUE (firm_id, name),
  UNIQUE (firm_id, id)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  doc_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'CORRECTION_REQUIRED'
  )),
  file_path TEXT,
  file_name TEXT,
  file_mime TEXT,
  file_size INTEGER,
  version INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TEXT,
  review_started_by INTEGER REFERENCES users(id),
  review_started_at TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  assigned_reviewer_id INTEGER REFERENCES users(id),
  correction_comment TEXT,
  -- Optional ISO date (YYYY-MM-DD). NULL means the document has no deadline.
  -- Due dates drive the "needs attention" view; overdue = due_date < today and
  -- the document is not yet approved.
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (firm_id, client_id) REFERENCES clients(firm_id, id),
  UNIQUE (firm_id, id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  actor_id INTEGER REFERENCES users(id),
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  document_id INTEGER REFERENCES documents(id),
  action TEXT NOT NULL,
  version INTEGER,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (firm_id, document_id) REFERENCES documents(firm_id, id),
  FOREIGN KEY (firm_id, actor_id) REFERENCES users(firm_id, id),
  FOREIGN KEY (firm_id, client_id) REFERENCES clients(firm_id, id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Enquiries from the public landing page, written by /api/landing/[kind].
-- They belong to nobody yet, so unlike every table above they carry no
-- firm scope and are never read by the workspace.
CREATE TABLE IF NOT EXISTS landing_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('contact', 'subscribe')),
  name TEXT,
  email TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_versions (
  id INTEGER PRIMARY KEY,
  firm_id INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  version INTEGER NOT NULL CHECK(version > 0),
  file_name TEXT NOT NULL,
  file_mime TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  content BLOB NOT NULL,
  uploaded_by INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(document_id, version),
  FOREIGN KEY(firm_id, document_id) REFERENCES documents(firm_id, id),
  FOREIGN KEY(firm_id, uploaded_by) REFERENCES users(firm_id, id)
);

CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_events
BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_events
BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS versions_no_update BEFORE UPDATE ON document_versions
BEGIN SELECT RAISE(ABORT, 'Document versions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS versions_no_delete BEFORE DELETE ON document_versions
BEGIN SELECT RAISE(ABORT, 'Document versions are immutable'); END;


CREATE INDEX IF NOT EXISTS idx_documents_client ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_firm ON documents(firm_id);
CREATE INDEX IF NOT EXISTS idx_audit_firm ON audit_events(firm_id);
CREATE INDEX IF NOT EXISTS idx_audit_document ON audit_events(document_id);
