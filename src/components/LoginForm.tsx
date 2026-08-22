"use client";

import { useState } from "react";

export default function LoginForm({ next }: { next: string }) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (res.ok) {
        // A full navigation, not a client-side push: the session cookie was
        // just set and the destination is server-rendered behind the gate.
        window.location.assign(next);
        return;
      }
      if (res.status === 429) {
        const retry = Number(res.headers.get("Retry-After") ?? 0);
        const mins = Math.ceil(retry / 60);
        setError(`Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
      } else if (res.status === 500) {
        setError("The server is not configured yet.");
      } else {
        setError("That passphrase is not right.");
      }
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <h1>Dust Gatherer</h1>
      <p className="tagline">Enter your passphrase to continue.</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="passphrase">Passphrase</label>
        <input
          id="passphrase"
          name="passphrase"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          required
        />
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={busy || !passphrase}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
