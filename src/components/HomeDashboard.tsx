"use client";

import { daysSitting, localToday, monthLabel } from "@/lib/dates";
import {
  STALE_AFTER_DAYS,
  inventoryHref,
  statsFor,
  type HomePeriod,
} from "@/lib/inventoryStats";
import type { InventoryItemView } from "@/lib/items";
import { formatMoney } from "@/lib/money";

function profitText(n: number): string {
  return n >= 0 ? `+${formatMoney(n)}` : formatMoney(n);
}

export default function HomeDashboard({
  items,
  period,
}: {
  items: InventoryItemView[];
  period: HomePeriod;
}) {
  const today = localToday();
  const stats = statsFor(items, today);
  const flow = period === "all" ? stats.allTime : stats.thisMonth;
  const soldStrip = period === "all" ? stats.soldAllTime : stats.soldThisMonth;
  const soldHref = inventoryHref({
    filter: period === "all" ? "sold" : "sold-month",
  });
  const month = monthLabel(today);

  return (
    <>
      <div className="period">
        {period === "month" ? (
          <>
            <strong>{month}</strong>
            <a href="/?period=all">All-time →</a>
          </>
        ) : (
          <>
            <strong>All-time</strong>
            <a href="/">{month} →</a>
          </>
        )}
      </div>

      <div className="stats">
        <a className="stat profit wide" href={soldHref}>
          <div className="k">
            {period === "all" ? "Sales profit" : "Sales profit this month"}
          </div>
          <div className="v">{profitText(flow.profit)}</div>
          <div className="s">
            {formatMoney(flow.revenue)} revenue
            {flow.margin != null && <> · {Math.round(flow.margin * 100)}% margin</>}
            {" · "}{flow.soldCount} sold
          </div>
        </a>
        <a className="stat" href={inventoryHref({ filter: "unsold" })}>
          <div className="k">On the shelf</div>
          <div className="v">{formatMoney(stats.shelfValue)}</div>
          <div className="s">{stats.unsoldCount} unsold</div>
        </a>
        <a className="stat" href={inventoryHref({ filter: "posted" })}>
          <div className="k">Posted, waiting</div>
          <div className="v">{stats.postedWaiting}</div>
          <div className="s">listed, not sold</div>
        </a>
        <a className="stat warn wide" href={inventoryHref({ filter: "stale" })}>
          <div className="k">Stale &gt; {STALE_AFTER_DAYS} days</div>
          <div className="v">{stats.staleCount}</div>
          <div className="s">&gt; {STALE_AFTER_DAYS} days</div>
        </a>
      </div>

      {items.length === 0 && (
        <p className="notice">
          No items yet. <a href="/items/new">Add your first item</a> or{" "}
          <a href="/settings/import">import a backup</a>.
        </p>
      )}

      {stats.oldestUnsold.length > 0 && (
        <section>
          <div className="strip-head">
            <h2>Oldest on the shelf</h2>
            <a href={inventoryHref({ filter: "unsold", sort: "oldest" })}>See all</a>
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
                        {daysSitting(item.purchaseDate, today)} days · paid {formatMoney(item.purchasePrice)}
                      </p>
                    </div>
                    {daysSitting(item.purchaseDate, today) > STALE_AFTER_DAYS && (
                      <span className="chip">stale</span>
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
            <h2>{period === "all" ? "Recently sold" : "Sold this month"}</h2>
            <a href={soldHref}>See all</a>
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
                        Sold {formatMoney(item.sellingPrice ?? 0)}
                        {item.profit != null && <> · Profit {formatMoney(item.profit)}</>}
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
