package com.dustgatherer.app.ui.screens.inventory

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.dustgatherer.app.R
import com.dustgatherer.app.data.model.InventoryItem
import com.dustgatherer.app.data.model.ItemStatus
import com.dustgatherer.app.ui.components.MarkAsSoldDialog
import com.dustgatherer.app.ui.components.SwipeableItemCard
import com.dustgatherer.app.viewmodel.InventoryViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    viewModel: InventoryViewModel,
    onItemClick: (Long) -> Unit,
    onAddClick: () -> Unit,
    onSettingsClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val items by viewModel.filteredItems.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val selectedFilter by viewModel.selectedFilter.collectAsState()

    var showFilterMenu by remember { mutableStateOf(false) }
    var showMarkAsSoldDialog by remember { mutableStateOf(false) }
    var itemToSell by remember { mutableStateOf<InventoryItem?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.inventory)) },
                actions = {
                    Box {
                        IconButton(onClick = { showFilterMenu = true }) {
                            Icon(Icons.Default.FilterList, contentDescription = stringResource(R.string.filter))
                        }
                        DropdownMenu(
                            expanded = showFilterMenu,
                            onDismissRequest = { showFilterMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.all_items)) },
                                onClick = {
                                    viewModel.setFilter(null)
                                    showFilterMenu = false
                                }
                            )
                            ItemStatus.entries.forEach { status ->
                                val statusText = when (status) {
                                    ItemStatus.INVENTORY -> stringResource(R.string.status_in_stock)
                                    ItemStatus.SCHEDULED -> stringResource(R.string.status_scheduled)
                                    ItemStatus.POSTED -> stringResource(R.string.status_posted)
                                    ItemStatus.SOLD -> stringResource(R.string.status_sold)
                                }
                                DropdownMenuItem(
                                    text = { Text(statusText) },
                                    onClick = {
                                        viewModel.setFilter(status)
                                        showFilterMenu = false
                                    }
                                )
                            }
                        }
                    }
                    IconButton(onClick = onSettingsClick) {
                        Icon(Icons.Default.Settings, contentDescription = stringResource(R.string.settings))
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onAddClick) {
                Icon(Icons.Default.Add, contentDescription = stringResource(R.string.add_item))
            }
        },
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { viewModel.setSearchQuery(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text(stringResource(R.string.search_items)) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true
            )

            // Filter indicator
            if (selectedFilter != null) {
                val filterText = when (selectedFilter) {
                    ItemStatus.INVENTORY -> stringResource(R.string.status_in_stock)
                    ItemStatus.SCHEDULED -> stringResource(R.string.status_scheduled)
                    ItemStatus.POSTED -> stringResource(R.string.status_posted)
                    ItemStatus.SOLD -> stringResource(R.string.status_sold)
                    null -> ""
                }
                FilterChip(
                    selected = true,
                    onClick = { viewModel.setFilter(null) },
                    label = { Text(filterText) },
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
            }

            // Items list
            if (items.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (searchQuery.isNotBlank()) stringResource(R.string.no_items_match_search)
                        else stringResource(R.string.no_items_yet),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(items, key = { it.id }) { item ->
                        SwipeableItemCard(
                            item = item,
                            onClick = { onItemClick(item.id) },
                            onMarkAsPosted = { viewModel.markAsPosted(item) },
                            onMarkAsSold = {
                                itemToSell = item
                                showMarkAsSoldDialog = true
                            }
                        )
                    }
                }
            }
        }
    }

    // Mark as Sold dialog
    if (showMarkAsSoldDialog && itemToSell != null) {
        MarkAsSoldDialog(
            item = itemToSell!!,
            onDismiss = {
                showMarkAsSoldDialog = false
                itemToSell = null
            },
            onConfirm = { finalPrice ->
                viewModel.markAsSold(itemToSell!!, finalPrice)
                showMarkAsSoldDialog = false
                itemToSell = null
            }
        )
    }
}
