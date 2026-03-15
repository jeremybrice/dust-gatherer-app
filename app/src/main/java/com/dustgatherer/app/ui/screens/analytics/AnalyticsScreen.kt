package com.dustgatherer.app.ui.screens.analytics

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.dustgatherer.app.R
import com.dustgatherer.app.ui.theme.Sage
import com.dustgatherer.app.ui.theme.StatusPosted
import com.dustgatherer.app.ui.theme.StatusScheduled
import com.dustgatherer.app.ui.theme.Taupe
import com.dustgatherer.app.viewmodel.InventoryViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(
    viewModel: InventoryViewModel,
    onSettingsClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val totalSpent by viewModel.totalSpent.collectAsState()
    val totalRevenue by viewModel.totalRevenue.collectAsState()
    val costOfGoodsSold by viewModel.costOfGoodsSold.collectAsState()
    val totalItemCount by viewModel.totalItemCount.collectAsState()
    val soldItemCount by viewModel.soldItemCount.collectAsState()
    val activeListingsCount by viewModel.activeListingsCount.collectAsState()

    val inventoryValue = totalSpent - costOfGoodsSold
    val salesProfit = totalRevenue - costOfGoodsSold
    val salesMargin = if (totalRevenue > 0) (salesProfit / totalRevenue) * 100 else 0.0
    val netPosition = salesProfit

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.analytics)) },
                actions = {
                    IconButton(onClick = onSettingsClick) {
                        Icon(Icons.Default.Settings, contentDescription = stringResource(R.string.settings))
                    }
                }
            )
        },
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
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

                StatCard(
                    title = stringResource(R.string.net_position),
                    value = "${if (netPosition >= 0) "+" else ""}$${String.format("%.2f", netPosition)}",
                    icon = Icons.Default.AccountBalance,
                    iconTint = if (netPosition >= 0) Sage else MaterialTheme.colorScheme.error,
                    modifier = Modifier.weight(1f)
                )
            }

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

            Spacer(modifier = Modifier.height(8.dp))

            // Inventory stats
            Text(
                text = stringResource(R.string.inventory_status),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    title = stringResource(R.string.total_items),
                    value = totalItemCount.toString(),
                    icon = Icons.Default.Inventory2,
                    iconTint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.weight(1f)
                )

                StatCard(
                    title = stringResource(R.string.active_listings),
                    value = activeListingsCount.toString(),
                    icon = Icons.Default.Sell,
                    iconTint = StatusPosted,
                    modifier = Modifier.weight(1f)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    title = stringResource(R.string.items_sold),
                    value = soldItemCount.toString(),
                    icon = Icons.Default.CheckCircle,
                    iconTint = Sage,
                    modifier = Modifier.weight(1f)
                )

                val unsoldCount = totalItemCount - soldItemCount
                StatCard(
                    title = stringResource(R.string.status_in_stock),
                    value = unsoldCount.toString(),
                    icon = Icons.Default.Warehouse,
                    iconTint = StatusScheduled,
                    modifier = Modifier.weight(1f)
                )
            }

            // Sell-through rate
            if (totalItemCount > 0) {
                Spacer(modifier = Modifier.height(8.dp))

                val sellThroughRate = (soldItemCount.toDouble() / totalItemCount) * 100

                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = stringResource(R.string.sell_through_rate),
                                style = MaterialTheme.typography.labelLarge
                            )
                            Text(
                                text = "${String.format("%.1f", sellThroughRate)}%",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        LinearProgressIndicator(
                            progress = { (sellThroughRate / 100).toFloat() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp),
                            color = Sage,
                            trackColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    }
                }
            }

            // Average prices
            if (soldItemCount > 0) {
                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = stringResource(R.string.averages),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )

                val avgPurchasePrice = if (totalItemCount > 0) totalSpent / totalItemCount else 0.0
                val avgSalePrice = if (soldItemCount > 0) totalRevenue / soldItemCount else 0.0
                val avgProfit = if (soldItemCount > 0) salesProfit / soldItemCount else 0.0

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        title = stringResource(R.string.avg_purchase),
                        value = "$${String.format("%.2f", avgPurchasePrice)}",
                        icon = Icons.Default.TrendingDown,
                        iconTint = Taupe,
                        modifier = Modifier.weight(1f)
                    )

                    StatCard(
                        title = stringResource(R.string.avg_sale),
                        value = "$${String.format("%.2f", avgSalePrice)}",
                        icon = Icons.Default.TrendingUp,
                        iconTint = Sage,
                        modifier = Modifier.weight(1f)
                    )
                }

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

                    Spacer(modifier = Modifier.weight(1f))
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun StatCard(
    title: String,
    value: String,
    icon: ImageVector,
    iconTint: Color,
    modifier: Modifier = Modifier
) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.Start
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}
