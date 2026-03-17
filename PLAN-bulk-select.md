# Bulk Select & Bulk Actions — Implementation Plan

## Overview

Add long-press multi-select to the product list (InventoryScreen) with bulk actions for updating status, category, and site across selected items.

---

## User Flow

1. **Enter selection mode:** User long-presses any item in the product list
2. **That item becomes checked** and a selection toolbar appears at the top
3. **Tap other items** to check/uncheck them (normal tap now toggles selection instead of navigating to detail)
4. **"Select All" / "Deselect All"** toggle in the toolbar for convenience
5. **Bulk action bar** at the bottom shows available actions
6. **Perform a bulk action** — opens a dialog to pick the new value, then applies it to all selected items
7. **Exit selection mode** via back button, X in toolbar, or after an action completes

---

## Bulk Actions Available

| Action | Dialog | What It Does |
|--------|--------|--------------|
| **Set Status → In Stock** | Confirmation only | Clears `postedDate`, `soldDate`, `scheduledPostDate` on selected items |
| **Set Status → Scheduled** | Date picker | Sets `scheduledPostDate`, clears `postedDate` and `soldDate` |
| **Set Status → Posted** | Confirmation only | Sets `postedDate = today`, clears `soldDate` |
| **Set Category** | Picker from existing categories | Sets `category` field on selected items |
| **Set Site** | Picker from existing sites | Sets `site` field on selected items |

> **Note:** "Mark as Sold" is intentionally excluded from bulk actions because each item needs its own selling price. This keeps the feature simple and avoids data-entry mistakes.

---

## Files to Create / Modify

### 1. InventoryViewModel — Add selection state & bulk operations
**File:** `viewmodel/InventoryViewModel.kt`

Changes:
- Add `_selectedItemIds: MutableStateFlow<Set<Long>>` — the set of currently selected item IDs
- Add `isSelectionMode: StateFlow<Boolean>` — derived from `selectedItemIds.isNotEmpty()`
- Add `selectedCount: StateFlow<Int>` — derived count for the toolbar
- Add methods:
  - `toggleItemSelection(itemId: Long)`
  - `selectAll()` / `deselectAll()`
  - `clearSelection()` (exits selection mode)
  - `bulkSetStatus(status: ItemStatus)` — updates matching date fields via repository
  - `bulkSetScheduled(date: LocalDate)` — sets scheduledPostDate
  - `bulkSetCategory(category: String)`
  - `bulkSetSite(site: String)`

### 2. InventoryRepository — Add bulk update queries
**File:** `data/repository/InventoryRepository.kt`

Changes:
- Add methods that delegate to new DAO queries:
  - `bulkClearToInventory(ids: List<Long>)`
  - `bulkMarkAsPosted(ids: List<Long>, date: LocalDate)`
  - `bulkMarkAsScheduled(ids: List<Long>, date: LocalDate)`
  - `bulkUpdateCategory(ids: List<Long>, category: String)`
  - `bulkUpdateSite(ids: List<Long>, site: String)`

### 3. InventoryDao — Add bulk SQL updates
**File:** `data/local/InventoryDao.kt`

New queries (using `@Query` with `IN` clause):
```kotlin
@Query("UPDATE inventory_items SET scheduledPostDate = NULL, postedDate = NULL, soldDate = NULL, sellingPrice = NULL, updatedAt = :now WHERE id IN (:ids)")
suspend fun bulkClearToInventory(ids: List<Long>, now: Long)

@Query("UPDATE inventory_items SET postedDate = :date, soldDate = NULL, sellingPrice = NULL, updatedAt = :now WHERE id IN (:ids)")
suspend fun bulkMarkAsPosted(ids: List<Long>, date: String, now: Long)

@Query("UPDATE inventory_items SET scheduledPostDate = :date, postedDate = NULL, soldDate = NULL, sellingPrice = NULL, updatedAt = :now WHERE id IN (:ids)")
suspend fun bulkMarkAsScheduled(ids: List<Long>, date: String, now: Long)

@Query("UPDATE inventory_items SET category = :category, updatedAt = :now WHERE id IN (:ids)")
suspend fun bulkUpdateCategory(ids: List<Long>, category: String, now: Long)

@Query("UPDATE inventory_items SET site = :site, updatedAt = :now WHERE id IN (:ids)")
suspend fun bulkUpdateSite(ids: List<Long>, site: String, now: Long)
```

### 4. InventoryScreen — Selection mode UI
**File:** `ui/screens/inventory/InventoryScreen.kt`

Changes:
- Read selection state from ViewModel (`selectedItemIds`, `isSelectionMode`)
- **When in selection mode:**
  - Replace the top app bar with a **selection toolbar** showing: [X close] "3 selected" [Select All toggle]
  - Hide the search bar and filter chips (or keep them — TBD, but hiding simplifies the UX)
  - Disable swipe gestures on cards (selection mode only uses taps)
  - Show a **bottom action bar** with the bulk action buttons
