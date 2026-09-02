"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { weekdayShort } from "@/lib/dates";
import { weekStartFor, weekdayHeaders } from "@/lib/schedule";

/** Which weekdays she lists on. The calendar rings them; Auto-schedule fills
 *  them. Saved server-side so the auto-scheduler and every device agree. */
export default function PostingDaysEditor({ initial }: { initial: number[] }) {
  const { lang, t } = useT();
  const [days, setDays] = useState<number[]>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function toggle(day: number) {
    const next = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day].sort((a, b) => a - b);
    if (next.length === 0) return; // the server rejects an empty list; mirror it
    setDays(next);
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/settings/posting-days", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postingDays: next }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `${t("save_failed_generic")} (${res.status})`);
      }
      setState("saved");
    } catch (err) {
      setDays(days);
      setState("error");
      setError(err instanceof Error ? err.message : t("save_failed_generic"));
    }
  }

  return (
    <section className="settings-block">
      <h2>{t("posting_days")}</h2>
      <p className="hint">{t("posting_days_hint")}</p>
      <div className="day-toggles" role="group" aria-label={t("posting_days")}>
        {weekdayHeaders(weekStartFor(lang)).map((day) => {
          const on = days.includes(day);
          return (
            <button
              key={day}
              type="button"
              className={on ? "day-toggle on" : "day-toggle"}
              aria-pressed={on}
              disabled={state === "saving"}
              onClick={() => toggle(day)}
            >
              {weekdayShort(day, lang)}
            </button>
          );
        })}
      </div>
      {state === "saved" && <p className="meta saved-note">{t("saved")}</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  );
}
