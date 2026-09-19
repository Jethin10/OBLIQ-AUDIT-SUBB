import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import {
  getClientForUser,
  listDocumentsForClient,
  listRecentEventsForClient,
} from "@/lib/clients";
import { LogoutButton } from "../../auth-forms";
import { ClientWorkspace, type UiEvent } from "../workspace";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) notFound();

  try {
    const client = getClientForUser(clientId, user);
    const documents = listDocumentsForClient(clientId, user.firmId);
    const events = listRecentEventsForClient(clientId, user.firmId);
    const approved = documents.filter((document) => document.status === "APPROVED").length;
    const corrections = documents.filter((document) => document.status === "CORRECTION_REQUIRED").length;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = documents.filter(
      (document) => document.status !== "APPROVED" && document.due_date && document.due_date < today
    ).length;

    return (
      <div className="ob-app ob-page-enter">
        <header className="ob-header">
          <Link href="/clients" className="ob-logo">OBLIQ</Link>
          <nav className="ob-header-nav" aria-label="Workspace">
            <Link href="/clients">Clients</Link>
            <span className="ob-header-crumb" aria-current="page">/ {client.name}</span>
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
              <h1>{client.name}</h1>
              <p className="ob-pagehead-sub">
                Assigned to {client.staff_name ?? "Unassigned"} · required evidence, decisions, and every action on record.
              </p>
            </div>
            <dl className="ob-stats">
              <div className="ob-stat">
                <dt>Approved</dt>
                <dd>{approved}<span className="ob-stat-total">/{documents.length}</span></dd>
              </div>
              <div className={`ob-stat ${corrections > 0 ? "is-warn" : ""}`}>
                <dt>Corrections</dt>
                <dd>{corrections}</dd>
              </div>
              <div className={`ob-stat ${overdue > 0 ? "is-alert" : ""}`}>
                <dt>Overdue</dt>
                <dd>{overdue}</dd>
              </div>
            </dl>
          </div>

          <ClientWorkspace
            clientId={client.id}
            clientName={client.name}
            documents={documents}
            events={events as UiEvent[]}
            role={user.role}
          />
        </main>
      </div>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
