# Schedule Tab + Swipe Actions Implementation Plan

**Goal:** Restore the Android Schedule tab (month grid, posting days, auto-schedule) and
the Inventory swipe actions (right = Posted, left = Sold) in the web app, with posting
days configurable and a day-level picker.

**Architecture:** Pure scheduling logic in `src/lib/schedule.ts`; new mutations in
`itemMutations.ts`; a key/value `app_settings` table for posting days; four small API
routes; a server-rendered `/schedule` page driving a client `ScheduleView`; a `SwipeRow`
pointer-event component around Inventory rows sharing the extracted `MarkAsSoldDialog`.

**Tech Stack:** Next.js 15 App Router, React 18, Drizzle, Vitest + PGlite. No new
dependencies.

**Spec:** [docs/superpowers/specs/2026-09-02-schedule-swipe-design.md](../specs/2026-09-02-schedule-swipe-design.md)

## Global constraints

- "Today" is always the device date supplied by the client.
- `soldDate` is still written only by `markItemSold`; the new mutations refuse sold items.
- Migrations apply on deploy. Generate with `npm run db:generate`, commit the folder.
- Branch `schedule-swipe`, PR to `main`. Do not stage the uncommitted Relay block in
  `CLAUDE.md`, `.claude/skills/`, or `.relay/`.

## Deviations from Android, decided during design

1. Unscheduled excludes posted items.
2. Posting days configurable (Settings), default Mon/Wed/Fri.
3. Day-level picker and per-row Unschedule on the calendar.
4. Week starts Monday in Ukrainian, Sunday in English.
5. Swipe has a reveal stage with a tappable button before the 40% direct trigger.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/schema.ts` (modify) | `app_settings` table |
| `netlify/database/migrations/<new>/` (create) | Generated migration |
| `src/lib/settings.ts` (create) | Posting days get/set + validation |
| `src/lib/itemMutations.ts` (modify) | `markItemPosted`, `scheduleItem`, `applySchedulePlan` |
| `src/lib/schedule.ts` (create) | Pure calendar and auto-schedule logic |
| `src/app/api/items/[id]/posted/route.ts` (create) | Mark posted |
| `src/app/api/items/[id]/schedule/route.ts` (create) | Set or clear scheduled date |
| `src/app/api/schedule/auto/route.ts` (create) | Auto-schedule unscheduled items |
| `src/app/api/settings/posting-days/route.ts` (create) | Save posting days |
| `src/components/MarkAsSoldDialog.tsx` (create) | Extracted from `ItemForm` |
| `src/components/SwipeRow.tsx` (create) | Gesture wrapper with Posted / Sold actions |
| `src/components/InventoryList.tsx` (modify) | Wrap rows, hint |
| `src/components/ItemForm.tsx` (modify) | Import the shared dialog |
| `src/app/schedule/page.tsx` (create) | Server page |
| `src/components/ScheduleView.tsx` (create) | Grid, day view, strip, sheets |
| `src/components/PostingDaysEditor.tsx` (create) | Settings block |
| `src/components/AppShell.tsx` (modify) | Fourth tab |
| `src/app/settings/page.tsx` (modify) | Mount editor |
| `src/app/globals.css` (modify) | Calendar, swipe, sheet styles |
| `i18n/en.json`, `i18n/uk.json` (modify) | New strings |
| `tests/unit/schedule.test.ts` (create) | Pure logic |
| `tests/integration/itemCrud.test.ts` (modify) | New mutations, settings |
| `CLAUDE.md`, `docs/handoff.md` (modify) | Current state |

---

### Task 1: Schema, settings, mutations, schedule logic

- [ ] Add `appSettings` to `schema.ts`; `npm run db:generate`; commit migration.
- [ ] `src/lib/settings.ts` with `DEFAULT_POSTING_DAYS = [1,3,5]`, `parsePostingDays`,
  `getPostingDays`, `setPostingDays` (upsert).
- [ ] `itemMutations.ts`: `markPostedSchema`, `scheduleSchema`, `markItemPosted`,
  `scheduleItem`, `applySchedulePlan`.
- [ ] Integration tests in `itemCrud.test.ts` for each, including the sold refusal.
- [ ] `tests/unit/schedule.test.ts` then `src/lib/schedule.ts`.

### Task 2: API routes

- [ ] Four routes following `/api/items/[id]/sold/route.ts` (gate, parse id, zod, 404/400/409/500).

### Task 3: Swipe

- [ ] Extract `MarkAsSoldDialog`; `ItemForm` unchanged in behaviour.
- [ ] `SwipeRow`: pointer events, `touch-action: pan-y`, intent lock after 8px, reveal at
  72px, trigger at 40% width, disabled directions do not move, click suppressed after drag.
- [ ] Wire into `InventoryList`; hint under chips for `(pointer: coarse)`.

### Task 4: Schedule page and settings

- [ ] `AppShell` fourth tab; `.tabbar` four columns.
- [ ] `schedule/page.tsx` + `ScheduleView`.
- [ ] `PostingDaysEditor` in Settings after Colours.
- [ ] i18n keys en + uk.

### Task 5: Verify and ship

- [ ] `npm test`, `npm run typecheck`, `npm run build`.
- [ ] Seeded PGlite socket + dev server; check at 402x874 with `dg-lang=uk`.
- [ ] Update `CLAUDE.md` current state and `docs/handoff.md`; PR to `main`.
