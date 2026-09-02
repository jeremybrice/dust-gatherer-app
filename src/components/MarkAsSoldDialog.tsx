"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** Strict decimal parse matching Kotlin's toDoubleOrNull: the whole trimmed
 *  string must be a valid number, else null. parseFloat would accept "1,200"
 *  as 1 and silently truncate a typed price. */
export function parsePrice(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Port of MarkAsSoldDialog.kt: final price prefilled with the asking price,
 *  strictly positive to confirm, live profit preview. Shared by the item form
 *  and the Inventory swipe action so both sales look and validate the same. */
export default function MarkAsSoldDialog({
  title,
  purchasePrice,
  initialPrice,
  busy,
  error,
  lang,
  t,
  onCancel,
  onConfirm,
}: {
  title: string;
  purchasePrice: number;
  initialPrice: string;
  busy: boolean;
  error: string | null;
  lang: Lang;
  t: TFn;
  onCancel: () => void;
  onConfirm: (price: number) => void;
}) {
  const [priceText, setPriceText] = useState(initialPrice);
  const price = parsePrice(priceText);
  const valid = price !== null && price > 0;
  const profit = valid ? price! - purchasePrice : null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t("mark_as_sold")}>
      <div className="modal">
        <h2>{t("mark_as_sold")}</h2>
        <p style={{ margin: 0 }}>{title}</p>
        <p style={{ margin: 0 }} className="meta">{t("bought_for", { "1": formatMoney(purchasePrice, lang) })}</p>
        <div className="field">
          <label htmlFor="finalPrice">{t("final_sale_price")}</label>
          <input
            id="finalPrice"
            inputMode="decimal"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            autoFocus
          />
        </div>
        {profit !== null && (
          <p style={{ margin: 0 }}>
            {t("profit", { "1": `${profit >= 0 ? "+" : ""}${formatMoney(profit, lang)}` })}
          </p>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="actions">
          <button
            type="button"
            className="btn"
            style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)" }}
            onClick={onCancel}
            disabled={busy}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => valid && onConfirm(price!)}
            disabled={!valid || busy}
          >
            {t("confirm_sale")}
          </button>
        </div>
      </div>
    </div>
  );
}
