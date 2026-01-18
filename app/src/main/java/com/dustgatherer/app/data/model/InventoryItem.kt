package com.dustgatherer.app.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.LocalDate

@Entity(tableName = "inventory_items")
data class InventoryItem(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val title: String,
    val description: String = "",
    val purchasePrice: Double,
    val sellingPrice: Double? = null,
    val purchaseDate: LocalDate,
    val scheduledPostDate: LocalDate? = null,
    val postedDate: LocalDate? = null,
    val soldDate: LocalDate? = null,
    val imagePath: String? = null,
    val purchaseLocation: String = "",
    val category: String = "",
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
) {
    val status: ItemStatus
        get() = when {
            soldDate != null -> ItemStatus.SOLD
            postedDate != null -> ItemStatus.POSTED
            scheduledPostDate != null -> ItemStatus.SCHEDULED
            else -> ItemStatus.INVENTORY
        }

    val profit: Double?
        get() = if (sellingPrice != null && soldDate != null) {
            sellingPrice - purchasePrice
        } else null
}

enum class ItemStatus {
    INVENTORY,  // In stock, not yet scheduled
    SCHEDULED,  // Scheduled for posting
    POSTED,     // Posted on Etsy
    SOLD        // Sold
}
