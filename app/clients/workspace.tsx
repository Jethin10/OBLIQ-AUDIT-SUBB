"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ACTION_LABELS, STATUS_LABELS, formatDateTime } from "@/lib/format";

export interface UiDocument {
  id: number;
  doc_type: string;
  status: string;
  version: number;
  uploaded_at: string | null;
  uploader_name: string | null;
  correction_comment: string | null;
  file_name: string | null;
  due_date: string | null;
}

export interface UiVersion {
  version: number;
  file_name: string;
  file_size: number;
  uploaded_at: string;
  uploader_name: string;
}

export interface UiDocEvent {
  id: number;
  actor_name: string;
  actor_role: string;
  action: string;
  version: number | null;
  detail: string | null;
  created_at: string;
}

export interface UiEvent extends UiDocEvent {
  document_id: number | null;
}

interface Props {
  clientId: number;
  clientName: string;
  documents: UiDocument[];
  events: UiEvent[];
  role: "STAFF" | "REVIEWER";
}

export function ClientWorkspace({
  clientId,
  clientName,
  documents: initialDocs,
  events: initialEvents,
  role,
}: Props) {
  const [docs, setDocs] = useState(initialDocs);
  const [events, setEvents] = useState(initialEvents);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [histories, setHistories] = useState<Record<number, { versions: UiVersion[]; events: UiDocEvent[] }>>({});
  const [historyLoading, setHistoryLoading] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const router = useRouter();

  const visibleDocs = statusFilter === "ALL"
    ? docs
    : docs.filter((doc) => doc.status === statusFilter);
  const statusCounts = docs.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.status] = (acc[doc.status] ?? 0) + 1;
    return acc;
  }, {});

  async function toggleHistory(docId: number | null) {
    if (docId === null || openId === docId) {
      setOpenId(null);
      return;
    }
    setOpenId(docId);
    if (histories[docId]) return;
    setHistoryLoading(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`);
      if (res.ok) {
        const body = await res.json();
        setHistories((previous) => ({
          ...previous,
          [docId]: { versions: body.versions ?? [], events: body.events ?? [] },
        }));
      }
    } finally {
      setHistoryLoading((current) => current === docId ? null : current);
    }
  }

  function flash(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  }

  async function refresh() {
    const res = await fetch(`/api/clients/${clientId}`);
    if (res.ok) {
      const body = await res.json();
      setDocs(body.documents);
      setEvents(body.events);
    }
    router.refresh();
  }

  async function upload(doc: UiDocument, file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("version", String(doc.version));
      const res = await fetch(`/api/documents/${doc.id}/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Upload failed (${res.status})`);
        return;
      }
      flash(`Uploaded '${file.name}'. It is ready for review.`);
      await refresh();
    } catch {
      setError("Network error during upload");
    } finally {
      setBusy(false);
    }
  }

  async function review(doc: UiDocument, action: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, version: doc.version, comment: comment || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Action failed (${res.status})`);
        return;
      }
      setComment("");
      setHistories((previous) => {
        const next = { ...previous };
        delete next[doc.id];
        return next;
      });
      flash(action === "APPROVE" ? "Document approved." : action === "START_REVIEW" ? "Review started." : "Correction requested.");
      await refresh();
    } catch {
      setError("Network error during review");
    } finally {
      setBusy(false);
    }
  }

  async function setDueDate(doc: UiDocument, value: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/due-date`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dueDate: value || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Could not set due date (${res.status})`);
        return;
      }
      flash(value ? `Due date set to ${value}.` : "Due date cleared.");
      await refresh();
    } catch {
      setError("Network error while setting the due date");
    } finally {
      setBusy(false);
    }
  }

  async function addDocument() {
    const name = newDocName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not add document");
        return;
      }
      setNewDocName("");
      flash("Required document added.");
      await refresh();
    } catch {
      setError("Network error while adding the document");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p className="ob-error">{error}</p>}
      {notice && <p className="ob-notice">{notice}</p>}

      <section aria-labelledby="documents-heading">
        <div className="ob-workspace-summary">
          <h2 id="documents-heading">Required documents / {clientName}</h2>
          <div className="ob-filter-bar" role="tablist" aria-label="Filter by status">
            {["ALL", "PENDING", "UPLOADED", "UNDER_REVIEW", "CORRECTION_REQUIRED", "APPROVED"].map((status) => {
              const count = status === "ALL" ? docs.length : (statusCounts[status] ?? 0);
              if (status !== "ALL" && count === 0) return null;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`ob-filter-chip ${statusFilter === status ? "is-on" : ""}`}
                  aria-pressed={statusFilter === status}
                >
                  {status === "ALL" ? "All" : (STATUS_LABELS[status] ?? status)}
                  <span className="ob-filter-count">{count}</span>
                </button>
              );
            })}
          </div>
          {role === "REVIEWER" && (
            <div className="ob-add-document">
              <input
                value={newDocName}
                onChange={(event) => setNewDocName(event.target.value)}
                placeholder="Add a required document"
                className="ob-input"
                aria-label="New required document"
              />
              <button
                type="button"
                disabled={busy || !newDocName.trim()}
                onClick={addDocument}
                className="ob-primary-button"
              >
                Add requirement
              </button>
            </div>
          )}
        </div>

        <div className="ob-document-wrap">
          <table className="ob-document-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Status</th>
                <th>Due</th>
                <th>Last upload</th>
                <th>Review controls</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocs.length === 0 && (
                <tr>
                  <td colSpan={5} className="ob-empty">No documents in this state.</td>
                </tr>
              )}
              {visibleDocs.map((doc, index) => (
                <tr key={doc.id} className="ob-reveal" style={{ "--delay": `${index * 55}ms` } as React.CSSProperties}>
                  <td>
                    <p className="ob-doc-name">{doc.doc_type}</p>
                    {doc.file_name && <p className="ob-doc-file" title={doc.file_name}>File / {doc.file_name}</p>}
                    {doc.status === "CORRECTION_REQUIRED" && doc.correction_comment && (
                      <p className="ob-correction">{doc.correction_comment}</p>
                    )}
                  </td>
                  <td>
                    <span className={`ob-status ${doc.status.toLowerCase()}`}>
                      {STATUS_LABELS[doc.status] ?? doc.status}
                    </span>
                  </td>
                  <td className="ob-doc-meta">
                    <DueCell
                      doc={doc}
                      canEdit={role === "REVIEWER"}
                      busy={busy}
                      onSet={setDueDate}
                    />
                  </td>
                  <td className="ob-doc-meta">
                    {doc.uploader_name ?? "No upload"}
                    {doc.uploaded_at && <><br />{formatDateTime(doc.uploaded_at)}</>}
                    <span className="ob-version-tag">v{doc.version}</span>
                  </td>
                  <td>
                    <DocActions
                      doc={doc}
                      role={role}
                      busy={busy}
                      comment={comment}
                      setComment={setComment}
                      onUpload={upload}
                      onReview={review}
                      openId={openId}
                      setOpenId={toggleHistory}
                      history={histories[doc.id] ?? null}
                      historyLoading={historyLoading === doc.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Timeline events={events} clientId={clientId} />
    </div>
  );
}

function DueCell({
  doc,
  canEdit,
  busy,
  onSet,
}: {
  doc: UiDocument;
  canEdit: boolean;
  busy: boolean;
  onSet: (doc: UiDocument, value: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = doc.status !== "APPROVED" && doc.due_date !== null && doc.due_date < today;

  if (canEdit) {
    return (
      <label className={`ob-due ${overdue ? "is-overdue" : ""}`}>
        <input
          type="date"
          className="ob-due-input"
          defaultValue={doc.due_date ?? ""}
          disabled={busy}
          onChange={(event) => onSet(doc, event.target.value)}
          aria-label={`Due date for ${doc.doc_type}`}
        />
        {overdue && <span className="ob-due-flag">Overdue</span>}
      </label>
    );
  }
  if (!doc.due_date) return <span className="ob-due-none">—</span>;
  return (
    <span className={`ob-due-text ${overdue ? "is-overdue" : ""}`}>
      {doc.due_date}
      {overdue && <span className="ob-due-flag">Overdue</span>}
    </span>
  );
}

function DocActions({
  doc,
  role,
  busy,
  comment,
  setComment,
  onUpload,
  onReview,
  openId,
  setOpenId,
  history,
  historyLoading,
}: {
  doc: UiDocument;
  role: "STAFF" | "REVIEWER";
  busy: boolean;
  comment: string;
  setComment: (value: string) => void;
  onUpload: (doc: UiDocument, file: File) => void;
  onReview: (doc: UiDocument, action: string) => void;
  openId: number | null;
  setOpenId: (docId: number | null) => void;
  history: { versions: UiVersion[]; events: UiDocEvent[] } | null;
  historyLoading: boolean;
}) {
  const open = openId === doc.id;

  return (
    <div className="ob-action-stack">
      <div className="ob-action-row">
        {role === "STAFF" && ["PENDING", "CORRECTION_REQUIRED"].includes(doc.status) && (
          <label className="ob-file-button">
            {doc.status === "CORRECTION_REQUIRED" ? "Upload revision" : "Upload file"}
            <input
              type="file"
              hidden
              disabled={busy}
              accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(doc, file);
                event.target.value = "";
              }}
            />
          </label>
        )}
        {doc.version > 0 && (
          <a
            href={`/api/documents/${doc.id}/file?version=${doc.version}`}
            className="ob-file-button"
            title={doc.file_name ? `Open '${doc.file_name}'` : "Open latest uploaded file"}
          >
            Open file
          </a>
        )}
        {doc.version > 0 && (
          <button type="button" onClick={() => setOpenId(open ? null : doc.id)} className="ob-text-button">
            {open ? "Close history" : "History"}
          </button>
        )}
      </div>

      {role === "REVIEWER" && ["UPLOADED", "UNDER_REVIEW"].includes(doc.status) && (
        <div className="ob-review-box">
          {doc.status === "UPLOADED" && (
            <button type="button" disabled={busy} onClick={() => onReview(doc, "START_REVIEW")} className="ob-primary-button">
              Start review
            </button>
          )}
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Review note. Required for correction."
            className="ob-input"
            aria-label={`Review note for ${doc.doc_type}`}
          />
          <div className="ob-review-actions">
            <button type="button" disabled={busy} onClick={() => onReview(doc, "APPROVE")} className="ob-primary-button ob-approve">
              Approve
            </button>
            <button
              type="button"
              disabled={busy || !comment.trim()}
              onClick={() => onReview(doc, "REQUEST_CORRECTION")}
              className="ob-primary-button ob-correct"
            >
              Request correction
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="ob-history">
          {historyLoading ? (
            <p>Loading version history...</p>
          ) : !history ? (
            <p>History could not be loaded.</p>
          ) : (
            <>
              <p className="ob-history-title">{history.versions.length} version{history.versions.length === 1 ? "" : "s"}</p>
              <ul className="ob-history-list">
                {history.versions.map((version) => (
                  <li key={version.version}>
                    <strong>v{version.version}</strong>
                    <span>
                      <a href={`/api/documents/${doc.id}/file?version=${version.version}`}>{version.file_name}</a>
                      <span className="ob-history-sub">{(version.file_size / 1024).toFixed(1)} KB / {version.uploader_name} / {formatDateTime(version.uploaded_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {history.events.length > 0 && (
                <ol className="ob-history-events">
                  {history.events.map((event) => (
                    <li key={event.id}>
                      <span>{event.version === null ? "-" : `v${event.version}`}</span>
                      <span>
                        <strong>{event.actor_name}</strong> / {ACTION_LABELS[event.action] ?? event.action}
                        {event.detail && <span className="ob-history-sub">{event.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Timeline({ events, clientId }: { events: UiEvent[]; clientId: number }) {
  return (
    <section className="ob-activity">
      <div className="ob-activity-head ob-activity-head--row">
        <div>
          <h2>Audit history</h2>
          <p>Every material action, in order.</p>
        </div>
        <a
          href={`/api/clients/${clientId}/export`}
          className="ob-outline-button ob-export"
          download
        >
          Export trail (CSV)
        </a>
      </div>
      <ol className="ob-timeline">
        {events.length === 0 && <li><span /><span>No activity yet.</span></li>}
        {events.map((event, index) => (
          <li key={event.id}>
            <span className="ob-event-index">{String(events.length - index).padStart(2, "0")}</span>
            <span>
              <span className="ob-event-name">{event.actor_name}</span><br />
              <span className="ob-event-role">{event.actor_role.toLowerCase()}</span>
            </span>
            <span className="ob-event-action">
              {ACTION_LABELS[event.action] ?? event.action}
              {event.version !== null && ` / v${event.version}`}
              {event.detail && <span className="ob-event-detail">{event.detail}</span>}
            </span>
            <time className="ob-event-time">{formatDateTime(event.created_at)}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}
