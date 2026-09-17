import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "../auth-forms";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/clients");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <LoginForm />
    </main>
  );
}
