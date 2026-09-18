"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateClientForm({ staff }: { staff: { id: number; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [staffId, setStaffId] = useState<string>(staff[0] ? String(staff[0].id) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !staffId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, assignedStaffId: Number(staffId) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Could not create client (${res.status})`);
        return;
      }
      const body = await res.json();
      setName("");
      router.push(`/clients/${body.id}`);
      router.refresh();
    } catch {
      setError("Network error — could not create client");
    } finally {
      setBusy(false);
    }
  }

  if (staff.length === 0) {
    return (
      <p className="ob-error">
        Add a STAFF user to your firm before creating clients.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="ob-create-panel"
    >
      <div>
        <h2>New<br />client</h2>
        <p className="ob-create-copy">Create an engagement with the standard five-document audit checklist.</p>
      </div>
      <div className="ob-create-form">
        {error && <p className="ob-error">{error}</p>}
        <div className="ob-create-controls">
          <div className="ob-field">
            <label htmlFor="new-client-name">Client name</label>
            <input
              id="new-client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example Industries Pvt. Ltd."
              className="ob-input"
            />
          </div>
          <div className="ob-field">
            <label htmlFor="new-client-staff">Assigned staff</label>
            <select
              id="new-client-staff"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="ob-select"
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy || !name.trim() || !staffId}
            className="ob-primary-button"
          >
            {busy ? "Creating..." : "Create client"}
          </button>
        </div>
      </div>
    </form>
  );
}
