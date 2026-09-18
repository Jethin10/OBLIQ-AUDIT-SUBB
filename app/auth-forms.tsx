"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const DEMO_ACCOUNTS = [
  { email: "rohit@abc.test", label: "Rohit — Staff, ABC & Co." },
  { email: "aman@abc.test", label: "Aman — Reviewer, ABC & Co." },
  { email: "vikram@abc.test", label: "Vikram — Staff, ABC & Co." },
  { email: "priya@xyz.test", label: "Priya — Staff, XYZ & Co." },
  { email: "neha@xyz.test", label: "Neha — Reviewer, XYZ & Co." },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Login failed");
        return;
      }
      router.push("/clients");
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ob-login-form ob-reveal">
      <h1>Enter the review room.</h1>
      <p>Sign in as staff or reviewer to continue the document trail.</p>

      <form onSubmit={submit} className="ob-form-stack">
        <div className="ob-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ob-input"
            placeholder="you@firm.test"
          />
        </div>
        <div className="ob-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="ob-input"
          />
        </div>
        {error && (
          <p className="ob-error">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="ob-primary-button wide"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="ob-demo">
        <p>Demo accounts. Password: DemoAudit!2026</p>
        <div className="ob-demo-grid">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword("DemoAudit!2026");
              }}
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="ob-text-button"
    >
      Sign out
    </button>
  );
}
