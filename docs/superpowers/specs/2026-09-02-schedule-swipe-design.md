# Schedule tab + swipe actions: design

**Date:** 2026-09-02
**Status:** approved

## Why

Two items from the shop owner's feedback, both of which existed on Android and were lost
in the web conversion:

- "Slides when things are sold and when they're posted." Android's Inventory list used
  `SwipeableItemCard`: swipe right marked an item Posted, swipe left opened Mark as Sold.
- "I don't understand 'scheduled' because there's no calendar." Android had a Schedule tab
  with a month grid, posting days, and auto-scheduling of unscheduled items.

Reference source is in git history at `46d7f5f~1`: `ui/components/SwipeableItemCard.kt`,
`ui/screens/inventory/InventoryScreen.kt`, `ui/screens/calendar/CalendarScreen.kt`,
`viewmodel/CalendarViewModel.kt`, `data/local/InventoryDao.kt`.

## Android behaviour being ported

**Swipe.** Right swipe (start to end) is Mark as Posted, enabled only when the status is
`INVENTORY` or `SCHEDULED`; it sets `postedDate` to today and keeps `scheduledPostDate`.
Left swipe is Mark as Sold, enabled unless already `SOLD`; it opens the Mark as Sold price
dialog. The trigger threshold is 40% of the card width. The card tints gold or sage with a
label while dragging and always snaps back; rows are never dismissed.

**Schedule tab.** A fourth bottom tab, "Schedule" / "Розклад". Month grid, Sunday first,
arrows for previous and next month. A dot marks days with scheduled items; Monday,
Wednesday, and Friday are ringed as "posting days" (hardcoded). Tapping a day lists the
items scheduled for it; tapping an item opens it. With no day selected, a horizontal strip
shows the next six posting days with counts. A header button "N unscheduled" opens a sheet
of unscheduled items (`scheduledPostDate IS NULL AND soldDate IS NULL`) with an
Auto-schedule action that assigns them one per slot to the upcoming posting days.

## Decisions

1. **Posting days are configurable**, stored server-side in a new `app_settings` table
   (`key`, `value`, `updated_at`), key `posting_days`, JSON array of ISO weekdays
   (1 = Monday ... 7 = Sunday). Default `[1,3,5]` when the row is absent, matching Android.
   Edited from Settings. Server-side rather than a cookie because it is shop data, not a
   device preference, and the auto-scheduler runs on the server.
2. **Day-level picker.** The selected day offers "Schedule an item here", a sheet of
   unscheduled items; tapping one sets its `scheduledPostDate` to that day. Android only
   offered this via the item's date field. Each scheduled row on a day also has Unschedule.
3. **Unscheduled excludes posted items.** Android's DAO included them. An item that is
   already listed does not need a posting slot, so the web filter is: no scheduled date,
   not sold, not posted.
4. **Week start follows the UI language**: Monday for Ukrainian, Sunday for English.
5. **Swipe reveals a button before it triggers.** Past a short reveal distance the row
   snaps open showing a tappable Posted or Sold button; past 40% of the width it triggers
   directly (Android parity). The two-stage gesture avoids fighting Safari's edge swipe
   for Back and gives a visible target for a hesitant swipe.
6. **URL state for the calendar**: `/schedule?month=YYYY-MM&day=YYYY-MM-DD`. Back works,
   and other screens can link to a day.

## Data and API

- `src/lib/settings.ts`: `getPostingDays(db?)`, `setPostingDays(days, db?)`. Validation:
  integers 1..7, unique, at least one.
- `src/lib/itemMutations.ts`: `markItemPosted(id, { postedDate })` (refuses sold items,
  returns `"conflict"`), `scheduleItem(id, { scheduledPostDate })` (set or clear, refuses
  sold items), `applySchedulePlan(plan)` (list of `{ id, date }` in one transaction).
- `src/lib/schedule.ts` (pure): `monthGrid`, `nextPostingDays`, `unscheduledItems`,
  `autoSchedulePlan`, `groupByScheduledDate`, `parseMonth`, `parseDay`, `shiftMonth`.
- Routes: `POST /api/items/[id]/posted` `{ postedDate }`; `POST /api/items/[id]/schedule`
  `{ scheduledPostDate | null }`; `POST /api/schedule/auto` `{ today }` returns
  `{ scheduled }`; `PUT /api/settings/posting-days` `{ postingDays }`.
- Dates that mean "today" always come from the device (`localToday()`), never the server,
  for the same reason `/sold` already does this.

## UI

- `AppShell` gains a fourth tab, Schedule, between Inventory and Settings.
- `/schedule`: month header, grid, then either the selected day's items (with Unschedule
  and Schedule here) or the upcoming posting days strip. "N unscheduled" opens the sheet
  with Auto-schedule behind a confirm that names the count and the first and last slot.
- Inventory rows are wrapped in `SwipeRow`. A one-line hint under the chips, shown only on
  coarse-pointer devices, explains the gesture.
- Settings: Posting days block, seven toggles labelled with localised weekday names.
- `MarkAsSoldDialog` moves out of `ItemForm` to a shared component so the list and the
  form use the same dialog.

## Testing

- Unit: `schedule.test.ts` for grid, posting days, unscheduled filter, auto plan, parsers.
- Integration (PGlite): posted / schedule / plan mutations, posting-days round-trip, and
  the migration applying through the existing schema test.
- Manual at 402x874 in Ukrainian against a seeded PGlite socket: swipe both ways,
  Schedule grid, day view, picker, auto-schedule.
