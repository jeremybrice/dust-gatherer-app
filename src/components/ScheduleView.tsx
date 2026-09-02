"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18nProvider";
import {
  localToday,
  longDate,
  monthYearLabel,
  shortDate,
  weekdayShort,
} from "@/lib/dates";
import type { InventoryItemView } from "@/lib/items";
import { formatMoney } from "@/lib/money";
import {
  autoSchedulePlan,
  groupByScheduledDate,
  isoWeekday,
  monthGrid,
  nextPostingDays,
  parseDay,
  parseMonth,
  shiftMonth,
  unscheduledItems,
  weekStartFor,
  weekdayHeaders,
} from "@/lib/schedule";

const STATUS_KEYS = {
  INVENTORY: "status_in_stock",
  SCHEDULED: "status_scheduled",
  POSTED: "status_posted",
  SOLD: "status_sold",
} as const;

const UPCOMING_COUNT = 6;

function href(month: string, day?: string | null): string {
  const p = new URLSearchParams({ month });
  if (day) p.set("day", day);
  return `/schedule?${p.toString()}`;
}

/** Port of CalendarScreen.kt. Month and selected day live in the URL so Back
 *  works and other screens can link to a day. */
export default function ScheduleView({
  items,
  postingDays,
  monthParam,
  dayParam,
}: {
  items: InventoryItemView[];
  postingDays: number[];
  monthParam?: string;
  dayParam?: string;
}) {
  const { lang, t } = useT();
  const router = useRouter();
  const today = localToday();
  const month = parseMonth(monthParam, today);
  const day = parseDay(dayParam);
  const weekStart = weekStartFor(lang);
  const grid = monthGrid(month, weekStart);
  const byDay = groupByScheduledDate(items);
  const unscheduled = unscheduledItems(items);
  const postingSet = new Set(postingDays);

  const [sheet, setSheet] = useState<"unscheduled" | "pick" | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(url: string, body: unknown): Promise<Response> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.error ?? `${t("schedule_failed")} (${res.status})`);
    }
    return res;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("schedule_failed"));
    } finally {
      setBusy(false);
    }
  }

  function scheduleOn(item: InventoryItemView, date: string | null) {
    run(async () => {
      await post(`/api/items/${item.id}/schedule`, { scheduledPostDate: date });
      setSheet(null);
    });
  }

  function autoSchedule() {
    if (postingDays.length === 0) {
      setError(t("auto_schedule_no_days"));
      return;
    }
    const plan = autoSchedulePlan(unscheduled, today, postingDays);
    if (plan.length === 0) return;
    const ok = window.confirm(
      t("auto_schedule_confirm", {
        "1": plan.length,
        "2": shortDate(plan[0].date, lang),
        "3": shortDate(plan[plan.length - 1].date, lang),
      }),
    );
    if (!ok) return;
    run(async () => {
      const res = await post("/api/schedule/auto", { today });
      const data = await res.json();
      setSheet(null);
      setNotice(t("auto_schedule_done", { "1": data.scheduled ?? plan.length }));
    });
  }

  const dayItems = day ? byDay.get(day) ?? [] : [];
  const upcoming = nextPostingDays(today, postingDays, UPCOMING_COUNT);
  const currentMonth = today.slice(0, 7);

  return (
    <>
      <div className="cal-head">
        <a href={href(shiftMonth(month, -1), day)} aria-label={t("previous_month")} className="cal-nav">‹</a>
        <strong>{monthYearLabel(month, lang)}</strong>
        <a href={href(shiftMonth(month, 1), day)} aria-label={t("next_month")} className="cal-nav">›</a>
      </div>
      <div className="cal-sub">
        {month !== currentMonth ? <a href={href(currentMonth)}>{t("today")}</a> : <span />}
        {unscheduled.length > 0 ? (
          <button type="button" className="chip-btn" onClick={() => setSheet("unscheduled")}>
            {t("unscheduled_count", { "1": unscheduled.length })}
          </button>
        ) : (
          <span className="meta">{t("none_unscheduled")}</span>
        )}
      </div>

      <div className="cal-grid" role="grid">
        {weekdayHeaders(weekStart).map((wd) => (
          <div key={wd} className={`cal-wd${postingSet.has(wd) ? " posting" : ""}`}>
            {weekdayShort(wd, lang)}
          </div>
        ))}
        {Array.from({ length: grid.leading }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {grid.days.map((date) => {
          const count = byDay.get(date)?.length ?? 0;
          const cls = [
            "cal-day",
            date === today ? "today" : "",
            date === day ? "selected" : "",
            postingSet.has(isoWeekday(date)) ? "posting" : "",
            count > 0 ? "has-items" : "",
          ].filter(Boolean).join(" ");
          return (
            <a
              key={date}
              href={date === day ? href(month) : href(month, date)}
              className={cls}
              aria-label={`${longDate(date, lang)}${count ? `, ${t("items_count", { "1": count })}` : ""}`}
              aria-current={date === day ? "date" : undefined}
            >
              <span>{Number(date.slice(8))}</span>
              {count > 0 && <i className="cal-dot" />}
            </a>
          );
        })}
      </div>

      {notice && <p className="notice cal-notice">{notice}</p>}
      {error && !sheet && <p role="alert" className="error">{error}</p>}

      {day ? (
        <section className="cal-day-view">
          <div className="strip-head">
            <h2>{longDate(day, lang)}</h2>
            <a href={href(month)}>{t("close")}</a>
          </div>
          {dayItems.length === 0 ? (
            <p className="notice">{t("no_items_scheduled")}</p>
          ) : (
            <ul className="items">
              {dayItems.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} lang={lang} t={t}>
                    {item.status === "SCHEDULED" && (
                      <button
                        type="button"
                        className="btn btn-quiet small"
                        disabled={busy}
                        onClick={() => scheduleOn(item, null)}
                      >
                        {t("unschedule")}
                      </button>
                    )}
                  </ItemRow>
                </li>
              ))}
            </ul>
          )}
          {unscheduled.length > 0 && (
            <button
              type="button"
              className="btn btn-quiet cal-schedule-here"
              disabled={busy}
              onClick={() => setSheet("pick")}
            >
              {t("schedule_here")}
            </button>
          )}
        </section>
      ) : (
        <section>
          <div className="strip-head">
            <h2>{t("upcoming_posting_days")}</h2>
            <a href="/settings">{t("posting_days")}</a>
          </div>
          {upcoming.length === 0 ? (
            <p className="notice">{t("auto_schedule_no_days")}</p>
          ) : (
            <div className="posting-strip">
              {upcoming.map((date) => {
                const count = byDay.get(date)?.length ?? 0;
                return (
                  <a key={date} href={href(date.slice(0, 7), date)} className="posting-day">
                    <span className="k">{weekdayShort(isoWeekday(date), lang)}</span>
                    <span className="v">{shortDate(date, lang)}</span>
                    <span className={`s${count ? " has" : ""}`}>
                      {count === 0 ? "\u00a0" : count === 1 ? t("item_count_one") : t("items_count", { "1": count })}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      )}

      {sheet && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal sheet">
            <div className="strip-head" style={{ margin: 0 }}>
              <h2 style={{ fontSize: "1rem", textTransform: "none", letterSpacing: 0 }}>
                {sheet === "pick" && day
                  ? t("pick_item_for_day", { "1": shortDate(day, lang) })
                  : t("unscheduled_items_count", { "1": unscheduled.length })}
              </h2>
              <button type="button" className="link-btn" onClick={() => { setSheet(null); setError(null); }}>
                {t("close")}
              </button>
            </div>
            {sheet === "unscheduled" && (
              <button type="button" className="btn" disabled={busy || unscheduled.length === 0} onClick={autoSchedule}>
                {t("auto_schedule")}
              </button>
            )}
            {error && <p role="alert" className="error">{error}</p>}
            <ul className="items sheet-list">
              {unscheduled.map((item) => (
                <li key={item.id}>
                  {sheet === "pick" && day ? (
                    <button
                      type="button"
                      className="item-link pick"
                      disabled={busy}
                      onClick={() => scheduleOn(item, day)}
                    >
                      <ItemRow item={item} lang={lang} t={t} />
                    </button>
                  ) : (
                    <a className="item-link" href={`/items/${item.id}`}>
                      <ItemRow item={item} lang={lang} t={t} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function ItemRow({
  item,
  lang,
  t,
  children,
}: {
  item: InventoryItemView;
  lang: "en" | "uk";
  t: (key: string, vars?: Record<string, string | number>) => string;
  children?: React.ReactNode;
}) {
  return (
    <div className="item">
      {item.imageKey ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/images/${item.imageKey}`} alt="" loading="lazy" />
      ) : (
        <div className="thumb-empty" />
      )}
      <div className="body">
        <h2>
          {children ? <a href={`/items/${item.id}`}>{item.title}</a> : item.title}
        </h2>
        <p className="meta">{t("paid", { "1": formatMoney(item.purchasePrice, lang) })}</p>
        {children}
      </div>
      <span className={`badge ${item.status}`}>{t(STATUS_KEYS[item.status])}</span>
    </div>
  );
}
