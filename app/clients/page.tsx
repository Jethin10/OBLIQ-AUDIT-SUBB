import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, can } from "@/lib/auth";
import { listClientsForUser, listStaffForUser } from "@/lib/clients";
import { LogoutButton } from "../auth-forms";
import { CreateClientForm } from "./create-client-form";
import { STATUS_LABELS } from "@/lib/format";

export default async function ClientsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const clients = listClientsForUser(user);
  const isReviewer = can(user, "client:create");
  const staff = listStaffForUser(user);
  const approved = clients.reduce((total, client) => total + client.approved, 0);
  const documents = clients.reduce((total, client) => total + client.total, 0);

  return (
    <div className="ob-app ob-page-enter">
      <header className="ob-header">
        <Link href="/clients" className="ob-logo">OBLIQ</Link>
        <span className="ob-header-path">Clients / Audit workspace</span>
        <div className="ob-header-user">
          <span>{user.name} / {user.role.toLowerCase()}</span>
          <LogoutButton />
        </div>
      </header>

      <main className="ob-main">
        <section className="ob-hero">
          <div className="ob-hero-meta ob-reveal">
            <p>{user.firmName}<br />Document review register</p>
            <p>{clients.length} client{clients.length === 1 ? "" : "s"}<br />{approved} of {documents} documents approved</p>
          </div>
          <div className="ob-hero-copy ob-reveal" style={{ "--delay": "90ms" } as React.CSSProperties}>
            <h1>Clients</h1>
            <p>Audit work, stripped back to evidence, review, correction, and a record that holds.</p>
          </div>
        </section>

        <section>
          <div className="ob-section-heading">
            <h2>Active engagements</h2>
            <p>Select a client to review its required documents and complete audit history.</p>
          </div>

          <div className="ob-client-list">
            {clients.length === 0 && (
              <p className="ob-empty">No clients are assigned to you yet.</p>
            )}
            {clients.map((client, index) => {
              const progress = client.total > 0
                ? Math.round((client.approved / client.total) * 100)
                : 0;
              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="ob-client-row ob-reveal"
                  style={{ "--delay": `${120 + index * 65}ms` } as React.CSSProperties}
                >
                  <span className="ob-client-index">{String(index + 1).padStart(2, "0")}</span>
                  <h2 className="ob-client-name">{client.name}</h2>
                  <div className="ob-client-staff">
                    <span>Assigned staff</span>
                    {client.staff_name ?? "Unassigned"}
                  </div>
                  <div className="ob-client-progress">
                    <span>Approval</span>
                    {client.approved}/{client.total}
                    <div className="ob-progress-line"><i style={{ width: `${progress}%` }} /></div>
                  </div>
                  <span className="ob-row-arrow" aria-hidden="true">+</span>
                </Link>
              );
            })}
          </div>
        </section>

        {isReviewer && <CreateClientForm staff={staff} />}
        <p className="ob-status-legend">
          Workflow: {Object.values(STATUS_LABELS).join(" / ")}
        </p>
      </main>
    </div>
  );
}
