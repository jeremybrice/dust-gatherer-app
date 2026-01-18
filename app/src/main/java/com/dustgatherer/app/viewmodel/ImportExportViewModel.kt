package com.dustgatherer.app.viewmodel

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.dustgatherer.app.data.export.DataExporter
import com.dustgatherer.app.data.export.DataImporter
import com.dustgatherer.app.data.export.ImportConflictStrategy
import com.dustgatherer.app.data.export.ImportResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ImportExportViewModel(
    private val exporter: DataExporter,
    private val importer: DataImporter
) : ViewModel() {

    sealed class ExportState {
        data object Idle : ExportState()
        data class InProgress(val progress: Float) : ExportState()
        data object Success : ExportState()
        data class Error(val message: String) : ExportState()
    }

    sealed class ImportState {
        data object Idle : ImportState()
        data class ConfirmImport(val itemCount: Int, val uri: Uri) : ImportState()
        data class InProgress(val progress: Float) : ImportState()
        data class Success(val result: ImportResult) : ImportState()
        data class Error(val message: String) : ImportState()
    }

    private val _exportState = MutableStateFlow<ExportState>(ExportState.Idle)
    val exportState: StateFlow<ExportState> = _exportState.asStateFlow()

    private val _importState = MutableStateFlow<ImportState>(ImportState.Idle)
    val importState: StateFlow<ImportState> = _importState.asStateFlow()

    fun startExport(outputUri: Uri) {
        viewModelScope.launch {
            _exportState.value = ExportState.InProgress(0f)

            val result = exporter.exportToZip(outputUri) { progress ->
                _exportState.value = ExportState.InProgress(progress)
            }

            _exportState.value = result.fold(
                onSuccess = { ExportState.Success },
                onFailure = { ExportState.Error(it.message ?: "Export failed") }
            )
        }
    }

    fun previewImport(inputUri: Uri) {
        viewModelScope.launch {
            _importState.value = ImportState.InProgress(0f)

            val result = importer.previewImport(inputUri)

            _importState.value = result.fold(
                onSuccess = { itemCount -> ImportState.ConfirmImport(itemCount, inputUri) },
                onFailure = { ImportState.Error(it.message ?: "Failed to read backup file") }
            )
        }
    }

    fun startImport(uri: Uri, strategy: ImportConflictStrategy) {
        viewModelScope.launch {
            _importState.value = ImportState.InProgress(0f)

            val result = importer.importFromZip(uri, strategy) { progress ->
                _importState.value = ImportState.InProgress(progress)
            }

            _importState.value = result.fold(
                onSuccess = { ImportState.Success(it) },
                onFailure = { ImportState.Error(it.message ?: "Import failed") }
            )
        }
    }

    fun resetExportState() {
        _exportState.value = ExportState.Idle
    }

    fun resetImportState() {
        _importState.value = ImportState.Idle
    }

    companion object {
        fun provideFactory(
            exporter: DataExporter,
            importer: DataImporter
        ): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return ImportExportViewModel(exporter, importer) as T
            }
        }
    }
}