- **Item tap behavior changes:**
  - Normal mode: tap → navigate to detail (existing behavior)
  - Selection mode: tap → toggle selection
- **Long-press on any item:** enters selection mode and selects that item
- Pass `isSelected` and `isSelectionMode` flags down to each list item

### 5. ItemCard — Add selection visual indicator
**File:** `ui/components/ItemCard.kt`

Changes:
- Accept new parameters: `isSelected: Boolean = false`, `isSelectionMode: Boolean = false`
- When `isSelectionMode` is true, show a **checkbox** on the leading edge (before or overlaid on the image)
- When `isSelected` is true, the checkbox is filled and the card gets a subtle tinted border/background using the primary color
- The checkbox is a `Checkbox` composable from Material 3

### 6. SwipeableItemCard — Disable swipe in selection mode
**File:** `ui/components/SwipeableItemCard.kt`

Changes:
- Accept `isSelectionMode: Boolean = false`
- When `isSelectionMode` is true, disable the swipe-to-dismiss anchors (no swipe actions available)
- Pass through long-press and tap events appropriately

### 7. New: BulkActionBar composable
**File:** `ui/components/BulkActionBar.kt` *(new file)*

A bottom bar composable with:
- Row of action buttons/chips: "Status", "Category", "Site"
- "Status" opens a sub-menu or dialog with: In Stock, Scheduled, Posted
- "Category" opens a picker dialog listing existing categories
- "Site" opens a picker dialog listing existing sites
- Styled consistently with the app's vintage theme (Burgundy primary, Cream background)

### 8. New: BulkActionDialogs composables
**File:** `ui/components/BulkActionDialogs.kt` *(new file)*

Dialogs for each action:
- **BulkStatusDialog** — Radio buttons for In Stock / Scheduled / Posted, with a date picker shown when Scheduled is selected
- **BulkCategoryDialog** — List of categories from CategoryRepository with radio selection
- **BulkSiteDialog** — List of sites from SiteRepository with radio selection
- Each dialog has Cancel / Apply buttons
- Apply triggers the ViewModel method and clears selection

---

## Interaction Details

### Long-press detection
- Use `Modifier.combinedClickable(onLongClick = { ... }, onClick = { ... })` on each item card
- `onLongClick` → enters selection mode + selects item
- `onClick` → if in selection mode, toggle selection; otherwise navigate to detail

### Selection toolbar (replaces top app bar)
```
[X]  3 selected                    [Select All]
```
- X button calls `clearSelection()`
- "Select All" toggles between select all visible (filtered) items and deselect all
- Uses `TopAppBar` with `navigationIcon` = close, `actions` = select all button

### Bottom bulk action bar
```
┌─────────────────────────────────────────┐
│  [Status ▾]    [Category ▾]    [Site ▾] │
└─────────────────────────────────────────┘
```
- Three buttons in a `Row`, evenly spaced
- Each opens its respective dialog
- Bar uses `BottomAppBar` or a simple `Surface` pinned to bottom

### After action completes
- Show a brief `Snackbar`: "Updated 3 items"
- Clear selection (exit selection mode)
- List refreshes automatically via Room's Flow-based queries

---

## Implementation Order

1. **DAO + Repository** — bulk update queries (data layer, testable independently)
2. **ViewModel** — selection state + bulk action methods
3. **ItemCard + SwipeableItemCard** — visual selection indicators + long-press
4. **InventoryScreen** — wire up selection mode, toolbar swap, tap behavior
5. **BulkActionBar + Dialogs** — new composables for the action UI
6. **Integration** — connect everything, snackbar feedback
7. **Polish** — animations for entering/exiting selection mode, haptic feedback on long-press

---

## Edge Cases & Considerations

- **Filtered list + select all:** "Select All" only selects items currently visible (matching search/filter). This avoids accidentally modifying items the user can't see.
- **Empty selection:** If the user deselects all items manually, exit selection mode automatically.
- **Back button:** Pressing system back while in selection mode exits selection mode (doesn't navigate away). Uses `BackHandler` composable.
- **Sold items in selection:** If some selected items are already Sold and the user picks "Set Status → Posted", the sold status is overwritten. This is intentional — the user explicitly chose this action. But we should show a confirmation if any selected items are Sold ("X items are currently Sold. Change them anyway?").
- **Room IN clause limit:** SQLite has a limit of ~999 variables in an IN clause. For very large inventories, we may need to batch the IDs. Unlikely for this app's scale but worth noting.
- **Haptic feedback:** Add `HapticFeedback.performHapticFeedback(HapticFeedbackType.LongPress)` when entering selection mode for tactile confirmation.
- **Accessibility:** Ensure checkboxes have proper content descriptions ("Selected" / "Not selected") and the selection count is announced.
