# Plan: Redesign Financial Summary on Analytics Screen

## The Problem

The current financial summary conflates two different things:

- **Total Spent** = cost of ALL items ever purchased (sold + unsold)
- **Total Revenue** = income from sold items only
- **Net Profit** = Revenue - Total Spent (unfairly penalizes you for unsold inventory)
- **Margin** = Profit / Revenue (distorted because "profit" includes unsold inventory costs)

This means if you buy 10 items at $10 each ($100 total) and sell 2 for $25 each ($50 revenue), the current screen shows a **-$50 net loss** and no meaningful margin. But in reality, you still have 8 items worth $80 in inventory — you haven't lost that money, it's sitting on your shelf as stock.

## The Fix: Separate Expenses/Inventory from Sales Performance

Restructure the Financial Summary section into two distinct conceptual groups.

---

## Step 1: Add COGS query to DAO

**File:** `app/src/main/java/com/dustgatherer/app/data/local/InventoryDao.kt`

Add after line 56 (after `getTotalRevenue`):

```kotlin
    @Query("SELECT SUM(purchasePrice) FROM inventory_items WHERE soldDate IS NOT NULL")
    fun getCostOfGoodsSold(): Flow<Double?>
```

This is the only new SQL query. It sums the purchase price of sold items only — the true cost basis for profit/margin calculations. Inventory value is derived as `totalSpent - COGS`.

---

## Step 2: Expose COGS in the Repository

**File:** `app/src/main/java/com/dustgatherer/app/data/repository/InventoryRepository.kt`

Add after line 42 (after `getTotalRevenue`):

```kotlin
    fun getCostOfGoodsSold(): Flow<Double?> = inventoryDao.getCostOfGoodsSold()
```

---

## Step 3: Add COGS StateFlow to ViewModel

**File:** `app/src/main/java/com/dustgatherer/app/viewmodel/InventoryViewModel.kt`

Add after line 56 (after `totalRevenue` StateFlow):

```kotlin
    val costOfGoodsSold: StateFlow<Double> = repository.getCostOfGoodsSold()
        .map { it ?: 0.0 }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)
```

---

## Step 4: Add new string resources

**File:** `app/src/main/res/values/strings.xml`

Replace the Analytics Screen section (lines 96-109) with:

```xml
    <!-- Analytics Screen -->
    <string name="investment_overview">Investment Overview</string>
    <string name="total_expenses">Total Expenses</string>
    <string name="inventory_value">Inventory Value</string>
    <string name="total_revenue">Total Revenue</string>
    <string name="net_position">Net Position</string>
    <string name="sales_performance">Sales Performance</string>
    <string name="cost_of_goods_sold">Cost of Goods Sold</string>
    <string name="sales_revenue">Sales Revenue</string>
    <string name="sales_profit">Sales Profit</string>
    <string name="margin_percent">%1$s%% margin</string>
    <string name="inventory_status">Inventory Status</string>
    <string name="total_items">Total Items</string>
    <string name="active_listings">Active Listings</string>
    <string name="items_sold">Items Sold</string>
    <string name="sell_through_rate">Sell-Through Rate</string>
    <string name="averages">Averages</string>
    <string name="avg_purchase">Avg. Purchase</string>
    <string name="avg_sale">Avg. Sale</string>
    <string name="avg_profit">Avg. Profit</string>
```

Removed strings: `financial_summary`, `total_spent`, `net_profit`
Added strings: `investment_overview`, `total_expenses`, `inventory_value`, `net_position`, `sales_performance`, `cost_of_goods_sold`, `sales_revenue`, `sales_profit`, `avg_profit`

---

## Step 5: Rewrite AnalyticsScreen UI

**File:** `app/src/main/java/com/dustgatherer/app/ui/screens/analytics/AnalyticsScreen.kt`

### 5a. Add new state collection (after existing collectAsState calls, line 38)

```kotlin
    val costOfGoodsSold by viewModel.costOfGoodsSold.collectAsState()
```

### 5b. Replace derived calculations (replace lines 40-41)

Remove:
```kotlin
    val profit = totalRevenue - totalSpent
    val profitMargin = if (totalRevenue > 0) (profit / totalRevenue) * 100 else 0.0
```

Replace with:
```kotlin
    val inventoryValue = totalSpent - costOfGoodsSold
    val salesProfit = totalRevenue - costOfGoodsSold
    val salesMargin = if (totalRevenue > 0) (salesProfit / totalRevenue) * 100 else 0.0
    val netPosition = salesProfit // Revenue + InventoryValue - TotalExpenses simplifies to this
```

### 5c. Replace "Financial Summary" section (lines 64-134)

Remove the old Financial Summary header, the Total Spent / Total Revenue row, and the Net Profit card.

Replace with two new sections:

**Section 1 — Investment Overview:**

```kotlin
            // Investment Overview
            Text(
                text = stringResource(R.string.investment_overview),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    title = stringResource(R.string.total_expenses),
                    value = "$${String.format("%.2f", totalSpent)}",
                    icon = Icons.Default.ShoppingCart,
                    iconTint = Taupe,
                    modifier = Modifier.weight(1f)
                )

                StatCard(
                    title = stringResource(R.string.inventory_value),
                    value = "$${String.format("%.2f", inventoryValue)}",
                    icon = Icons.Default.Warehouse,
                    iconTint = StatusScheduled,
                    modifier = Modifier.weight(1f)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    title = stringResource(R.string.total_revenue),
                    value = "$${String.format("%.2f", totalRevenue)}",
                    icon = Icons.Default.AttachMoney,
                    iconTint = Sage,
                    modifier = Modifier.weight(1f)
                )

                // Net Position card
                StatCard(
                    title = stringResource(R.string.net_position),
                    value = "${if (netPosition >= 0) "+" else ""}$${String.format("%.2f", netPosition)}",
                    icon = Icons.Default.AccountBalance,
                    iconTint = if (netPosition >= 0) Sage else MaterialTheme.colorScheme.error,
                    modifier = Modifier.weight(1f)
                )
            }
```

