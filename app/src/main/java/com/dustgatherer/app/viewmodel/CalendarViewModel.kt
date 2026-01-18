package com.dustgatherer.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.dustgatherer.app.data.model.InventoryItem
import com.dustgatherer.app.data.repository.InventoryRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.TemporalAdjusters

class CalendarViewModel(private val repository: InventoryRepository) : ViewModel() {

    private val _currentMonth = MutableStateFlow(YearMonth.now())
    val currentMonth: StateFlow<YearMonth> = _currentMonth.asStateFlow()

    private val _selectedDate = MutableStateFlow<LocalDate?>(null)
    val selectedDate: StateFlow<LocalDate?> = _selectedDate.asStateFlow()

    val scheduledItems: StateFlow<Map<LocalDate, List<InventoryItem>>> = _currentMonth
        .flatMapLatest { month ->
            val startDate = month.atDay(1)
            val endDate = month.atEndOfMonth()
            repository.getItemsScheduledBetween(startDate, endDate)
        }
        .map { items ->
            items.groupBy { it.scheduledPostDate!! }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    val selectedDateItems: StateFlow<List<InventoryItem>> = _selectedDate
        .flatMapLatest { date ->
            if (date != null) {
                repository.getItemsScheduledFor(date)
            } else {
                flowOf(emptyList())
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val unscheduledItems: StateFlow<List<InventoryItem>> = repository.getUnscheduledItems()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun goToNextMonth() {
        _currentMonth.value = _currentMonth.value.plusMonths(1)
    }

    fun goToPreviousMonth() {
        _currentMonth.value = _currentMonth.value.minusMonths(1)
    }

    fun selectDate(date: LocalDate?) {
        _selectedDate.value = date
    }

    fun scheduleItem(item: InventoryItem, date: LocalDate) {
        viewModelScope.launch {
            repository.updateItem(item.copy(scheduledPostDate = date))
        }
    }

    fun unscheduleItem(item: InventoryItem) {
        viewModelScope.launch {
            repository.updateItem(item.copy(scheduledPostDate = null))
        }
    }

    // Helper to get next available posting days (Mon, Wed, Fri)
    fun getNextPostingDays(count: Int = 10): List<LocalDate> {
        val postingDays = setOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY)
        val result = mutableListOf<LocalDate>()
        var currentDate = LocalDate.now()

        while (result.size < count) {
            if (currentDate.dayOfWeek in postingDays && currentDate >= LocalDate.now()) {
                result.add(currentDate)
            }
            currentDate = currentDate.plusDays(1)
        }

        return result
    }

    // Auto-schedule items to next available Mon/Wed/Fri slots
    fun autoScheduleItems(items: List<InventoryItem>) {
        viewModelScope.launch {
            val availableDates = getNextPostingDays(items.size * 2) // Get extra slots
            var dateIndex = 0

            for (item in items) {
                if (item.scheduledPostDate == null && dateIndex < availableDates.size) {
                    repository.updateItem(item.copy(scheduledPostDate = availableDates[dateIndex]))
                    dateIndex++
                }
            }
        }
    }

    companion object {
        fun provideFactory(repository: InventoryRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return CalendarViewModel(repository) as T
                }
            }
    }
}
