import { redirect } from "next/navigation";
import Image from "next/image";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "../auth-forms";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/clients");

  return (
    <main className="ob-login ob-page-enter">
      <section className="ob-login-stage" aria-label="Audit document review">
        <Image
          className="ob-login-image"
          src="/images/audit-desk.png"
          alt="Audit documents arranged for review"
          fill
          priority
          sizes="(max-width: 960px) 100vw, 72vw"
        />
        <div className="ob-login-kicker">
          <span>Audit evidence workspace</span>
          <span>India / 2026</span>
        </div>
        <p className="ob-login-manifesto">
          Every document. Every decision. One traceable record.
        </p>
        <div className="ob-login-wordmark" aria-hidden="true">OBLIQ</div>
      </section>
      <section className="ob-login-panel">
        <div className="ob-mini-brand">
          <strong>OBLIQ</strong>
          <span>Document review</span>
        </div>
        <LoginForm />
        <div className="ob-login-foot">
          <span>Built for CA firms</span>
          <span>Audit actions stay traceable</span>
        </div>
      </section>
    </main>
  );
}
