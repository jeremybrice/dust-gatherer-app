"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18nProvider";
import { localToday } from "@/lib/dates";
import {
  FILTER_KEYS,
  filterItems,
  inventoryHref,
  type InventoryFilter,
  type InventorySort,
} from "@/lib/inventoryStats";
import type { InventoryItemView } from "@/lib/items";
import { formatMoney } from "@/lib/money";

const STATUS_KEYS = {
  INVENTORY: "status_in_stock",
  SCHEDULED: "status_scheduled",
  POSTED: "status_posted",
  SOLD: "status_sold",
} as const;

const CHIPS: { filter: InventoryFilter; key: string }[] = [
  { filter: "all", key: "chip_all" },
  { filter: "in-stock", key: "chip_in_stock" },
  { filter: "scheduled", key: "chip_scheduled" },
  { filter: "posted", key: "chip_posted" },
  { filter: "sold", key: "chip_sold" },
  { filter: "unsold", key: "chip_unsold" },
  { filter: "stale", key: "chip_stale" },
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
  const { lang, t } = useT();
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
          placeholder={t("search_items")}
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
              {t(chip.key)}
            </a>
          );
        })}
      </div>

      <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>
        {t(FILTER_KEYS[filter])} · {visible.length}
      </h2>

      {items.length === 0 ? (
        <p className="notice">{t("no_items_yet")} <a href="/items/new">{t("add_first_item")}</a> · <a href="/settings/import">{t("import_a_backup")}</a></p>
      ) : visible.length === 0 ? (
        <p className="notice">
          {t("no_items_match")} <a href="/inventory">{t("clear")}</a>
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
                      {t("paid", { "1": formatMoney(item.purchasePrice, lang) })}
                      {item.profit !== null && <> · {t("profit", { "1": formatMoney(item.profit, lang) })}</>}
                      {item.category && <> · {item.category}</>}
                    </p>
                  </div>
                  <span className={`badge ${item.status}`}>{t(STATUS_KEYS[item.status])}</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
