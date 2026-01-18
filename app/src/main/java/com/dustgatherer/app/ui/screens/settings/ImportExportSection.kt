package com.dustgatherer.app.ui.screens.settings

import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.dustgatherer.app.R
import com.dustgatherer.app.data.export.ImportConflictStrategy
import com.dustgatherer.app.data.export.ImportResult
import com.dustgatherer.app.viewmodel.ImportExportViewModel.ExportState
import com.dustgatherer.app.viewmodel.ImportExportViewModel.ImportState

@Composable
fun ImportExportSection(
    exportState: ExportState,
    importState: ImportState,
    onExportClick: () -> Unit,
    onImportClick: () -> Unit,
    onImportConfirm: (Uri, ImportConflictStrategy) -> Unit,
    onDismissExportResult: () -> Unit,
    onDismissImportResult: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        Text(
            text = stringResource(R.string.data_management),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(8.dp))

        // Export Button
        OutlinedButton(
            onClick = onExportClick,
            modifier = Modifier.fillMaxWidth(),
            enabled = exportState is ExportState.Idle
        ) {
            Icon(
                imageVector = Icons.Default.Upload,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.export_data))
        }
        Text(
            text = stringResource(R.string.export_description),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 8.dp, top = 4.dp)
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Import Button
        OutlinedButton(
            onClick = onImportClick,
            modifier = Modifier.fillMaxWidth(),
            enabled = importState is ImportState.Idle
        ) {
            Icon(
                imageVector = Icons.Default.Download,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.import_data))
        }
        Text(
            text = stringResource(R.string.import_description),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 8.dp, top = 4.dp)
        )
    }

    // Export Progress Dialog
    if (exportState is ExportState.InProgress) {
        ProgressDialog(
            progress = exportState.progress,
            title = stringResource(R.string.exporting)
        )
    }

    // Export Success Dialog
    if (exportState is ExportState.Success) {
        AlertDialog(
            onDismissRequest = onDismissExportResult,
            title = { Text(stringResource(R.string.export_data)) },
            text = { Text(stringResource(R.string.export_success)) },
            confirmButton = {
                TextButton(onClick = onDismissExportResult) {
                    Text(stringResource(R.string.ok))
                }
            }
        )
    }

    // Export Error Dialog
    if (exportState is ExportState.Error) {
        AlertDialog(
            onDismissRequest = onDismissExportResult,
            title = { Text(stringResource(R.string.export_data)) },
            text = { Text(stringResource(R.string.export_error, exportState.message)) },
            confirmButton = {
                TextButton(onClick = onDismissExportResult) {
                    Text(stringResource(R.string.ok))
                }
            }
        )
    }

    // Import Progress Dialog
    if (importState is ImportState.InProgress) {
        ProgressDialog(
            progress = importState.progress,
            title = stringResource(R.string.importing)
        )
    }

    // Import Confirmation Dialog
    if (importState is ImportState.ConfirmImport) {
        ImportConflictDialog(
            itemCount = importState.itemCount,
            onStrategySelected = { strategy ->
                onImportConfirm(importState.uri, strategy)
            },
            onCancel = onDismissImportResult
        )
    }

    // Import Success Dialog
    if (importState is ImportState.Success) {
        ImportResultDialog(
            result = importState.result,
            onDismiss = onDismissImportResult
        )
    }

    // Import Error Dialog
    if (importState is ImportState.Error) {
        AlertDialog(
            onDismissRequest = onDismissImportResult,
            title = { Text(stringResource(R.string.import_data)) },
            text = { Text(stringResource(R.string.import_error, importState.message)) },
            confirmButton = {
                TextButton(onClick = onDismissImportResult) {
                    Text(stringResource(R.string.ok))
                }
            }
        )
    }
}

@Composable
private fun ProgressDialog(
    progress: Float,
    title: String
) {
    Dialog(onDismissRequest = { }) {
        Card(
            modifier = Modifier.padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium
                )
                Spacer(modifier = Modifier.height(16.dp))
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "${(progress * 100).toInt()}%",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun ImportConflictDialog(
    itemCount: Int,
    onStrategySelected: (ImportConflictStrategy) -> Unit,
    onCancel: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text(stringResource(R.string.import_conflict_title)) },
        text = {
            Column {
                Text(stringResource(R.string.import_conflict_message, itemCount))
                Spacer(modifier = Modifier.height(16.dp))

                ImportStrategyOption(
                    text = stringResource(R.string.import_as_new),
                    onClick = { onStrategySelected(ImportConflictStrategy.IMPORT_AS_NEW) }
                )
                ImportStrategyOption(
                    text = stringResource(R.string.import_skip_existing),
                    onClick = { onStrategySelected(ImportConflictStrategy.SKIP_EXISTING) }
                )
                ImportStrategyOption(
                    text = stringResource(R.string.import_replace_existing),
                    onClick = { onStrategySelected(ImportConflictStrategy.REPLACE_EXISTING) }
                )
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onCancel) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}

@Composable
private fun ImportStrategyOption(
    text: String,
    onClick: () -> Unit
) {
    TextButton(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(text, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun ImportResultDialog(
    result: ImportResult,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.import_data)) },
        text = {
            Column {
                Text(stringResource(R.string.import_success, result.importedItems))
                if (result.skippedItems > 0) {
                    Text(stringResource(R.string.items_skipped, result.skippedItems))
                }
                if (result.errors.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = result.errors.take(3).joinToString("\n"),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.ok))
            }
        }
    )
}
