"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18nProvider";
import MarkAsSoldDialog, { parsePrice } from "@/components/MarkAsSoldDialog";
import { localToday } from "@/lib/dates";
import { downscaleImage } from "@/lib/imageResize";
import {
  applyStatusChange,
  deriveStatus,
  type SelectableStatus,
} from "@/lib/itemStatus";
import type { InventoryItemView } from "@/lib/items";
import { formatMoney } from "@/lib/money";

const STATUS_KEYS: Record<SelectableStatus, string> = {
  INVENTORY: "status_in_stock",
  SCHEDULED: "status_scheduled",
  POSTED: "status_posted",
};

interface ItemFormProps {
  item: InventoryItemView | null;
  categories: string[];
  sites: string[];
}

export default function ItemForm({ item, categories, sites }: ItemFormProps) {
  const { lang, t } = useT();
  const router = useRouter();
  const editing = item !== null;

  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [purchasePrice, setPurchasePrice] = useState(
    item != null ? String(item.purchasePrice) : "",
  );
  const [sellingPrice, setSellingPrice] = useState(
    item?.sellingPrice != null ? String(item.sellingPrice) : "",
  );
  const [purchaseDate, setPurchaseDate] = useState(item?.purchaseDate ?? localToday());
  const [scheduledPostDate, setScheduledPostDate] = useState<string | null>(
    item?.scheduledPostDate ?? null,
  );
  const [postedDate, setPostedDate] = useState<string | null>(item?.postedDate ?? null);
  const [purchaseLocation, setPurchaseLocation] = useState(item?.purchaseLocation ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [site, setSite] = useState(item?.site ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");

  // The saved blob key, and a not-yet-uploaded replacement chosen locally.
  const [imageKey, setImageKey] = useState<string | null>(item?.imageKey ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSoldDialog, setShowSoldDialog] = useState(false);

  const soldDate = item?.soldDate ?? null;
  const isSold = soldDate !== null;

  // The dropdown shows the status DERIVED from the form's current dates, and
  // selecting an option rewrites those dates: exact port of the Android form,
  // where ItemFormState.currentStatus was computed and changeStatus mutated
  // the date fields in place.
  const currentStatus = deriveStatus({ scheduledPostDate, postedDate, soldDate });

  const isValid =
    title.trim().length > 0 && parsePrice(purchasePrice) !== null;

  function onPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function onStatusChange(next: SelectableStatus) {
    const applied = applyStatusChange(
      next,
      { scheduledPostDate, postedDate },
      localToday(),
    );
    setScheduledPostDate(applied.scheduledPostDate);
    setPostedDate(applied.postedDate);
  }

  async function save() {
    if (!isValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      let key = imageKey;
      if (photoFile) {
        const downscaled = await downscaleImage(photoFile);
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: downscaled,
        });
        if (!res.ok) throw new Error(`photo upload failed (${res.status})`);
        key = (await res.json()).key as string;
        // Adopt the uploaded key so a retry after a failed save below does
        // not upload the same photo again.
        setImageKey(key);
        setPhotoFile(null);
      }

      // Android silently treated an unparseable asking price as empty
      // (sellingPrice.toDoubleOrNull()); parsePrice matches that exactly.
      const payload = {
        title: title.trim(),
        description,
        purchasePrice: parsePrice(purchasePrice)!,
        sellingPrice: parsePrice(sellingPrice),
        purchaseDate,
        scheduledPostDate,
        ...(editing ? { postedDate } : {}),
        imageKey: key,
        purchaseLocation,
        category,
        site,
        notes,
      };

      const res = await fetch(editing ? `/api/items/${item.id}` : "/api/items", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `save failed (${res.status})`);
      }
      router.push("/inventory");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("save_failed"));
      setBusy(false);
    }
  }

  async function confirmSold(price: number) {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${item.id}/sold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellingPrice: price, soldDate: localToday() }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `sale failed (${res.status})`);
      }
      router.push("/inventory");
      router.refresh();
    } catch (err) {
      // Keep the dialog open on failure so the typed price is not lost and the
      // error is visible where the user is looking, instead of rendering
      // behind the still-open modal.
      setError(err instanceof Error ? err.message : t("sale_failed"));
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!editing) return;
    if (!window.confirm(t("delete_item_confirm_message"))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`delete failed (${res.status})`);
      router.push("/inventory");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("delete_failed"));
      setBusy(false);
    }
  }

  const photoSrc = previewUrl ?? (imageKey ? `/api/images/${imageKey}` : null);

  return (
    <div className="container">
      <header className="app">
        <h1>{t(editing ? "edit_item" : "add_item")}</h1>
        <nav className="nav">
          <a href="/inventory">{t("cancel")}</a>
        </nav>
      </header>

      <div className="form">
        <button
          type="button"
          className="photo-area"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          {photoSrc ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc} alt={t("item_image")} />
              <span className="change-hint">{t("change")}</span>
            </>
          ) : (
            <span>{t("tap_to_add_photo")}</span>
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={onPhotoChosen}
          hidden
        />

        <div className="field">
          <label htmlFor="title">{t("title_required")}</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="description">{t("description")}</label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="purchasePrice">{t("purchase_price_required")}</label>
            <input
              id="purchasePrice"
              inputMode="decimal"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="sellingPrice">{t("asking_price_label")}</label>
            <input
              id="sellingPrice"
              inputMode="decimal"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="purchaseDate">{t("purchase_date")}</label>
          <input
            id="purchaseDate"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="scheduledPostDate">{t("scheduled_post_date")}</label>
          <input
            id="scheduledPostDate"
            type="date"
            value={scheduledPostDate ?? ""}
            onChange={(e) => setScheduledPostDate(e.target.value === "" ? null : e.target.value)}
          />
        </div>

        {editing && !isSold && (
          <div className="field">
            <label htmlFor="status">{t("status")}</label>
            <select
              id="status"
              value={currentStatus}
              onChange={(e) => onStatusChange(e.target.value as SelectableStatus)}
            >
              {(Object.keys(STATUS_KEYS) as SelectableStatus[]).map((s) => (
                <option key={s} value={s}>{t(STATUS_KEYS[s])}</option>
              ))}
            </select>
          </div>
        )}

        {isSold && (
          <p className="notice">
            {t("sold_on", { "1": soldDate })}
            {item?.profit != null && <> · {t("profit", { "1": formatMoney(item.profit, lang) })}</>}
          </p>
        )}

        <div className="field">
          <label htmlFor="purchaseLocation">{t("purchase_location")}</label>
          <input
            id="purchaseLocation"
            value={purchaseLocation}
            onChange={(e) => setPurchaseLocation(e.target.value)}
          />
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="category">{t("category")}</label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value=""></option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="site">{t("site")}</label>
            <select id="site" value={site} onChange={(e) => setSite(e.target.value)}>
              <option value=""></option>
              {sites.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="notes">{t("notes")}</label>
          <textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && !showSoldDialog && <p role="alert" className="error">{error}</p>}

        <button type="button" className="btn" onClick={save} disabled={!isValid || busy}>
          {busy ? t("saving") : t("save")}
        </button>

        {editing && !isSold && (
          <button
            type="button"
            className="btn"
            onClick={() => { setError(null); setShowSoldDialog(true); }}
            disabled={busy}
          >
            {t("mark_as_sold")}
          </button>
        )}

        {editing && (
          <button type="button" className="btn btn-danger" onClick={onDelete} disabled={busy}>
            {t("delete_item")}
          </button>
        )}
      </div>

      {showSoldDialog && item && (
        <MarkAsSoldDialog
          title={item.title}
          purchasePrice={parsePrice(purchasePrice) ?? item.purchasePrice}
          initialPrice={sellingPrice}
          busy={busy}
          error={error}
          lang={lang}
          t={t}
          onCancel={() => setShowSoldDialog(false)}
          onConfirm={confirmSold}
        />
      )}
    </div>
  );
}