**Section 2 — Sales Performance (only shown when soldItemCount > 0):**

```kotlin
            // Sales Performance (only when there are sales)
            if (soldItemCount > 0) {
                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = stringResource(R.string.sales_performance),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        title = stringResource(R.string.cost_of_goods_sold),
                        value = "$${String.format("%.2f", costOfGoodsSold)}",
                        icon = Icons.Default.Receipt,
                        iconTint = Taupe,
                        modifier = Modifier.weight(1f)
                    )

                    StatCard(
                        title = stringResource(R.string.sales_revenue),
                        value = "$${String.format("%.2f", totalRevenue)}",
                        icon = Icons.Default.AttachMoney,
                        iconTint = Sage,
                        modifier = Modifier.weight(1f)
                    )
                }

                // Sales Profit card with margin badge
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = if (salesProfit >= 0) Sage.copy(alpha = 0.1f)
                        else MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = stringResource(R.string.sales_profit),
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            )
                            Text(
                                text = "${if (salesProfit >= 0) "+" else ""}$${String.format("%.2f", salesProfit)}",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (salesProfit >= 0) Sage else MaterialTheme.colorScheme.error
                            )
                        }
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (salesProfit >= 0) Sage else MaterialTheme.colorScheme.error
                        ) {
                            Text(
                                text = stringResource(R.string.margin_percent, String.format("%.1f", salesMargin)),
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                style = MaterialTheme.typography.labelMedium,
                                color = Color.White
                            )
                        }
                    }
                }
            }
```

### 5d. Fix Averages section (lines 240-242)

Replace:
```kotlin
                val avgPurchasePrice = if (totalItemCount > 0) totalSpent / totalItemCount else 0.0
                val avgSalePrice = if (soldItemCount > 0) totalRevenue / soldItemCount else 0.0
                val avgProfit = if (soldItemCount > 0) profit / soldItemCount else 0.0
```

With:
```kotlin
                val avgPurchasePrice = if (totalItemCount > 0) totalSpent / totalItemCount else 0.0
                val avgSalePrice = if (soldItemCount > 0) totalRevenue / soldItemCount else 0.0
                val avgProfit = if (soldItemCount > 0) salesProfit / soldItemCount else 0.0
```

And add a third stat card for Avg. Profit after the existing Avg. Purchase / Avg. Sale row (this was previously calculated but never displayed as a card):

```kotlin
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        title = stringResource(R.string.avg_profit),
                        value = "${if (avgProfit >= 0) "+" else ""}$${String.format("%.2f", avgProfit)}",
                        icon = Icons.Default.TrendingUp,
                        iconTint = if (avgProfit >= 0) Sage else MaterialTheme.colorScheme.error,
                        modifier = Modifier.weight(1f)
                    )

                    // Empty weight spacer to keep card at half-width, consistent with other rows
                    Spacer(modifier = Modifier.weight(1f))
                }
```

---

## What Does NOT Change

- **Database schema** — no migration needed, this is just a new query on existing columns
- **InventoryItem model** — no changes
- **Other screens** — no impact
- **Inventory Status section** — unchanged (Total Items, Active Listings, Items Sold, In Stock, Sell-Through Rate)
- **Sell-through rate** — unchanged

## Visual Layout Summary

```
┌─────────────────────────────────────┐
│ INVESTMENT OVERVIEW                 │
│ ┌─────────────┐ ┌─────────────────┐ │
│ │Total Expenses│ │ Inventory Value │ │
│ │   $500.00    │ │    $350.00      │ │
│ └─────────────┘ └─────────────────┘ │
│ ┌─────────────┐ ┌─────────────────┐ │
│ │Total Revenue │ │  Net Position   │ │
│ │   $200.00    │ │    +$50.00      │ │
│ └─────────────┘ └─────────────────┘ │
│                                     │
│ SALES PERFORMANCE  (if sales exist) │
│ ┌─────────────┐ ┌─────────────────┐ │
│ │    COGS     │ │ Sales Revenue    │ │
│ │   $150.00    │ │    $200.00      │ │
│ └─────────────┘ └─────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Sales Profit    [33.3% margin]  │ │
│ │ +$50.00                         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ INVENTORY STATUS  (unchanged)       │
│ ...                                 │
│                                     │
│ AVERAGES                            │
│ ┌─────────────┐ ┌─────────────────┐ │
│ │ Avg Purchase│ │   Avg Sale      │ │
│ └─────────────┘ └─────────────────┘ │
│ ┌─────────────┐                     │
│ │ Avg Profit  │                     │
│ └─────────────┘                     │
└─────────────────────────────────────┘
```

## Files Modified (5 files)

1. `InventoryDao.kt` — 2 lines added
2. `InventoryRepository.kt` — 1 line added
3. `InventoryViewModel.kt` — 3 lines added
4. `strings.xml` — replace analytics section (net add ~5 strings)
5. `AnalyticsScreen.kt` — rewrite financial sections, fix averages
