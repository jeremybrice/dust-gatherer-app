package com.dustgatherer.app.data.export

import android.content.Context
import android.net.Uri
import com.dustgatherer.app.BuildConfig
import com.dustgatherer.app.data.repository.InventoryRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileInputStream
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class DataExporter(
    private val context: Context,
    private val repository: InventoryRepository
) {
    private val json = Json {
        prettyPrint = true
        ignoreUnknownKeys = true
    }

    suspend fun exportToZip(
        outputUri: Uri,
        onProgress: (Float) -> Unit
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val items = repository.getAllItemsSnapshot()
            val exportItems = items.map { ExportInventoryItem.fromInventoryItem(it) }

            val manifest = ExportManifest(
                appVersion = BuildConfig.VERSION_NAME,
                exportDate = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                itemCount = items.size
            )

            val exportData = ExportData(manifest = manifest, items = exportItems)

            val totalSteps = items.count { it.imagePath != null } + 1 // +1 for JSON
            var completedSteps = 0

            context.contentResolver.openOutputStream(outputUri)?.use { outputStream ->
                ZipOutputStream(outputStream).use { zipOut ->
                    // Write inventory.json
                    val jsonData = json.encodeToString(exportData)
                    zipOut.putNextEntry(ZipEntry("inventory.json"))
                    zipOut.write(jsonData.toByteArray(Charsets.UTF_8))
                    zipOut.closeEntry()
                    completedSteps++
                    onProgress(completedSteps.toFloat() / totalSteps)

                    // Write images
                    for (item in items) {
                        item.imagePath?.let { imagePath ->
                            val imageFile = File(imagePath)
                            if (imageFile.exists()) {
                                val fileName = imageFile.name
                                zipOut.putNextEntry(ZipEntry("images/$fileName"))
                                FileInputStream(imageFile).use { input ->
                                    input.copyTo(zipOut)
                                }
                                zipOut.closeEntry()
                            }
                            completedSteps++
                            onProgress(completedSteps.toFloat() / totalSteps)
                        }
                    }
                }
            } ?: return@withContext Result.failure(Exception("Could not open output stream"))

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
