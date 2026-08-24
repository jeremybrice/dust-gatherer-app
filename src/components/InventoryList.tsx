"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { localToday } from "@/lib/dates";
import {
  FILTER_LABELS,
  filterItems,
  inventoryHref,
  type InventoryFilter,
  type InventorySort,
} from "@/lib/inventoryStats";
import type { InventoryItemView } from "@/lib/items";
import { formatMoney } from "@/lib/money";

const CHIPS: { filter: InventoryFilter; label: string }[] = [
  { filter: "all", label: "All" },
  { filter: "in-stock", label: "In stock" },
  { filter: "scheduled", label: "Scheduled" },
  { filter: "posted", label: "Posted" },
  { filter: "sold", label: "Sold" },
  { filter: "unsold", label: "Unsold" },
  { filter: "stale", label: "Stale" },
];

export default function InventoryList({
  items,
  filter,
  sort,
  q,
}: {
  items: InventoryItemView[];
  filter: InventoryFilter;
  sort: InventorySort;
  q: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(q);
  const visible = filterItems(items, { filter, sort, q, today: localToday() });

  function commitSearch(next: string) {
    router.push(inventoryHref({ filter, sort, q: next }));
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commitSearch(text);
        }}
      >
        <input
          className="search"
          value={text}
          placeholder="Search items…"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text !== q) commitSearch(text);
          }}
        />
      </form>

      <div className="chips">
        {CHIPS.map((chip) => {
          const on =
            chip.filter === "sold"
              ? filter === "sold" || filter === "sold-month"
              : chip.filter === filter;
          return (
            <a
              key={chip.filter}
              href={inventoryHref({ filter: chip.filter, q: text })}
              className={on ? "on" : undefined}
            >
              {chip.label}
            </a>
          );
        })}
      </div>

      <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>
        {FILTER_LABELS[filter]} · {visible.length}
      </h2>

      {items.length === 0 ? (
        <p className="notice">
          No items yet. <a href="/items/new">Add your first item</a> or{" "}
          <a href="/settings/import">import a backup</a>.
        </p>
      ) : visible.length === 0 ? (
        <p className="notice">
          No items match. <a href="/inventory">Clear</a>
        </p>
      ) : (
        <ul className="items">
          {visible.map((item) => (
            <li key={item.id}>
              <a className="item-link" href={`/items/${item.id}`}>
                <div className="item">
                  {item.imageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/images/${item.imageKey}`} alt="" loading="lazy" />
                  ) : (
                    <div className="thumb-empty" />
                  )}
                  <div className="body">
                    <h2>{item.title}</h2>
                    <p className="meta">
                      Paid {formatMoney(item.purchasePrice)}
                      {item.profit !== null && <> · Profit {formatMoney(item.profit)}</>}
                      {item.category && <> · {item.category}</>}
                    </p>
                  </div>
                  <span className={`badge ${item.status}`}>{item.status}</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
