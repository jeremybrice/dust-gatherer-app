package com.dustgatherer.app.viewmodel

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.dustgatherer.app.data.model.InventoryItem
import com.dustgatherer.app.data.repository.InventoryRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate

data class ItemFormState(
    val title: String = "",
    val description: String = "",
    val purchasePrice: String = "",
    val sellingPrice: String = "",
    val purchaseDate: LocalDate = LocalDate.now(),
    val scheduledPostDate: LocalDate? = null,
    val postedDate: LocalDate? = null,
    val soldDate: LocalDate? = null,
    val purchaseLocation: String = "",
    val category: String = "",
    val notes: String = "",
    val imagePath: String? = null,
    val isEditing: Boolean = false,
    val editingItemId: Long? = null
) {
    val isValid: Boolean
        get() = title.isNotBlank() && purchasePrice.toDoubleOrNull() != null

    val isSold: Boolean
        get() = soldDate != null

    val isPosted: Boolean
        get() = postedDate != null

    val canMarkAsSold: Boolean
        get() = isEditing && !isSold

    val canMarkAsPosted: Boolean
        get() = isEditing && !isSold && !isPosted
}

class ItemDetailViewModel(private val repository: InventoryRepository) : ViewModel() {

    private val _formState = MutableStateFlow(ItemFormState())
    val formState: StateFlow<ItemFormState> = _formState.asStateFlow()

    private val _saveSuccess = MutableSharedFlow<Boolean>()
    val saveSuccess: SharedFlow<Boolean> = _saveSuccess.asSharedFlow()

    fun loadItem(itemId: Long) {
        viewModelScope.launch {
            repository.getItemById(itemId)?.let { item ->
                _formState.value = ItemFormState(
                    title = item.title,
                    description = item.description,
                    purchasePrice = item.purchasePrice.toString(),
                    sellingPrice = item.sellingPrice?.toString() ?: "",
                    purchaseDate = item.purchaseDate,
                    scheduledPostDate = item.scheduledPostDate,
                    postedDate = item.postedDate,
                    soldDate = item.soldDate,
                    purchaseLocation = item.purchaseLocation,
                    category = item.category,
                    notes = item.notes,
                    imagePath = item.imagePath,
                    isEditing = true,
                    editingItemId = item.id
                )
            }
        }
    }

    fun updateTitle(title: String) {
        _formState.value = _formState.value.copy(title = title)
    }

    fun updateDescription(description: String) {
        _formState.value = _formState.value.copy(description = description)
    }

    fun updatePurchasePrice(price: String) {
        _formState.value = _formState.value.copy(purchasePrice = price)
    }

    fun updateSellingPrice(price: String) {
        _formState.value = _formState.value.copy(sellingPrice = price)
    }

    fun updatePurchaseDate(date: LocalDate) {
        _formState.value = _formState.value.copy(purchaseDate = date)
    }

    fun updateScheduledPostDate(date: LocalDate?) {
        _formState.value = _formState.value.copy(scheduledPostDate = date)
    }

    fun updatePurchaseLocation(location: String) {
        _formState.value = _formState.value.copy(purchaseLocation = location)
    }

    fun updateCategory(category: String) {
        _formState.value = _formState.value.copy(category = category)
    }

    fun updateNotes(notes: String) {
        _formState.value = _formState.value.copy(notes = notes)
    }

    fun updateImagePath(path: String?) {
        _formState.value = _formState.value.copy(imagePath = path)
    }

    fun saveItem() {
        val state = _formState.value
        if (!state.isValid) return

        viewModelScope.launch {
            val item = InventoryItem(
                id = state.editingItemId ?: 0,
                title = state.title,
                description = state.description,
                purchasePrice = state.purchasePrice.toDoubleOrNull() ?: 0.0,
                sellingPrice = state.sellingPrice.toDoubleOrNull(),
                purchaseDate = state.purchaseDate,
                scheduledPostDate = state.scheduledPostDate,
                purchaseLocation = state.purchaseLocation,
                category = state.category,
                notes = state.notes,
                imagePath = state.imagePath
            )

            if (state.isEditing && state.editingItemId != null) {
                repository.updateItem(item)
            } else {
                repository.insertItem(item)
            }

            _saveSuccess.emit(true)
        }
    }

    fun resetForm() {
        _formState.value = ItemFormState()
    }

    fun markAsSold(sellingPrice: Double) {
        val state = _formState.value
        if (!state.isEditing || state.editingItemId == null) return

        viewModelScope.launch {
            repository.getItemById(state.editingItemId)?.let { item ->
                repository.updateItem(
                    item.copy(
                        soldDate = LocalDate.now(),
                        sellingPrice = sellingPrice
                    )
                )
                _saveSuccess.emit(true)
            }
        }
    }

    fun markAsPosted() {
        val state = _formState.value
        if (!state.isEditing || state.editingItemId == null) return

        viewModelScope.launch {
            repository.getItemById(state.editingItemId)?.let { item ->
                repository.updateItem(
                    item.copy(postedDate = LocalDate.now())
                )
                _saveSuccess.emit(true)
            }
        }
    }

    companion object {
        fun provideFactory(repository: InventoryRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return ItemDetailViewModel(repository) as T
                }
            }
    }
}
