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
}

export interface UiEvent {
  id: number;
  actor_name: string;
  actor_role: string;
  action: string;
  version: number | null;
  detail: string | null;
  created_at: string;
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
  const [comment, setComment] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const router = useRouter();

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
      flash(`Uploaded '${file.name}' — awaiting review.`);
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
      flash(
        action === "APPROVE" ? "Document approved." : action === "START_REVIEW" ? "Review started." : "Correction requested."
      );
      await refresh();
    } catch {
      setError("Network error during review");
    } finally {
      setBusy(false);
    }
  }

  async function addDocument() {
    const name = newDocName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not add document");
      return;
    }
    setNewDocName("");
    flash("Required document added.");
    await refresh();
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
          {notice}
        </p>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
          {role === "REVIEWER" && (
            <div className="flex gap-2">
              <input
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="New required document…"
                className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={busy || !newDocName.trim()}
                onClick={addDocument}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((doc) => (
                <tr key={doc.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{doc.doc_type}</p>
                    {doc.status === "CORRECTION_REQUIRED" && doc.correction_comment && (
                      <p className="mt-1 max-w-md rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                        {doc.correction_comment}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_BADGE[doc.status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                      {STATUS_LABELS[doc.status] ?? doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">v{doc.version}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {doc.uploader_name ?? "—"}
                    {doc.uploaded_at && <><br />{formatDateTime(doc.uploaded_at)}</>}
                  </td>
                  <td className="px-4 py-3">
                    <DocActions
                      doc={doc}
                      role={role}
                      busy={busy}
                      comment={comment}
                      setComment={setComment}
                      onUpload={upload}
                      onReview={review}
                      openId={openId}
                      setOpenId={setOpenId}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Timeline events={events} />
    </div>
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
}: {
  doc: UiDocument;
  role: "STAFF" | "REVIEWER";
  busy: boolean;
  comment: string;
  setComment: (value: string) => void;
  onUpload: (doc: UiDocument, file: File) => void;
  onReview: (doc: UiDocument, action: string) => void;
  openId: number | null;
  setOpenId: (id: number | null) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {role === "STAFF" && ["PENDING", "CORRECTION_REQUIRED"].includes(doc.status) && (
          <label className={`cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 ${busy ? "pointer-events-none opacity-50" : ""}`}>
            {doc.status === "CORRECTION_REQUIRED" ? "Re-upload" : "Upload"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(doc, file);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {doc.version > 0 && (
          <button
            type="button"
            onClick={() => setOpenId(openId === doc.id ? null : doc.id)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {openId === doc.id ? "Close" : "History"}
          </button>
        )}
      </div>

      {role === "REVIEWER" && ["UPLOADED", "UNDER_REVIEW"].includes(doc.status) && (
        <div className="mt-2">
          {doc.status === "UPLOADED" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onReview(doc, "START_REVIEW")}
              className="mb-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              Start review
            </button>
          )}
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Review comment (required for correction)…"
            className="mb-2 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onReview(doc, "APPROVE")}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy || !comment.trim()}
              onClick={() => onReview(doc, "REQUEST_CORRECTION")}
              title="A correction reason is required"
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Request correction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Timeline({ events }: { events: UiEvent[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
      <ol className="mt-3 space-y-3">
        {events.length === 0 && (
          <li className="text-sm text-slate-500">No activity yet.</li>
        )}
        {events.map((event) => (
          <li
            key={event.id}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
          >
            <span className="text-lg" aria-hidden>
              {ACTION_ICONS[event.action] ?? "•"}
            </span>
            <div className="flex-1">
              <p className="text-sm text-slate-800">
                <span className="font-medium">{event.actor_name}</span>{" "}
                <span className="text-slate-500">({event.actor_role.toLowerCase()})</span>{" "}
                {ACTION_LABELS[event.action] ?? event.action}
                {event.version !== null && (
                  <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    v{event.version}
                  </span>
                )}
              </p>
              {event.detail && (
                <p className="mt-0.5 text-sm text-slate-500">{event.detail}</p>
              )}
            </div>
            <time className="whitespace-nowrap text-xs text-slate-400">
              {formatDateTime(event.created_at)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}

const ACTION_ICONS: Record<string, string> = {
  CLIENT_CREATED: "🏢",
  DOCUMENT_REQUIRED: "📋",
  DOCUMENT_UPLOADED: "📤",
  REVIEW_STARTED: "👀",
  DOCUMENT_APPROVED: "✅",
  CORRECTION_REQUESTED: "✏️",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600 ring-slate-200",
  UPLOADED: "bg-blue-50 text-blue-700 ring-blue-200",
  UNDER_REVIEW: "bg-amber-50 text-amber-700 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CORRECTION_REQUIRED: "bg-red-50 text-red-700 ring-red-200",
};
