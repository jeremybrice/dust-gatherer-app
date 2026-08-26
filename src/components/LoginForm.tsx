"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";

export default function LoginForm({ next }: { next: string }) {
  const { t } = useT();
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
        setError(t("login_rate_limited", { "1": mins }));
      } else if (res.status === 500) {
        setError(t("login_unconfigured"));
      } else {
        setError(t("login_wrong"));
      }
    } catch {
      setError(t("login_offline"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <h1>{t("app_name")}</h1>
      <p className="tagline">{t("login_tagline")}</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="passphrase">{t("passphrase")}</label>
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
          {busy ? t("signing_in") : t("sign_in")}
        </button>
      </form>
    </main>
  );
}
