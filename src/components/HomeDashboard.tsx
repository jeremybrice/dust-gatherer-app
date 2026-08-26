"use client";

import { useT } from "@/components/I18nProvider";
import { daysSitting, localToday, monthLabel } from "@/lib/dates";
import {
  STALE_AFTER_DAYS,
  inventoryHref,
  statsFor,
  type HomePeriod,
} from "@/lib/inventoryStats";
import type { InventoryItemView } from "@/lib/items";
import { formatMoney } from "@/lib/money";

function profitText(n: number, money: (n: number) => string): string {
  return n >= 0 ? `+${money(n)}` : money(n);
}

export default function HomeDashboard({
  items,
  period,
}: {
  items: InventoryItemView[];
  period: HomePeriod;
}) {
  const { lang, t } = useT();
  const money = (n: number) => formatMoney(n, lang);
  const today = localToday();
  const stats = statsFor(items, today);
  const flow = period === "all" ? stats.allTime : stats.thisMonth;
  const soldStrip = period === "all" ? stats.soldAllTime : stats.soldThisMonth;
  const soldHref = inventoryHref({
    filter: period === "all" ? "sold" : "sold-month",
  });
  const month = monthLabel(today, lang);

  return (
    <>
      <div className="period">
        {period === "month" ? (
          <>
            <strong>{month}</strong>
            <a href="/?period=all">{t("all_time")} →</a>
          </>
        ) : (
          <>
            <strong>{t("all_time")}</strong>
            <a href="/">{month} →</a>
          </>
        )}
      </div>

      <div className="stats">
        <a className="stat profit wide" href={soldHref}>
          <div className="k">
            {period === "all" ? t("sales_profit") : t("sales_profit_this_month")}
          </div>
          <div className="v">{profitText(flow.profit, money)}</div>
          <div className="s">
            {money(flow.revenue)} {t("revenue")}
            {flow.margin != null && <> · {t("margin_percent", { "1": Math.round(flow.margin * 100) })}</>}
            {" · "}{t("sold_count", { "1": flow.soldCount })}
          </div>
        </a>
        <a className="stat" href={inventoryHref({ filter: "unsold" })}>
          <div className="k">{t("on_the_shelf")}</div>
          <div className="v">{money(stats.shelfValue)}</div>
          <div className="s">{t("unsold_count", { "1": stats.unsoldCount })}</div>
        </a>
        <a className="stat" href={inventoryHref({ filter: "posted" })}>
          <div className="k">{t("posted_waiting")}</div>
          <div className="v">{stats.postedWaiting}</div>
          <div className="s">{t("listed_not_sold")}</div>
        </a>
        <a className="stat warn wide" href={inventoryHref({ filter: "stale" })}>
          <div className="k">{t("stale_gt_days", { "1": STALE_AFTER_DAYS })}</div>
          <div className="v">{stats.staleCount}</div>
          <div className="s">{t("gt_days", { "1": STALE_AFTER_DAYS })}</div>
        </a>
      </div>

      {items.length === 0 && (
        <p className="notice">{t("no_items_yet")} <a href="/items/new">{t("add_first_item")}</a> · <a href="/settings/import">{t("import_a_backup")}</a></p>
      )}

      {stats.oldestUnsold.length > 0 && (
        <section>
          <div className="strip-head">
            <h2>{t("oldest_on_the_shelf")}</h2>
            <a href={inventoryHref({ filter: "unsold", sort: "oldest" })}>{t("see_all")}</a>
          </div>
          <ul className="items">
            {stats.oldestUnsold.map((item) => (
              <li key={item.id}>
                <a className="item-link" href={`/items/${item.id}`}>
                  <div className="item">
                    {item.imageKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/images/${item.imageKey}`} alt="" />
                    ) : (
                      <div className="thumb-empty" />
                    )}
                    <div className="body">
                      <h2>{item.title}</h2>
                      <p className="meta">
                        {t("days_paid", { "1": daysSitting(item.purchaseDate, today), "2": money(item.purchasePrice) })}
                      </p>
                    </div>
                    {daysSitting(item.purchaseDate, today) > STALE_AFTER_DAYS && (
                      <span className="chip">{t("stale")}</span>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {soldStrip.length > 0 && (
        <section>
          <div className="strip-head">
            <h2>{period === "all" ? t("recently_sold") : t("sold_this_month")}</h2>
            <a href={soldHref}>{t("see_all")}</a>
          </div>
          <ul className="items">
            {soldStrip.map((item) => (
              <li key={item.id}>
                <a className="item-link" href={`/items/${item.id}`}>
                  <div className="item">
                    {item.imageKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/images/${item.imageKey}`} alt="" />
                    ) : (
                      <div className="thumb-empty" />
                    )}
                    <div className="body">
                      <h2>{item.title}</h2>
                      <p className="meta">
                        {t("sold_profit", { "1": money(item.sellingPrice ?? 0), "2": money(item.profit ?? 0) })}
                      </p>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
