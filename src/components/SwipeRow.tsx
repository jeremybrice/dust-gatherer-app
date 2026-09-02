"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Port of SwipeableItemCard.kt. Right (start to end) is Mark as Posted, left is
// Mark as Sold, and the row always snaps back; it is never dismissed.
//
// Two stages instead of Android's one. Past REVEAL_PX the row parks open with a
// tappable button; past 40% of the width (Android's positionalThreshold) the
// action fires on release. The parked stage exists because iOS Safari owns a
// right swipe that begins at the screen edge (Back), so a short, deliberate
// drag that shows a button is the gesture that never fights the browser.
const REVEAL_PX = 96;
const TRIGGER_FRACTION = 0.4;
const INTENT_PX = 8;

type Side = "post" | "sell";

export default function SwipeRow({
  canPost,
  canSell,
  postLabel,
  sellLabel,
  postAria,
  sellAria,
  busy,
  onPost,
  onSell,
  children,
}: {
  canPost: boolean;
  canSell: boolean;
  /** Short button text; the full action name goes in aria-label. */
  postLabel: string;
  sellLabel: string;
  postAria: string;
  sellAria: string;
  busy: boolean;
  onPost: () => void;
  onSell: () => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; base: number } | null>(null);
  const intent = useRef<"h" | "v" | null>(null);
  const moved = useRef(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState<Side | null>(null);

  const enabled = (canPost || canSell) && !busy;

  // A parked row closes when she taps anywhere else or scrolls on.
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === "pointerdown" && root.current?.contains(e.target as Node)) return;
      settle(0, null);
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("scroll", close, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("scroll", close);
    };
  }, [open]);

  function settle(x: number, side: Side | null) {
    setDragging(false);
    setDx(x);
    setOpen(side);
  }

  function clamp(raw: number): number {
    if (raw > 0 && !canPost) return 0;
    if (raw < 0 && !canSell) return 0;
    // Gentle resistance past the reveal point so a long drag still reads as
    // "keep going" without flinging the card off.
    const limit = (root.current?.offsetWidth ?? 320) * 0.6;
    return Math.max(-limit, Math.min(limit, raw));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!enabled || e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, base: dx };
    intent.current = null;
    moved.current = false;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (intent.current === null) {
      if (Math.abs(ddx) < INTENT_PX && Math.abs(ddy) < INTENT_PX) return;
      intent.current = Math.abs(ddx) > Math.abs(ddy) ? "h" : "v";
      if (intent.current === "h") {
        try {
          root.current?.setPointerCapture(e.pointerId);
        } catch {
          // Capture is a nicety (keeps the drag if the finger leaves the row);
          // a browser that refuses it should not abort the gesture.
        }
        setDragging(true);
      }
    }
    if (intent.current !== "h") return;
    moved.current = true;
    setDx(clamp(s.base + ddx));
  }

  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    const s = start.current;
    start.current = null;
    if (!s || intent.current !== "h") {
      intent.current = null;
      return;
    }
    intent.current = null;
    if (root.current?.hasPointerCapture(e.pointerId)) {
      root.current.releasePointerCapture(e.pointerId);
    }
    const width = root.current?.offsetWidth ?? 320;
    const x = clamp(s.base + (e.clientX - s.x));
    if (Math.abs(x) >= width * TRIGGER_FRACTION) {
      settle(0, null);
      if (x > 0) onPost();
      else onSell();
    } else if (x >= REVEAL_PX) {
      settle(REVEAL_PX, "post");
    } else if (x <= -REVEAL_PX) {
      settle(-REVEAL_PX, "sell");
    } else {
      settle(0, null);
    }
  }

  // The row is a link. A drag must not also navigate, and a tap on a parked
  // row should close it rather than open the item.
  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest(".swipe-action")) return;
    if (moved.current || open) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
      if (open) settle(0, null);
    }
  }

  const side: Side | null = dx > 0 ? "post" : dx < 0 ? "sell" : null;
  const progress = Math.min(1, Math.abs(dx) / REVEAL_PX);

  return (
    <div
      ref={root}
      className={`swipe${side ? ` ${side}` : ""}${dragging ? " dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={onClickCapture}
    >
      <div className="swipe-bg" style={{ opacity: side ? 0.35 + progress * 0.65 : 0 }} aria-hidden={!open}>
        {canPost && (
          <button
            type="button"
            className="swipe-action post"
            aria-label={postAria}
            tabIndex={open === "post" ? 0 : -1}
            onClick={() => { settle(0, null); onPost(); }}
          >
            {postLabel}
          </button>
        )}
        {canSell && (
          <button
            type="button"
            className="swipe-action sell"
            aria-label={sellAria}
            tabIndex={open === "sell" ? 0 : -1}
            onClick={() => { settle(0, null); onSell(); }}
          >
            {sellLabel}
          </button>
        )}
      </div>
      <div className="swipe-fg" style={{ transform: `translateX(${dx}px)` }}>
        {children}
      </div>
    </div>
  );
}
