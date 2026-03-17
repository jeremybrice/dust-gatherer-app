package com.dustgatherer.app.ui.screens.itemdetail

import android.Manifest
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.dustgatherer.app.R
import com.dustgatherer.app.data.model.InventoryItem
import com.dustgatherer.app.data.model.ItemStatus
import com.dustgatherer.app.ui.components.MarkAsSoldDialog
import com.dustgatherer.app.viewmodel.CategoryViewModel
import com.dustgatherer.app.viewmodel.ItemDetailViewModel
import com.dustgatherer.app.viewmodel.SiteViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ItemDetailScreen(
    viewModel: ItemDetailViewModel,
    categoryViewModel: CategoryViewModel,
    siteViewModel: SiteViewModel,
    itemId: Long?,
    onNavigateBack: () -> Unit,
    onImageSelected: (Uri) -> String?,
    onCreateTempImageUri: () -> Pair<Uri, String> = { throw UnsupportedOperationException() },
    modifier: Modifier = Modifier
) {
    val formState by viewModel.formState.collectAsState()
    val context = LocalContext.current

    var showDatePicker by remember { mutableStateOf(false) }
    var datePickerTarget by remember { mutableStateOf<DatePickerTarget?>(null) }
    var showScheduleDatePicker by remember { mutableStateOf(false) }
    var showMarkAsSoldDialog by remember { mutableStateOf(false) }
    var showDeleteConfirmDialog by remember { mutableStateOf(false) }
    var showPhotoSourceDialog by remember { mutableStateOf(false) }
    var statusDropdownExpanded by remember { mutableStateOf(false) }
    var categoryDropdownExpanded by remember { mutableStateOf(false) }
    var siteDropdownExpanded by remember { mutableStateOf(false) }

    val categories by categoryViewModel.categories.collectAsState()
    val sites by siteViewModel.sites.collectAsState()

    // Camera state
    var pendingCameraUri by remember { mutableStateOf<Uri?>(null) }
    var pendingCameraPath by remember { mutableStateOf<String?>(null) }

    // Load item if editing
    LaunchedEffect(itemId) {
        if (itemId != null && itemId != 0L) {
            viewModel.loadItem(itemId)
        } else {
            viewModel.resetForm()
        }
    }

    // Handle save success
    LaunchedEffect(Unit) {
        viewModel.saveSuccess.collect { success ->
            if (success) {
                onNavigateBack()
            }
        }
    }

    // Handle delete success
    LaunchedEffect(Unit) {
        viewModel.deleteSuccess.collect { success ->
            if (success) {
                onNavigateBack()
            }
        }
    }

    // Gallery picker
    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { selectedUri ->
            val savedPath = onImageSelected(selectedUri)
            savedPath?.let { viewModel.updateImagePath(it) }
        }
    }

    // Camera launcher
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success: Boolean ->
        if (success) {
            pendingCameraPath?.let { path ->
                viewModel.updateImagePath(path)
            }
        }
        pendingCameraUri = null
        pendingCameraPath = null
    }

    // Camera permission launcher
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            val (uri, path) = onCreateTempImageUri()
            pendingCameraUri = uri
            pendingCameraPath = path
            cameraLauncher.launch(uri)
        } else {
            Toast.makeText(context, context.getString(R.string.camera_permission_required), Toast.LENGTH_SHORT).show()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (formState.isEditing) stringResource(R.string.edit_item) else stringResource(R.string.add_item)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
                    }
                },
                actions = {
                    TextButton(
                        onClick = { viewModel.saveItem() },
                        enabled = formState.isValid
                    ) {
                        Text(stringResource(R.string.save))
                    }
                }
            )
        },
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Image section
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .clickable { showPhotoSourceDialog = true },
                contentAlignment = Alignment.Center
            ) {
                if (formState.imagePath != null) {
                    AsyncImage(
                        model = formState.imagePath,
                        contentDescription = stringResource(R.string.item_image),
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                    // Overlay button to change image
                    Surface(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(8.dp),
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f)
                    ) {
                        Row(
                            modifier = Modifier.padding(8.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.CameraAlt,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(stringResource(R.string.change), style = MaterialTheme.typography.labelMedium)
                        }
                    }
                } else {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.AddAPhoto,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                        )
                        Text(
                            stringResource(R.string.tap_to_add_photo),
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                        )
                    }
                }
            }

            // Title
            OutlinedTextField(
                value = formState.title,
                onValueChange = { viewModel.updateTitle(it) },
                label = { Text(stringResource(R.string.title_required)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                isError = formState.title.isBlank()
            )

            // Description
            OutlinedTextField(
                value = formState.description,
                onValueChange = { viewModel.updateDescription(it) },
                label = { Text(stringResource(R.string.description)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                maxLines = 4
            )

            // Price section
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = formState.purchasePrice,
                    onValueChange = { viewModel.updatePurchasePrice(it) },
                    label = { Text(stringResource(R.string.purchase_price_required)) },
                    modifier = Modifier.weight(1f),
                    leadingIcon = { Text("$") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    isError = formState.purchasePrice.toDoubleOrNull() == null
                )

                OutlinedTextField(
                    value = formState.sellingPrice,
                    onValueChange = { viewModel.updateSellingPrice(it) },
                    label = { Text(stringResource(R.string.asking_price_label)) },
                    modifier = Modifier.weight(1f),
                    leadingIcon = { Text("$") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true
                )
            }

            // Purchase date
            OutlinedTextField(
                value = formState.purchaseDate.format(DateTimeFormatter.ofPattern("MMM d, yyyy")),
                onValueChange = { },
                label = { Text(stringResource(R.string.purchase_date)) },
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        datePickerTarget = DatePickerTarget.PURCHASE
                        showDatePicker = true
                    },
                enabled = false,
                trailingIcon = {
                    Icon(Icons.Default.CalendarMonth, contentDescription = null)
                },
                colors = OutlinedTextFieldDefaults.colors(
                    disabledTextColor = MaterialTheme.colorScheme.onSurface,
                    disabledBorderColor = MaterialTheme.colorScheme.outline,
                    disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )

            // Scheduled post date
            OutlinedTextField(
                value = formState.scheduledPostDate?.format(DateTimeFormatter.ofPattern("MMM d, yyyy")) ?: stringResource(R.string.not_scheduled),
                onValueChange = { },
                label = { Text(stringResource(R.string.scheduled_post_date)) },
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        datePickerTarget = DatePickerTarget.SCHEDULED
                        showDatePicker = true
                    },
                enabled = false,
                trailingIcon = {
                    Row {
                        if (formState.scheduledPostDate != null) {
                            IconButton(onClick = { viewModel.updateScheduledPostDate(null) }) {
                                Icon(Icons.Default.Clear, contentDescription = stringResource(R.string.clear_date))
                            }
                        }
                        Icon(Icons.Default.Schedule, contentDescription = null)
                    }
                },
                colors = OutlinedTextFieldDefaults.colors(
                    disabledTextColor = MaterialTheme.colorScheme.onSurface,
                    disabledBorderColor = MaterialTheme.colorScheme.outline,
                    disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )

            // Status dropdown (only when editing and not sold)
            if (formState.isEditing && !formState.isSold) {
                ExposedDropdownMenuBox(
                    expanded = statusDropdownExpanded,
                    onExpandedChange = { statusDropdownExpanded = it }
                ) {
                    val statusLabel = when (formState.currentStatus) {
                        ItemStatus.INVENTORY -> stringResource(R.string.status_in_stock)
                        ItemStatus.SCHEDULED -> stringResource(R.string.status_scheduled)
                        ItemStatus.POSTED -> stringResource(R.string.status_posted)
                        ItemStatus.SOLD -> stringResource(R.string.status_sold)
                    }
                    OutlinedTextField(
                        value = statusLabel,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.status)) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = statusDropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = statusDropdownExpanded,
                        onDismissRequest = { statusDropdownExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.status_in_stock)) },
                            onClick = {
                                viewModel.changeStatus(ItemStatus.INVENTORY)
                                statusDropdownExpanded = false
                            }
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.status_scheduled)) },
                            onClick = {
                                viewModel.changeStatus(ItemStatus.SCHEDULED)
                                statusDropdownExpanded = false
                            }
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.status_posted)) },
                            onClick = {
                                viewModel.changeStatus(ItemStatus.POSTED)
                                statusDropdownExpanded = false
                            }
                        )
                    }
                }
            }

            // Purchase location
            OutlinedTextField(
                value = formState.purchaseLocation,
                onValueChange = { viewModel.updatePurchaseLocation(it) },
                label = { Text(stringResource(R.string.purchase_location)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.LocationOn, contentDescription = null) }
            )

            // Category dropdown
            ExposedDropdownMenuBox(
                expanded = categoryDropdownExpanded,
                onExpandedChange = { categoryDropdownExpanded = it }
            ) {
                OutlinedTextField(
                    value = formState.category,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text(stringResource(R.string.category)) },
                    leadingIcon = { Icon(Icons.Default.Category, contentDescription = null) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryDropdownExpanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = categoryDropdownExpanded,
                    onDismissRequest = { categoryDropdownExpanded = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("") },
                        onClick = {
                            viewModel.updateCategory("")
                            categoryDropdownExpanded = false
                        }
                    )
                    categories.forEach { category ->
                        DropdownMenuItem(
                            text = { Text(category.name) },
                            onClick = {
                                viewModel.updateCategory(category.name)
                                categoryDropdownExpanded = false
                            }
                        )
                    }
                }
            }

            // Site dropdown
            ExposedDropdownMenuBox(
                expanded = siteDropdownExpanded,
                onExpandedChange = { siteDropdownExpanded = it }
            ) {
                OutlinedTextField(
                    value = formState.site,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text(stringResource(R.string.site)) },
                    leadingIcon = { Icon(Icons.Default.Store, contentDescription = null) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = siteDropdownExpanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = siteDropdownExpanded,
                    onDismissRequest = { siteDropdownExpanded = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("") },
                        onClick = {
                            viewModel.updateSite("")
                            siteDropdownExpanded = false
                        }
                    )
                    sites.forEach { site ->
                        DropdownMenuItem(
                            text = { Text(site.name) },
                            onClick = {
                                viewModel.updateSite(site.name)
                                siteDropdownExpanded = false
                            }
                        )
                    }
                }
            }

            // Notes
            OutlinedTextField(
                value = formState.notes,
                onValueChange = { viewModel.updateNotes(it) },
                label = { Text(stringResource(R.string.notes)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 5
            )

            // Mark as Sold button (only if editing and not already sold)
            if (formState.canMarkAsSold) {
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(8.dp))

                Button(
                    onClick = { showMarkAsSoldDialog = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.mark_as_sold))
                }
            }

            // Delete button (only when editing an existing item)
            if (formState.isEditing) {
                Spacer(modifier = Modifier.height(8.dp))

                OutlinedButton(
                    onClick = { showDeleteConfirmDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    ),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.error)
                ) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.delete_item))
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    // Date picker dialog
    if (showDatePicker && datePickerTarget != null) {
        val initialDate = when (datePickerTarget) {
            DatePickerTarget.PURCHASE -> formState.purchaseDate
            DatePickerTarget.SCHEDULED -> formState.scheduledPostDate ?: LocalDate.now()
            null -> LocalDate.now()
        }

        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = initialDate.toEpochDay() * 24 * 60 * 60 * 1000
        )

        DatePickerDialog(
            onDismissRequest = {
                showDatePicker = false
                datePickerTarget = null
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        datePickerState.selectedDateMillis?.let { millis ->
                            val selectedDate = LocalDate.ofEpochDay(millis / (24 * 60 * 60 * 1000))
                            when (datePickerTarget) {
                                DatePickerTarget.PURCHASE -> viewModel.updatePurchaseDate(selectedDate)
                                DatePickerTarget.SCHEDULED -> viewModel.updateScheduledPostDate(selectedDate)
                                null -> {}
                            }
                        }
                        showDatePicker = false
                        datePickerTarget = null
                    }
                ) {
                    Text(stringResource(R.string.ok))
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showDatePicker = false
                        datePickerTarget = null
                    }
                ) {
                    Text(stringResource(R.string.cancel))
                }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    // Mark as Sold dialog
    if (showMarkAsSoldDialog) {
        val tempItem = InventoryItem(
            id = formState.editingItemId ?: 0,
            title = formState.title,
            purchasePrice = formState.purchasePrice.toDoubleOrNull() ?: 0.0,
            sellingPrice = formState.sellingPrice.toDoubleOrNull(),
            purchaseDate = formState.purchaseDate
        )
        MarkAsSoldDialog(
            item = tempItem,
            onDismiss = { showMarkAsSoldDialog = false },
            onConfirm = { finalPrice ->
                viewModel.markAsSold(finalPrice)
                showMarkAsSoldDialog = false
            }
        )
    }

    // Delete confirmation dialog
    if (showDeleteConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmDialog = false },
            title = { Text(stringResource(R.string.delete_item_confirm_title)) },
            text = { Text(stringResource(R.string.delete_item_confirm_message)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirmDialog = false
                        viewModel.deleteItem()
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text(stringResource(R.string.delete))
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmDialog = false }) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    // Photo source chooser dialog
    if (showPhotoSourceDialog) {
        AlertDialog(
            onDismissRequest = { showPhotoSourceDialog = false },
            title = { Text(stringResource(R.string.choose_photo_source)) },
            text = {
                Column {
                    ListItem(
                        headlineContent = { Text(stringResource(R.string.take_photo)) },
                        leadingContent = { Icon(Icons.Default.CameraAlt, contentDescription = null) },
                        modifier = Modifier.clickable {
                            showPhotoSourceDialog = false
                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    )
                    ListItem(
                        headlineContent = { Text(stringResource(R.string.choose_from_gallery)) },
                        leadingContent = { Icon(Icons.Default.PhotoLibrary, contentDescription = null) },
                        modifier = Modifier.clickable {
                            showPhotoSourceDialog = false
                            imagePickerLauncher.launch("image/*")
                        }
                    )
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showPhotoSourceDialog = false }) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }
}

private enum class DatePickerTarget {
    PURCHASE,
    SCHEDULED
}
