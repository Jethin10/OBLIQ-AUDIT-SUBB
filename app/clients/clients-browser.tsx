"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClientListRow } from "@/lib/clients";

/**
 * Client-side search + filter over the firm's clients. Keeps the list usable
 * as it grows, without a server round-trip per keystroke.
 */
export function ClientsBrowser({ clients }: { clients: ClientListRow[] }) {
  const [term, setTerm] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return clients.filter((client) => {
      if (attentionOnly && client.needs_attention === 0) return false;
      if (!needle) return true;
      return (
        client.name.toLowerCase().includes(needle) ||
        (client.staff_name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [clients, term, attentionOnly]);

  return (
    <section className="ob-card">
      <div className="ob-card-head">
        <div>
          <h2 className="ob-card-title">Engagements</h2>
          <p className="ob-card-sub">
            {visible.length} of {clients.length} clients
          </p>
        </div>
        <div className="ob-toolbar">
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search clients or staff"
            className="ob-input ob-search"
            aria-label="Search clients"
          />
          <button
            type="button"
            onClick={() => setAttentionOnly((value) => !value)}
            className={`ob-chip-toggle ${attentionOnly ? "is-on" : ""}`}
            aria-pressed={attentionOnly}
          >
            Needs attention
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="ob-empty">
          {clients.length === 0
            ? "No clients are assigned to you yet."
            : "No clients match this filter."}
        </p>
      ) : (
        <ul className="ob-client-list">
          {visible.map((client, index) => {
            const progress = client.total > 0
              ? Math.round((client.approved / client.total) * 100)
              : 0;
            return (
              <li key={client.id}>
                <Link
                  href={`/clients/${client.id}`}
                  className="ob-client-row"
                  style={{ "--delay": `${index * 40}ms` } as React.CSSProperties}
                >
                  <div className="ob-client-main">
                    <span className="ob-client-name">{client.name}</span>
                    <span className="ob-client-sub">
                      {client.staff_name ?? "Unassigned"}
                    </span>
                  </div>
                  {client.needs_attention > 0 && (
                    <span className="ob-flag">
                      {client.needs_attention} need{client.needs_attention === 1 ? "s" : ""} attention
                    </span>
                  )}
                  <div className="ob-client-progress">
                    <span className="ob-client-progress-label">
                      {client.approved}/{client.total} approved
                    </span>
                    <span className="ob-progress-line">
                      <i style={{ width: `${progress}%` }} />
                    </span>
                  </div>
                  <span className="ob-row-arrow" aria-hidden="true">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
