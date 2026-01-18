package com.dustgatherer.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.dustgatherer.app.R
import com.dustgatherer.app.data.model.InventoryItem

@Composable
fun MarkAsSoldDialog(
    item: InventoryItem,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit
) {
    var priceText by remember {
        mutableStateOf(item.sellingPrice?.toString() ?: "")
    }
    val isValidPrice = priceText.toDoubleOrNull() != null && priceText.toDoubleOrNull()!! > 0

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.mark_as_sold)) },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.titleMedium
                )

                Text(
                    text = stringResource(R.string.bought_price, String.format("%.2f", item.purchasePrice)),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )

                OutlinedTextField(
                    value = priceText,
                    onValueChange = { priceText = it },
                    label = { Text(stringResource(R.string.final_sale_price)) },
                    leadingIcon = { Text("$") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    isError = priceText.isNotBlank() && !isValidPrice,
                    modifier = Modifier.fillMaxWidth()
                )

                // Show profit preview
                val salePrice = priceText.toDoubleOrNull()
                if (salePrice != null) {
                    val profit = salePrice - item.purchasePrice
                    val profitColor = if (profit >= 0) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.error
                    }
                    Text(
                        text = "Profit: ${if (profit >= 0) "+" else ""}$${String.format("%.2f", profit)}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = profitColor
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    priceText.toDoubleOrNull()?.let { price ->
                        onConfirm(price)
                    }
                },
                enabled = isValidPrice
            ) {
                Text(stringResource(R.string.confirm_sale))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}
