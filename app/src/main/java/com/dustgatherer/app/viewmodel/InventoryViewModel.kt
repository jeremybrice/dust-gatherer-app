package com.dustgatherer.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.dustgatherer.app.data.model.InventoryItem
import com.dustgatherer.app.data.model.ItemStatus
import com.dustgatherer.app.data.repository.InventoryRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate

class InventoryViewModel(private val repository: InventoryRepository) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedFilter = MutableStateFlow<ItemStatus?>(null)
    val selectedFilter: StateFlow<ItemStatus?> = _selectedFilter.asStateFlow()

    val allItems: StateFlow<List<InventoryItem>> = repository.getAllItems()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val filteredItems: StateFlow<List<InventoryItem>> = combine(
        allItems,
        _searchQuery,
        _selectedFilter
    ) { items, query, filter ->
        items.filter { item ->
            val matchesSearch = query.isBlank() ||
                    item.title.contains(query, ignoreCase = true) ||
                    item.description.contains(query, ignoreCase = true)

            val matchesFilter = filter == null || item.status == filter

            matchesSearch && matchesFilter
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val unscheduledItems: StateFlow<List<InventoryItem>> = repository.getUnscheduledItems()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val postedItems: StateFlow<List<InventoryItem>> = repository.getPostedItems()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val soldItems: StateFlow<List<InventoryItem>> = repository.getSoldItems()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Analytics
    val totalSpent: StateFlow<Double> = repository.getTotalSpent()
        .map { it ?: 0.0 }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val totalRevenue: StateFlow<Double> = repository.getTotalRevenue()
        .map { it ?: 0.0 }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val totalItemCount: StateFlow<Int> = repository.getTotalItemCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val soldItemCount: StateFlow<Int> = repository.getSoldItemCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val activeListingsCount: StateFlow<Int> = repository.getActiveListingsCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun setFilter(status: ItemStatus?) {
        _selectedFilter.value = status
    }

    fun addItem(item: InventoryItem) {
        viewModelScope.launch {
            repository.insertItem(item)
        }
    }

    fun updateItem(item: InventoryItem) {
        viewModelScope.launch {
            repository.updateItem(item)
        }
    }

    fun deleteItem(item: InventoryItem) {
        viewModelScope.launch {
            repository.deleteItem(item)
        }
    }

    fun markAsPosted(item: InventoryItem) {
        viewModelScope.launch {
            repository.updateItem(item.copy(postedDate = LocalDate.now()))
        }
    }

    fun markAsSold(item: InventoryItem, sellingPrice: Double) {
        viewModelScope.launch {
            repository.updateItem(
                item.copy(
                    soldDate = LocalDate.now(),
                    sellingPrice = sellingPrice
                )
            )
        }
    }

    fun scheduleItem(item: InventoryItem, date: LocalDate) {
        viewModelScope.launch {
            repository.updateItem(item.copy(scheduledPostDate = date))
        }
    }

    companion object {
        fun provideFactory(repository: InventoryRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return InventoryViewModel(repository) as T
                }
            }
    }
}
