package com.dustgatherer.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.dustgatherer.app.R
import com.dustgatherer.app.data.model.InventoryItem
import com.dustgatherer.app.data.model.ItemStatus
import com.dustgatherer.app.ui.theme.*
import java.time.format.DateTimeFormatter

@Composable
fun ItemCard(
    item: InventoryItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Item image or placeholder
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                if (item.imagePath != null) {
                    AsyncImage(
                        model = item.imagePath,
                        contentDescription = item.title,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Inventory2,
                        contentDescription = null,
                        modifier = Modifier.size(32.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    )
                }
            }

            // Item details
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Text(
                    text = stringResource(R.string.bought_price, String.format("%.2f", item.purchasePrice)),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )

                // Show price based on sold status
                if (item.sellingPrice != null) {
                    if (item.status == ItemStatus.SOLD) {
                        // Item is actually sold - show in green
                        Text(
                            text = stringResource(R.string.sold_price, String.format("%.2f", item.sellingPrice)),
                            style = MaterialTheme.typography.bodyMedium,
                            color = StatusSold
                        )
                    } else {
                        // Item has asking price but not sold yet
                        Text(
                            text = stringResource(R.string.asking_price, String.format("%.2f", item.sellingPrice)),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                    }
                }

                // Status chip
                StatusChip(status = item.status, scheduledDate = item.scheduledPostDate)
            }
        }
    }
}

@Composable
fun StatusChip(
    status: ItemStatus,
    scheduledDate: java.time.LocalDate? = null,
    modifier: Modifier = Modifier
) {
    val inStockLabel = stringResource(R.string.status_in_stock)
    val scheduledLabel = stringResource(R.string.status_scheduled)
    val postedLabel = stringResource(R.string.status_posted)
    val soldLabel = stringResource(R.string.status_sold)

    val (backgroundColor, icon, label) = when (status) {
        ItemStatus.INVENTORY -> Triple(StatusInventory, Icons.Default.Inventory2, inStockLabel)
        ItemStatus.SCHEDULED -> Triple(
            StatusScheduled,
            Icons.Default.Schedule,
            scheduledDate?.format(DateTimeFormatter.ofPattern("MMM d")) ?: scheduledLabel
        )
        ItemStatus.POSTED -> Triple(StatusPosted, Icons.Default.Sell, postedLabel)
        ItemStatus.SOLD -> Triple(StatusSold, Icons.Default.CheckCircle, soldLabel)
    }

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        color = backgroundColor.copy(alpha = 0.15f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = backgroundColor
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = backgroundColor
            )
        }
    }
}
