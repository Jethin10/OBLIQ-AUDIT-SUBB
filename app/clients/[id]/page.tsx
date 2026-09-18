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

    return (
      <div className="ob-app ob-page-enter">
        <header className="ob-header">
          <Link href="/clients" className="ob-logo">OBLIQ</Link>
          <span className="ob-header-path">Clients / {client.name}</span>
          <div className="ob-header-user">
            <span>{user.name} / {user.role.toLowerCase()}</span>
            <LogoutButton />
          </div>
        </header>

        <main className="ob-main">
          <section className="ob-hero">
            <div className="ob-hero-meta ob-reveal">
              <p><Link href="/clients">Back to clients</Link><br />{user.firmName}</p>
              <p>Assigned to {client.staff_name ?? "Unassigned"}<br />{approved}/{documents.length} approved / {corrections} corrections</p>
            </div>
            <div className="ob-hero-copy ob-reveal" style={{ "--delay": "90ms" } as React.CSSProperties}>
              <h1 className="long">{client.name}</h1>
              <p>Required evidence, review decisions, and every material action in one record.</p>
            </div>
          </section>

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
