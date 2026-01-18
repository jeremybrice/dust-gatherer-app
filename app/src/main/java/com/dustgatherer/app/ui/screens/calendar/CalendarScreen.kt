package com.dustgatherer.app.ui.screens.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.dustgatherer.app.R
import com.dustgatherer.app.data.model.InventoryItem
import com.dustgatherer.app.ui.components.ItemCard
import com.dustgatherer.app.ui.theme.StatusScheduled
import com.dustgatherer.app.viewmodel.CalendarViewModel
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(
    viewModel: CalendarViewModel,
    onItemClick: (Long) -> Unit,
    onSettingsClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val currentMonth by viewModel.currentMonth.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val scheduledItems by viewModel.scheduledItems.collectAsState()
    val selectedDateItems by viewModel.selectedDateItems.collectAsState()
    val unscheduledItems by viewModel.unscheduledItems.collectAsState()

    var showUnscheduledSheet by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.schedule)) },
                actions = {
                    if (unscheduledItems.isNotEmpty()) {
                        TextButton(onClick = { showUnscheduledSheet = true }) {
                            Text(stringResource(R.string.unscheduled_count, unscheduledItems.size))
                        }
                    }
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
        ) {
            // Month navigation
            MonthHeader(
                currentMonth = currentMonth,
                onPreviousMonth = { viewModel.goToPreviousMonth() },
                onNextMonth = { viewModel.goToNextMonth() }
            )

            // Calendar grid
            CalendarGrid(
                currentMonth = currentMonth,
                selectedDate = selectedDate,
                scheduledItems = scheduledItems,
                onDateClick = { viewModel.selectDate(it) }
            )

            Divider(modifier = Modifier.padding(vertical = 8.dp))

            // Selected date items or quick schedule options
            if (selectedDate != null) {
                Text(
                    text = selectedDate!!.format(DateTimeFormatter.ofPattern("EEEE, MMMM d")),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )

                if (selectedDateItems.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = stringResource(R.string.no_items_scheduled),
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(selectedDateItems, key = { it.id }) { item ->
                            ItemCard(item = item, onClick = { onItemClick(item.id) })
                        }
                    }
                }
            } else {
                // Show quick posting day shortcuts
                QuickScheduleSection(
                    viewModel = viewModel,
                    scheduledItems = scheduledItems
                )
            }
        }
    }

    // Bottom sheet for unscheduled items
    if (showUnscheduledSheet) {
        ModalBottomSheet(
            onDismissRequest = { showUnscheduledSheet = false }
        ) {
            UnscheduledItemsSheet(
                items = unscheduledItems,
                viewModel = viewModel,
                onItemClick = { id ->
                    showUnscheduledSheet = false
                    onItemClick(id)
                },
                onDismiss = { showUnscheduledSheet = false }
            )
        }
    }
}

@Composable
private fun MonthHeader(
    currentMonth: YearMonth,
    onPreviousMonth: () -> Unit,
    onNextMonth: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onPreviousMonth) {
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = stringResource(R.string.previous_month))
        }

        Text(
            text = currentMonth.format(DateTimeFormatter.ofPattern("MMMM yyyy")),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold
        )

        IconButton(onClick = onNextMonth) {
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = stringResource(R.string.next_month))
        }
    }
}

