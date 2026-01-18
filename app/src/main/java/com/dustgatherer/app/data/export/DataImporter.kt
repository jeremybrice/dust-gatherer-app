package com.dustgatherer.app.data.export

import android.content.Context
import android.net.Uri
import com.dustgatherer.app.data.repository.InventoryRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.zip.ZipInputStream

class DataImporter(
    private val context: Context,
    private val repository: InventoryRepository
) {
    private val json = Json {
        ignoreUnknownKeys = true
    }

    suspend fun previewImport(inputUri: Uri): Result<Int> = withContext(Dispatchers.IO) {
        try {
            context.contentResolver.openInputStream(inputUri)?.use { inputStream ->
                ZipInputStream(inputStream).use { zipIn ->
                    var entry = zipIn.nextEntry
                    while (entry != null) {
                        if (entry.name == "inventory.json") {
                            val jsonContent = zipIn.bufferedReader().readText()
                            val exportData = json.decodeFromString<ExportData>(jsonContent)

                            if (exportData.manifest.version > ExportManifest.CURRENT_EXPORT_VERSION) {
                                return@withContext Result.failure(
                                    Exception("Backup was created with a newer app version. Please update the app.")
                                )
                            }

                            return@withContext Result.success(exportData.manifest.itemCount)
                        }
                        entry = zipIn.nextEntry
                    }
                }
            }
            Result.failure(Exception("Invalid backup file: inventory.json not found"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun importFromZip(
        inputUri: Uri,
        conflictStrategy: ImportConflictStrategy,
        onProgress: (Float) -> Unit
    ): Result<ImportResult> = withContext(Dispatchers.IO) {
        try {
            val errors = mutableListOf<String>()
            var importedCount = 0
            var skippedCount = 0

            // First pass: read JSON and extract images
            var parsedExportData: ExportData? = null
            val extractedImages = mutableMapOf<String, String>() // originalFileName -> newAbsolutePath

            context.contentResolver.openInputStream(inputUri)?.use { inputStream ->
                ZipInputStream(inputStream).use { zipIn ->
                    var entry = zipIn.nextEntry
                    while (entry != null) {
                        when {
                            entry.name == "inventory.json" -> {
                                val jsonContent = zipIn.bufferedReader().readText()
                                parsedExportData = json.decodeFromString<ExportData>(jsonContent)
                            }
                            entry.name.startsWith("images/") && !entry.isDirectory -> {
                                val originalFileName = entry.name.substringAfter("images/")
                                val newPath = saveImageFromZip(zipIn, originalFileName)
                                if (newPath != null) {
                                    extractedImages[originalFileName] = newPath
                                }
                            }
                        }
                        zipIn.closeEntry()
                        entry = zipIn.nextEntry
                    }
                }
            } ?: return@withContext Result.failure(Exception("Could not open input stream"))

            val exportData = parsedExportData
                ?: return@withContext Result.failure(Exception("Invalid backup file: inventory.json not found"))

            // Second pass: import items
            val itemsToImport = mutableListOf<com.dustgatherer.app.data.model.InventoryItem>()

            for ((index, exportItem) in exportData.items.withIndex()) {
                try {
                    val existingItem = repository.getItemById(exportItem.id)

                    when {
                        existingItem != null && conflictStrategy == ImportConflictStrategy.SKIP_EXISTING -> {
                            skippedCount++
                        }
                        existingItem != null && conflictStrategy == ImportConflictStrategy.REPLACE_EXISTING -> {
                            val newImagePath = exportItem.imageFileName?.let { extractedImages[it] }
                            val item = exportItem.toInventoryItem(newImagePath).copy(id = exportItem.id)
                            repository.updateItem(item)
                            importedCount++
                        }
                        else -> {
                            // IMPORT_AS_NEW or no existing item
                            val newImagePath = exportItem.imageFileName?.let { extractedImages[it] }
                            val item = exportItem.toInventoryItem(newImagePath)
                            itemsToImport.add(item)
                            importedCount++
                        }
                    }
                } catch (e: Exception) {
                    errors.add("Failed to import item '${exportItem.title}': ${e.message}")
                    skippedCount++
                }

                onProgress((index + 1).toFloat() / exportData.items.size)
            }

            // Bulk insert new items
            if (itemsToImport.isNotEmpty()) {
                repository.insertItems(itemsToImport)
            }

            Result.success(
                ImportResult(
                    totalItems = exportData.manifest.itemCount,
                    importedItems = importedCount,
                    skippedItems = skippedCount,
                    errors = errors
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun saveImageFromZip(zipIn: ZipInputStream, originalFileName: String): String? {
        return try {
            val imagesDir = File(context.filesDir, "images")
            if (!imagesDir.exists()) {
                imagesDir.mkdirs()
            }

            // Generate new unique filename to avoid conflicts
            val extension = originalFileName.substringAfterLast(".", "jpg")
            val newFileName = "item_${UUID.randomUUID()}.$extension"
            val outputFile = File(imagesDir, newFileName)

            FileOutputStream(outputFile).use { output ->
                zipIn.copyTo(output)
            }

            outputFile.absolutePath
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
