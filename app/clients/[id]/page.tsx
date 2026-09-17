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
import { ClientWorkspace, type UiDocument, type UiEvent } from "../workspace";

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

    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
        <header className="flex items-center justify-between">
          <div>
            <Link
              href="/clients"
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              ← All clients
            </Link>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
              {user.firmName}
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">{client.name}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Assigned staff: {client.staff_name ?? "—"}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {user.name} · {user.role}
            </span>
            <LogoutButton />
          </div>
        </header>

        <div className="mt-8">
          <ClientWorkspace
            clientId={client.id}
            clientName={client.name}
            documents={documents}
            events={events as UiEvent[]}
            role={user.role}
          />
        </div>
      </main>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
