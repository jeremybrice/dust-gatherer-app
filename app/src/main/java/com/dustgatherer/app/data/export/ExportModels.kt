package com.dustgatherer.app.data.export

import com.dustgatherer.app.data.model.InventoryItem
import kotlinx.serialization.Serializable
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Serializable
data class ExportManifest(
    val version: Int = CURRENT_EXPORT_VERSION,
    val appVersion: String,
    val exportDate: String,
    val itemCount: Int
) {
    companion object {
        const val CURRENT_EXPORT_VERSION = 1
    }
}

@Serializable
data class ExportInventoryItem(
    val id: Long,
    val title: String,
    val description: String,
    val purchasePrice: Double,
    val sellingPrice: Double?,
    val purchaseDate: String,
    val scheduledPostDate: String?,
    val postedDate: String?,
    val soldDate: String?,
    val imageFileName: String?,
    val purchaseLocation: String,
    val category: String,
    val notes: String,
    val createdAt: Long,
    val updatedAt: Long
) {
    companion object {
        private val dateFormatter = DateTimeFormatter.ISO_LOCAL_DATE

        fun fromInventoryItem(item: InventoryItem): ExportInventoryItem {
            return ExportInventoryItem(
                id = item.id,
                title = item.title,
                description = item.description,
                purchasePrice = item.purchasePrice,
                sellingPrice = item.sellingPrice,
                purchaseDate = item.purchaseDate.format(dateFormatter),
                scheduledPostDate = item.scheduledPostDate?.format(dateFormatter),
                postedDate = item.postedDate?.format(dateFormatter),
                soldDate = item.soldDate?.format(dateFormatter),
                imageFileName = item.imagePath?.let { extractFileName(it) },
                purchaseLocation = item.purchaseLocation,
                category = item.category,
                notes = item.notes,
                createdAt = item.createdAt,
                updatedAt = item.updatedAt
            )
        }

        private fun extractFileName(path: String): String {
            return path.substringAfterLast("/")
        }
    }

    fun toInventoryItem(newImagePath: String?): InventoryItem {
        return InventoryItem(
            id = 0, // Will be auto-generated on import
            title = title,
            description = description,
            purchasePrice = purchasePrice,
            sellingPrice = sellingPrice,
            purchaseDate = LocalDate.parse(purchaseDate, DateTimeFormatter.ISO_LOCAL_DATE),
            scheduledPostDate = scheduledPostDate?.let { LocalDate.parse(it, DateTimeFormatter.ISO_LOCAL_DATE) },
            postedDate = postedDate?.let { LocalDate.parse(it, DateTimeFormatter.ISO_LOCAL_DATE) },
            soldDate = soldDate?.let { LocalDate.parse(it, DateTimeFormatter.ISO_LOCAL_DATE) },
            imagePath = newImagePath,
            purchaseLocation = purchaseLocation,
            category = category,
            notes = notes,
            createdAt = createdAt,
            updatedAt = updatedAt
        )
    }
}

@Serializable
data class ExportData(
    val manifest: ExportManifest,
    val items: List<ExportInventoryItem>
)

enum class ImportConflictStrategy {
    SKIP_EXISTING,
    REPLACE_EXISTING,
    IMPORT_AS_NEW
}

data class ImportResult(
    val totalItems: Int,
    val importedItems: Int,
    val skippedItems: Int,
    val errors: List<String>
)
