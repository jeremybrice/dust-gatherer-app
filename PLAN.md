# Plan: Redesign Financial Summary on Analytics Screen

## The Problem

The current financial summary conflates two different things:

- **Total Spent** = cost of ALL items ever purchased (sold + unsold)
- **Total Revenue** = income from sold items only
- **Net Profit** = Revenue - Total Spent (unfairly penalizes you for unsold inventory)
- **Margin** = Profit / Revenue (distorted because "profit" includes unsold inventory costs)

This means if you buy 10 items at $10 each ($100 total) and sell 2 for $25 each ($50 revenue), the current screen shows a **-$50 net loss** and no meaningful margin. But in reality, you still have 8 items worth $80 in inventory — you haven't lost that money, it's sitting on your shelf as stock.

## The Fix: Separate Expenses/Inventory from Sales Performance

Restructure the Financial Summary section into two distinct conceptual groups:

### Section 1: "Investment Overview" (renamed from "Financial Summary")

This answers: *"Where is my money?"*

| Metric | Formula | What it means |
|--------|---------|---------------|
| **Total Expenses** | SUM(purchasePrice) for ALL items | Everything you've ever spent on inventory |
| **Inventory Value** | SUM(purchasePrice) for UNSOLD items | Cost basis of stock you still hold |
| **Total Revenue** | SUM(sellingPrice) for SOLD items | Cash you've brought back in |

We also show a **Net Position** card: `Total Revenue + Inventory Value - Total Expenses`. This tells you whether you're "up" or "down" overall, accounting for the fact that unsold inventory still has value. (Net Position will equal the cumulative profit on sold items, since inventory value and unsold expenses cancel out — but framing it this way makes the accounting intuitive.)

### Section 2: "Sales Performance" (new section, replaces the old profit/margin card)

This answers: *"How well am I doing on the things I've actually sold?"*

| Metric | Formula | What it means |
|--------|---------|---------------|
| **Cost of Goods Sold** | SUM(purchasePrice) for SOLD items only | What you paid for the items you've sold |
| **Sales Revenue** | SUM(sellingPrice) for SOLD items | What you earned from those same items |
| **Sales Profit** | Revenue - COGS | Actual profit on completed sales |
| **Profit Margin** | (Sales Profit / Revenue) × 100 | Margin on what you've actually sold |

This section only appears when there are sold items (same as current behavior for the averages section).

### Section 3: Inventory Status (unchanged)

Stays the same: Total Items, Active Listings, Items Sold, In Stock, Sell-Through Rate.

### Section 4: Averages (updated)

| Metric | Current formula | New formula |
|--------|----------------|-------------|
| **Avg Purchase Price** | totalSpent / totalItemCount | unchanged (still useful across all items) |
| **Avg Sale Price** | totalRevenue / soldItemCount | unchanged |
| **Avg Profit Per Item** | (revenue - totalSpent) / soldItemCount | (revenue - COGS) / soldItemCount |

The key fix in averages: **Avg Profit Per Item** currently uses `totalSpent` (all items) in the numerator, making it wrong. It should use COGS (cost of sold items only).

## Implementation Changes

### Layer 1: DAO — Add one new query

**File:** `InventoryDao.kt`

Add:
```kotlin
@Query("SELECT SUM(purchasePrice) FROM inventory_items WHERE soldDate IS NOT NULL")
fun getCostOfGoodsSold(): Flow<Double?>
```

That's the only new SQL query needed. `Inventory Value` can be derived as `totalSpent - COGS` in the UI layer.

### Layer 2: Repository — Expose the new query

**File:** `InventoryRepository.kt`

Add:
```kotlin
fun getCostOfGoodsSold(): Flow<Double?> = inventoryDao.getCostOfGoodsSold()
```

### Layer 3: ViewModel — Add the new StateFlow

**File:** `InventoryViewModel.kt`

Add:
```kotlin
val costOfGoodsSold: StateFlow<Double> = repository.getCostOfGoodsSold()
    .map { it ?: 0.0 }
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)
```

### Layer 4: Analytics Screen UI — Restructure the layout

**File:** `AnalyticsScreen.kt`

Derive new values from existing + new data:
```kotlin
val costOfGoodsSold by viewModel.costOfGoodsSold.collectAsState()
val inventoryValue = totalSpent - costOfGoodsSold
val salesProfit = totalRevenue - costOfGoodsSold
val salesMargin = if (totalRevenue > 0) (salesProfit / totalRevenue) * 100 else 0.0
val netPosition = totalRevenue + inventoryValue - totalSpent  // equivalently: salesProfit
```

Rebuild the UI sections:

1. **"Investment Overview"** header → three stat cards (Total Expenses, Inventory Value, Total Revenue) + Net Position summary card
2. **"Sales Performance"** header → COGS, Revenue, Profit, Margin (only shown when soldItemCount > 0)
3. **Inventory Status** — no changes
4. **Averages** — fix Avg Profit to use `salesProfit / soldItemCount`

### Layer 5: Strings

**File:** `strings.xml`

Add new string resources:
- `investment_overview` → "Investment Overview"
- `sales_performance` → "Sales Performance"
- `total_expenses` → "Total Expenses"
- `inventory_value` → "Inventory Value"
- `cost_of_goods_sold` → "Cost of Goods Sold"
- `sales_profit` → "Sales Profit"
- `net_position` → "Net Position"

Remove or repurpose:
- `financial_summary` → replaced by `investment_overview`
- `net_profit` → replaced by `sales_profit`
- `total_spent` → replaced by `total_expenses`

## What Does NOT Change

- Database schema (no migration needed)
- InventoryItem model
- Any other screens
- The Inventory Status section
- Sell-through rate calculation

## Summary

The core insight: **one new SQL query** (`SUM(purchasePrice) WHERE soldDate IS NOT NULL`) unlocks the ability to properly separate inventory investment from sales performance. Everything else is derived math and UI restructuring.
