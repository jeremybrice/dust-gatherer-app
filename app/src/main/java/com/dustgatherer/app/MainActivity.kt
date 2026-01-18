package com.dustgatherer.app

import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import com.dustgatherer.app.data.local.AppLanguage
import com.dustgatherer.app.data.local.SettingsDataStore
import com.dustgatherer.app.data.local.ThemeMode
import com.dustgatherer.app.data.repository.InventoryRepository
import com.dustgatherer.app.ui.navigation.AppNavigation
import com.dustgatherer.app.ui.theme.DustGathererTheme
import com.dustgatherer.app.viewmodel.CalendarViewModel
import com.dustgatherer.app.viewmodel.InventoryViewModel
import com.dustgatherer.app.viewmodel.ItemDetailViewModel
import com.dustgatherer.app.viewmodel.SettingsViewModel
import java.io.File
import java.util.Locale
import java.util.UUID

class MainActivity : ComponentActivity() {
    private lateinit var settingsDataStore: SettingsDataStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val application = application as DustGathererApplication
        val repository = InventoryRepository(application.database.inventoryDao())
        settingsDataStore = SettingsDataStore(this)

        setContent {
            val themeMode by settingsDataStore.themeMode.collectAsState(initial = ThemeMode.SYSTEM)
            val language by settingsDataStore.language.collectAsState(initial = AppLanguage.ENGLISH)

            // Apply locale when language changes
            updateLocale(language)

            DustGathererTheme(themeMode = themeMode) {
                val inventoryViewModel: InventoryViewModel = viewModel(
                    factory = InventoryViewModel.provideFactory(repository)
                )
                val calendarViewModel: CalendarViewModel = viewModel(
                    factory = CalendarViewModel.provideFactory(repository)
                )
                val itemDetailViewModel: ItemDetailViewModel = viewModel(
                    factory = ItemDetailViewModel.provideFactory(repository)
                )
                val settingsViewModel: SettingsViewModel = viewModel(
                    factory = SettingsViewModel.provideFactory(settingsDataStore)
                )

                AppNavigation(
                    inventoryViewModel = inventoryViewModel,
                    calendarViewModel = calendarViewModel,
                    itemDetailViewModel = itemDetailViewModel,
                    settingsViewModel = settingsViewModel,
                    onImageSelected = { uri -> saveImageToInternalStorage(uri) }
                )
            }
        }
    }

    private fun updateLocale(language: AppLanguage) {
        val locale = Locale(language.code)
        Locale.setDefault(locale)
        val config = Configuration(resources.configuration)
        config.setLocale(locale)
        resources.updateConfiguration(config, resources.displayMetrics)
    }

    private fun saveImageToInternalStorage(uri: Uri): String? {
        return try {
            val inputStream = contentResolver.openInputStream(uri) ?: return null
            val imagesDir = File(filesDir, "images")
            if (!imagesDir.exists()) {
                imagesDir.mkdirs()
            }

            val fileName = "item_${UUID.randomUUID()}.jpg"
            val outputFile = File(imagesDir, fileName)

            inputStream.use { input ->
                outputFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }

            outputFile.absolutePath
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
