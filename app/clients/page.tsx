import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listClientsForUser } from "@/lib/clients";
import { can } from "@/lib/auth";
import { LogoutButton } from "../auth-forms";
import Link from "next/link";
import { STATUS_LABELS } from "@/lib/format";

export default async function ClientsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const clients = listClientsForUser(user);
  const isReviewer = can(user, "client:create");

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
            {user.firmName}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">
            {user.name} · {user.role}
          </span>
          <LogoutButton />
        </div>
      </header>

      <div className="mt-8 space-y-3">
        {clients.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No clients assigned to you yet.
          </p>
        )}
        {clients.map((client) => {
          const progress =
            client.total > 0 ? Math.round((client.approved / client.total) * 100) : 0;
          return (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">{client.name}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Assigned staff: {client.staff_name ?? "—"}
                  </p>
                </div>
                {client.corrections > 0 && (
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
                    {client.corrections} correction
                    {client.corrections > 1 ? "s" : ""} needed
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">
                  {client.approved}/{client.total} approved
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {isReviewer && (
        <p className="mt-6 rounded-lg bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
          Reviewers can add new clients and required documents from the client
          workspace after opening it.
        </p>
      )}
      <p className="mt-4 text-xs text-slate-400">
        Statuses: {Object.values(STATUS_LABELS).join(" → ")}
      </p>
    </main>
  );
}
