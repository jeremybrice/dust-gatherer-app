package com.dustgatherer.app.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.dustgatherer.app.R
import com.dustgatherer.app.data.model.InventoryItem
import com.dustgatherer.app.data.model.ItemStatus
import com.dustgatherer.app.ui.theme.Sage
import com.dustgatherer.app.ui.theme.StatusPosted

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SwipeableItemCard(
    item: InventoryItem,
    onClick: () -> Unit,
    onMarkAsPosted: () -> Unit,
    onMarkAsSold: () -> Unit,
    modifier: Modifier = Modifier
) {
    val canMarkAsPosted = item.status == ItemStatus.INVENTORY || item.status == ItemStatus.SCHEDULED
    val canMarkAsSold = item.status != ItemStatus.SOLD

    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { dismissValue ->
            when (dismissValue) {
                SwipeToDismissBoxValue.StartToEnd -> {
                    // Swipe right -> Mark as Posted
                    if (canMarkAsPosted) {
                        onMarkAsPosted()
                    }
                    false // Don't actually dismiss, just trigger the action
                }
                SwipeToDismissBoxValue.EndToStart -> {
                    // Swipe left -> Mark as Sold
                    if (canMarkAsSold) {
                        onMarkAsSold()
                    }
                    false // Don't actually dismiss
                }
                SwipeToDismissBoxValue.Settled -> false
            }
        },
        positionalThreshold = { it * 0.4f }
    )

    SwipeToDismissBox(
        state = dismissState,
        modifier = modifier,
        backgroundContent = {
            val direction = dismissState.dismissDirection

            val color by animateColorAsState(
                when (dismissState.targetValue) {
                    SwipeToDismissBoxValue.StartToEnd -> if (canMarkAsPosted) StatusPosted.copy(alpha = 0.2f) else Color.Transparent
                    SwipeToDismissBoxValue.EndToStart -> if (canMarkAsSold) Sage.copy(alpha = 0.2f) else Color.Transparent
                    SwipeToDismissBoxValue.Settled -> Color.Transparent
                },
                label = "swipe_color"
            )

            val alignment = when (direction) {
                SwipeToDismissBoxValue.StartToEnd -> Alignment.CenterStart
                SwipeToDismissBoxValue.EndToStart -> Alignment.CenterEnd
                else -> Alignment.Center
            }

            val icon = when (direction) {
                SwipeToDismissBoxValue.StartToEnd -> Icons.Default.Sell
                SwipeToDismissBoxValue.EndToStart -> Icons.Default.CheckCircle
                else -> Icons.Default.Sell
            }

            val text = when (direction) {
                SwipeToDismissBoxValue.StartToEnd -> stringResource(R.string.mark_as_posted)
                SwipeToDismissBoxValue.EndToStart -> stringResource(R.string.mark_as_sold)
                else -> ""
            }

            val showContent = when (direction) {
                SwipeToDismissBoxValue.StartToEnd -> canMarkAsPosted
                SwipeToDismissBoxValue.EndToStart -> canMarkAsSold
                else -> false
            }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(color)
                    .padding(horizontal = 20.dp),
                contentAlignment = alignment
            ) {
                if (showContent) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (direction == SwipeToDismissBoxValue.StartToEnd) {
                            Icon(icon, contentDescription = null, tint = StatusPosted)
                            Text(text, color = StatusPosted)
                        } else {
                            Text(text, color = Sage)
                            Icon(icon, contentDescription = null, tint = Sage)
                        }
                    }
                }
            }
        },
        content = {
            ItemCard(
                item = item,
                onClick = onClick
            )
        },
        enableDismissFromStartToEnd = canMarkAsPosted,
        enableDismissFromEndToStart = canMarkAsSold
    )
}
