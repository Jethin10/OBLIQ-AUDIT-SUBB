import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, can } from "@/lib/auth";
import {
  listClientsForUser,
  listStaffForUser,
  listAttentionForUser,
} from "@/lib/clients";
import { LogoutButton } from "../auth-forms";
import { CreateClientForm } from "./create-client-form";
import { ClientsBrowser } from "./clients-browser";
import { STATUS_LABELS, formatDateTime } from "@/lib/format";

export default async function ClientsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const clients = listClientsForUser(user);
  const isReviewer = can(user, "client:create");
  const staff = listStaffForUser(user);
  const attention = listAttentionForUser(user);

  const approved = clients.reduce((total, client) => total + client.approved, 0);
  const documents = clients.reduce((total, client) => total + client.total, 0);
  const corrections = clients.reduce((total, client) => total + client.corrections, 0);
  const overdue = attention.filter((row) => row.is_overdue === 1).length;

  return (
    <div className="ob-app ob-page-enter">
      <header className="ob-header">
        <Link href="/clients" className="ob-logo">OBLIQ</Link>
        <nav className="ob-header-nav" aria-label="Workspace">
          <Link href="/clients" className="is-active">Clients</Link>
        </nav>
        <div className="ob-header-user">
          <span className="ob-header-who">
            <strong>{user.name}</strong>
            <span>{user.firmName} · {user.role.toLowerCase()}</span>
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="ob-main">
        <div className="ob-pagehead">
          <div>
            <h1>Clients</h1>
            <p className="ob-pagehead-sub">
              Review evidence, request corrections, and keep a record that holds.
            </p>
          </div>
          <dl className="ob-stats">
            <div className="ob-stat">
              <dt>Clients</dt>
              <dd>{clients.length}</dd>
            </div>
            <div className="ob-stat">
              <dt>Documents approved</dt>
              <dd>{approved}<span className="ob-stat-total">/{documents}</span></dd>
            </div>
            <div className={`ob-stat ${corrections > 0 ? "is-warn" : ""}`}>
              <dt>Open corrections</dt>
              <dd>{corrections}</dd>
            </div>
            <div className={`ob-stat ${overdue > 0 ? "is-alert" : ""}`}>
              <dt>Overdue</dt>
              <dd>{overdue}</dd>
            </div>
          </dl>
        </div>

        {attention.length > 0 && (
          <section className="ob-card ob-attention" aria-labelledby="attention-heading">
            <div className="ob-card-head">
              <div>
                <h2 className="ob-card-title" id="attention-heading">Needs attention</h2>
                <p className="ob-card-sub">
                  Open corrections and overdue documents across {user.role === "REVIEWER" ? "your firm" : "your clients"}.
                </p>
              </div>
            </div>
            <ul className="ob-attention-list">
              {attention.map((row) => (
                <li key={row.id}>
                  <Link href={`/clients/${row.client_id}`} className="ob-attention-row">
                    <span className={`ob-dot ${row.is_overdue ? "is-alert" : "is-warn"}`} aria-hidden="true" />
                    <span className="ob-attention-doc">
                      <strong>{row.doc_type}</strong>
                      <span className="ob-attention-client">{row.client_name}</span>
                    </span>
                    <span className="ob-attention-reason">
                      {row.is_overdue === 1
                        ? `Overdue · due ${formatDateTime(row.due_date)}`
                        : "Correction requested"}
                      {row.correction_comment && (
                        <em>{row.correction_comment}</em>
                      )}
                    </span>
                    <span className={`ob-status ${row.status.toLowerCase()}`}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ClientsBrowser clients={clients} />

        {isReviewer && <CreateClientForm staff={staff} />}
      </main>
    </div>
  );
}

