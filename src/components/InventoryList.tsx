"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18nProvider";
import MarkAsSoldDialog from "@/components/MarkAsSoldDialog";
import SwipeRow from "@/components/SwipeRow";
import { localToday, shortDate } from "@/lib/dates";
import {
  DEFAULT_LIMIT,
  FILTER_KEYS,
  LIMIT_OPTIONS,
  filterItems,
  inventoryHref,
  type InventoryFilter,
  type InventoryLimit,
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

// Two rows on purpose. The first is the item's single status; the second is a
// cross-cutting view (an unsold item is also in stock, scheduled, or posted).
// Mixing them in one row is what made "Не продані" vs "Заплановано" unreadable.
const STATUS_CHIPS: { filter: InventoryFilter; key: string }[] = [
  { filter: "all", key: "chip_all" },
  { filter: "in-stock", key: "chip_in_stock" },
  { filter: "scheduled", key: "chip_scheduled" },
  { filter: "posted", key: "chip_posted" },
  { filter: "sold", key: "chip_sold" },
];

const VIEW_CHIPS: { filter: InventoryFilter; key: string }[] = [
  { filter: "unsold", key: "on_the_shelf" },
  { filter: "stale", key: "chip_stale" },
];

export default function InventoryList({
  items,
  filter,
  sort,
  q,
  limit = DEFAULT_LIMIT,
}: {
  items: InventoryItemView[];
  filter: InventoryFilter;
  sort: InventorySort;
  q: string;
  limit?: InventoryLimit;
}) {
  const { lang, t } = useT();
  const router = useRouter();
  const [text, setText] = useState(q);
  const [extra, setExtra] = useState(0);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
  const [selling, setSelling] = useState<InventoryItemView | null>(null);
  const visible = filterItems(items, { filter, sort, q, today: localToday() });
  const pageSize = limit === "all" ? visible.length : limit;
  const shown = limit === "all" ? visible : visible.slice(0, pageSize + extra);
  const remaining = visible.length - shown.length;

  function commitSearch(next: string) {
    router.push(inventoryHref({ filter, sort, q: next, limit }));
  }

  // Swipe right: port of InventoryViewModel.markAsPosted, today's device date.
  async function markPosted(item: InventoryItemView) {
    setPendingId(item.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/items/${item.id}/posted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postedDate: localToday() }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `${t("posted_failed")} (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setRowError({ id: item.id, message: err instanceof Error ? err.message : t("posted_failed") });
    } finally {
      setPendingId(null);
    }
  }

  // Swipe left: the same dialog and endpoint the item page uses.
  async function confirmSold(price: number) {
    if (!selling) return;
    const item = selling;
    setPendingId(item.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/items/${item.id}/sold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellingPrice: price, soldDate: localToday() }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `${t("sale_failed")} (${res.status})`);
      }
      setSelling(null);
      router.refresh();
    } catch (err) {
      // Keep the dialog open so the typed price survives and the error is
      // visible where she is looking.
      setRowError({ id: item.id, message: err instanceof Error ? err.message : t("sale_failed") });
    } finally {
      setPendingId(null);
    }
  }

  function chipRow(
    chips: { filter: InventoryFilter; key: string }[],
    labelKey: string,
    className: string,
  ) {
    return (
      <div className={className} role="group" aria-label={t(labelKey)}>
        <span className="chips-label">{t(labelKey)}</span>
        {chips.map((chip) => {
          const on =
            chip.filter === "sold"
              ? filter === "sold" || filter === "sold-month"
              : chip.filter === filter;
          return (
            <a
              key={chip.filter}
              href={inventoryHref({ filter: chip.filter, q: text, limit })}
              className={on ? "on" : undefined}
            >
              {t(chip.key)}
            </a>
          );
        })}
      </div>
    );
  }

  function dateNote(item: InventoryItemView): string | null {
    if (item.status === "SCHEDULED" && item.scheduledPostDate) {
      return t("scheduled_for", { "1": shortDate(item.scheduledPostDate, lang) });
    }
    if (item.status === "POSTED" && item.postedDate) {
      return t("posted_on", { "1": shortDate(item.postedDate, lang) });
    }
    return null;
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

      {chipRow(STATUS_CHIPS, "chip_group_status", "chips")}
      {chipRow(VIEW_CHIPS, "chip_group_views", "chips views")}

      {items.length > 0 && <p className="meta swipe-hint">{t("swipe_hint")}</p>}

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
        <>
          <ul className="items">
            {shown.map((item) => {
              const note = dateNote(item);
              return (
                <li key={item.id}>
                  <SwipeRow
                    canPost={item.status === "INVENTORY" || item.status === "SCHEDULED"}
                    canSell={item.status !== "SOLD"}
                    postLabel={t("mark_as_posted")}
                    sellLabel={t("mark_as_sold")}
                    busy={pendingId === item.id}
                    onPost={() => markPosted(item)}
                    onSell={() => { setRowError(null); setSelling(item); }}
                  >
                    <a className="item-link" href={`/items/${item.id}`} draggable={false}>
                      <div className={`item${pendingId === item.id ? " pending" : ""}`}>
                        {item.imageKey ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/images/${item.imageKey}`} alt="" loading="lazy" draggable={false} />
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
                          {note && <p className="meta date-note">{note}</p>}
                        </div>
                        <span className={`badge ${item.status}`}>{t(STATUS_KEYS[item.status])}</span>
                      </div>
                    </a>
                  </SwipeRow>
                  {rowError?.id === item.id && !selling && (
                    <p role="alert" className="error row-error">{rowError.message}</p>
                  )}
                </li>
              );
            })}
          </ul>

          {selling && (
            <MarkAsSoldDialog
              title={selling.title}
              purchasePrice={selling.purchasePrice}
              initialPrice={selling.sellingPrice != null ? String(selling.sellingPrice) : ""}
              busy={pendingId === selling.id}
              error={rowError?.id === selling.id ? rowError.message : null}
              lang={lang}
              t={t}
              onCancel={() => { setSelling(null); setRowError(null); }}
              onConfirm={confirmSold}
            />
          )}

          <div className="paging">
            <p className="meta">
              {t("showing_of", { "1": shown.length, "2": visible.length })}
            </p>
            {remaining > 0 && (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setExtra(extra + pageSize)}
              >
                {t("show_more", { "1": Math.min(pageSize, remaining) })}
              </button>
            )}
            <div className="chips per-page" role="group" aria-label={t("per_page")}>
              <span className="chips-label">{t("per_page")}</span>
              {LIMIT_OPTIONS.map((opt) => (
                <a
                  key={String(opt)}
                  href={inventoryHref({ filter, sort, q, limit: opt })}
                  className={opt === limit ? "on" : undefined}
                >
                  {opt === "all" ? t("per_page_all") : opt}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