@Composable
private fun CalendarGrid(
    currentMonth: YearMonth,
    selectedDate: LocalDate?,
    scheduledItems: Map<LocalDate, List<InventoryItem>>,
    onDateClick: (LocalDate) -> Unit
) {
    val daysOfWeek = listOf("S", "M", "T", "W", "T", "F", "S")
    val postingDays = setOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY)

    Column(modifier = Modifier.padding(horizontal = 8.dp)) {
        // Day headers
        Row(modifier = Modifier.fillMaxWidth()) {
            daysOfWeek.forEach { day ->
                Text(
                    text = day,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Calendar days
        val firstDayOfMonth = currentMonth.atDay(1)
        val lastDayOfMonth = currentMonth.atEndOfMonth()
        val startOffset = firstDayOfMonth.dayOfWeek.value % 7

        val days = buildList {
            repeat(startOffset) { add(null) }
            for (day in 1..lastDayOfMonth.dayOfMonth) {
                add(currentMonth.atDay(day))
            }
        }

        LazyVerticalGrid(
            columns = GridCells.Fixed(7),
            modifier = Modifier.height(240.dp),
            userScrollEnabled = false
        ) {
            items(days) { date ->
                if (date != null) {
                    val isToday = date == LocalDate.now()
                    val isSelected = date == selectedDate
                    val isPostingDay = date.dayOfWeek in postingDays
                    val hasItems = scheduledItems.containsKey(date)
                    val itemCount = scheduledItems[date]?.size ?: 0

                    CalendarDay(
                        date = date,
                        isToday = isToday,
                        isSelected = isSelected,
                        isPostingDay = isPostingDay,
                        itemCount = itemCount,
                        onClick = { onDateClick(date) }
                    )
                } else {
                    Box(modifier = Modifier.aspectRatio(1f))
                }
            }
        }
    }
}

@Composable
private fun CalendarDay(
    date: LocalDate,
    isToday: Boolean,
    isSelected: Boolean,
    isPostingDay: Boolean,
    itemCount: Int,
    onClick: () -> Unit
) {
    val backgroundColor = when {
        isSelected -> MaterialTheme.colorScheme.primary
        isToday -> MaterialTheme.colorScheme.primaryContainer
        else -> Color.Transparent
    }

    val textColor = when {
        isSelected -> MaterialTheme.colorScheme.onPrimary
        isToday -> MaterialTheme.colorScheme.onPrimaryContainer
        else -> MaterialTheme.colorScheme.onSurface
    }

    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .padding(2.dp)
            .clip(CircleShape)
            .background(backgroundColor)
            .then(
                if (isPostingDay && !isSelected && !isToday) {
                    Modifier.border(1.dp, StatusScheduled.copy(alpha = 0.5f), CircleShape)
                } else Modifier
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = date.dayOfMonth.toString(),
                style = MaterialTheme.typography.bodyMedium,
                color = textColor
            )
            if (itemCount > 0) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(if (isSelected) MaterialTheme.colorScheme.onPrimary else StatusScheduled)
                )
            }
        }
    }
}

@Composable
private fun QuickScheduleSection(
    viewModel: CalendarViewModel,
    scheduledItems: Map<LocalDate, List<InventoryItem>>
) {
    val nextPostingDays = viewModel.getNextPostingDays(6)

    Column(modifier = Modifier.padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = stringResource(R.string.upcoming_posting_days),
                style = MaterialTheme.typography.titleMedium
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(nextPostingDays) { date ->
                val itemCount = scheduledItems[date]?.size ?: 0

                PostingDayChip(
                    date = date,
                    itemCount = itemCount,
                    onClick = { viewModel.selectDate(date) }
                )
            }
        }
    }
}

@Composable
private fun PostingDayChip(
    date: LocalDate,
    itemCount: Int,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault()),
                style = MaterialTheme.typography.labelMedium
            )
            Text(
                text = date.format(DateTimeFormatter.ofPattern("MMM d")),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
            if (itemCount > 0) {
                Text(
                    text = "$itemCount item${if (itemCount > 1) "s" else ""}",
                    style = MaterialTheme.typography.labelSmall,
                    color = StatusScheduled
                )
            }
        }
    }
}

@Composable
private fun UnscheduledItemsSheet(
    items: List<InventoryItem>,
    viewModel: CalendarViewModel,
    onItemClick: (Long) -> Unit,
    onDismiss: () -> Unit
) {
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
                text = stringResource(R.string.unscheduled_items_count, items.size),
                style = MaterialTheme.typography.titleLarge
            )

            if (items.isNotEmpty()) {
                FilledTonalButton(
                    onClick = {
                        viewModel.autoScheduleItems(items)
                        onDismiss()
                    }
                ) {
                    Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.auto_schedule))
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.heightIn(max = 400.dp)
        ) {
            items(items, key = { it.id }) { item ->
                ItemCard(item = item, onClick = { onItemClick(item.id) })
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}
