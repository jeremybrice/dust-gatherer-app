"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { localToday } from "@/lib/dates";
import { downscaleImage } from "@/lib/imageResize";
import {
  applyStatusChange,
  deriveStatus,
  type SelectableStatus,
} from "@/lib/itemStatus";
import type { InventoryItemView } from "@/lib/items";
import { formatMoney as money } from "@/lib/money";

const STATUS_LABELS: Record<SelectableStatus, string> = {
  INVENTORY: "In Stock",
  SCHEDULED: "Scheduled",
  POSTED: "Posted",
};

/** Strict decimal parse matching Kotlin's toDoubleOrNull: the whole trimmed
 *  string must be a valid number, else null. parseFloat would accept "1,200"
 *  as 1 and silently truncate a typed price. */
function parsePrice(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

interface ItemFormProps {
  item: InventoryItemView | null;
  categories: string[];
  sites: string[];
}

export default function ItemForm({ item, categories, sites }: ItemFormProps) {
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
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the item.");
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
      router.push("/");
      router.refresh();
    } catch (err) {
      // Keep the dialog open on failure so the typed price is not lost and the
      // error is visible where the user is looking, instead of rendering
      // behind the still-open modal.
      setError(err instanceof Error ? err.message : "Could not record the sale.");
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!editing) return;
    if (!window.confirm("Delete this item? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`delete failed (${res.status})`);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the item.");
      setBusy(false);
    }
  }

  const photoSrc = previewUrl ?? (imageKey ? `/api/images/${imageKey}` : null);

  return (
    <div className="container">
      <header className="app">
        <h1>{editing ? "Edit item" : "Add item"}</h1>
        <nav className="nav">
          <a href="/">Cancel</a>
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
              <img src={photoSrc} alt="Item photo" />
              <span className="change-hint">Change</span>
            </>
          ) : (
            <span>Tap to add a photo</span>
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
          <label htmlFor="title">Title (required)</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="purchasePrice">Purchase price $ (required)</label>
            <input
              id="purchasePrice"
              inputMode="decimal"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="sellingPrice">Asking price $</label>
            <input
              id="sellingPrice"
              inputMode="decimal"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="purchaseDate">Purchase date</label>
          <input
            id="purchaseDate"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="scheduledPostDate">Scheduled post date</label>
          <input
            id="scheduledPostDate"
            type="date"
            value={scheduledPostDate ?? ""}
            onChange={(e) => setScheduledPostDate(e.target.value === "" ? null : e.target.value)}
          />
        </div>

        {editing && !isSold && (
          <div className="field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={currentStatus}
              onChange={(e) => onStatusChange(e.target.value as SelectableStatus)}
            >
              {(Object.keys(STATUS_LABELS) as SelectableStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        )}

        {isSold && (
          <p className="notice">
            Sold on {soldDate}
            {item?.profit != null && <> · Profit {money(item.profit)}</>}
          </p>
        )}

        <div className="field">
          <label htmlFor="purchaseLocation">Purchase location</label>
          <input
            id="purchaseLocation"
            value={purchaseLocation}
            onChange={(e) => setPurchaseLocation(e.target.value)}
          />
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value=""></option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="site">Site</label>
            <select id="site" value={site} onChange={(e) => setSite(e.target.value)}>
              <option value=""></option>
              {sites.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && !showSoldDialog && <p role="alert" className="error">{error}</p>}

        <button type="button" className="btn" onClick={save} disabled={!isValid || busy}>
          {busy ? "Saving…" : "Save"}
        </button>

        {editing && !isSold && (
          <button
            type="button"
            className="btn"
            onClick={() => { setError(null); setShowSoldDialog(true); }}
            disabled={busy}
          >
            Mark as Sold
          </button>
        )}

        {editing && (
          <button type="button" className="btn btn-danger" onClick={onDelete} disabled={busy}>
            Delete item
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
          onCancel={() => setShowSoldDialog(false)}
          onConfirm={confirmSold}
        />
      )}
    </div>
  );
}

/** Port of MarkAsSoldDialog.kt: final price prefilled with the asking price,
 *  strictly positive to confirm, live profit preview. */
function MarkAsSoldDialog({
  title,
  purchasePrice,
  initialPrice,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  purchasePrice: number;
  initialPrice: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (price: number) => void;
}) {
  const [priceText, setPriceText] = useState(initialPrice);
  const price = parsePrice(priceText);
  const valid = price !== null && price > 0;
  const profit = valid ? price! - purchasePrice : null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Mark as sold">
      <div className="modal">
        <h2>Mark as Sold</h2>
        <p style={{ margin: 0 }}>{title}</p>
        <p style={{ margin: 0 }} className="meta">Bought for {money(purchasePrice)}</p>
        <div className="field">
          <label htmlFor="finalPrice">Final sale price $</label>
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
            Profit: {profit >= 0 ? "+" : ""}{money(profit)}
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
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => valid && onConfirm(price!)}
            disabled={!valid || busy}
          >
            Confirm Sale
          </button>
        </div>
      </div>
    </div>
  );
}
