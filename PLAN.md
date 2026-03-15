# Implementation Plan: Product Management Features

## Understanding

The Dust Gatherer app is a Kotlin/Jetpack Compose Android inventory management app. Products (`InventoryItem`) have a status that is currently **computed dynamically** from date fields (`soldDate`, `postedDate`, `scheduledPostDate`). The product edit screen (`ItemDetailScreen.kt`) currently has "Mark as Posted" and "Mark as Sold" buttons but no general status dropdown or delete button. Photo selection currently only supports gallery picking via `ActivityResultContracts.GetContent()`.

---

## Feature 1: Status Dropdown on Product Edit Screen

**Current behavior:** Status is derived from date fields. The edit screen has individual "Mark as Posted" / "Mark as Sold" buttons that set dates.

**Planned changes:**

### `ItemDetailScreen.kt`
- **Remove** the existing "Mark as Posted" and "Mark as Sold" buttons
- **Add** a Material 3 `ExposedDropdownMenuBox` with the three selectable statuses: **Inventory**, **Scheduled**, **Posted**
  - "Sold" status will NOT be in this dropdown since marking as sold involves entering a selling price (existing `MarkAsSoldDialog` handles this). We'll keep a separate "Mark as Sold" button for that flow.
- When the user selects a status from the dropdown:
  - **Inventory**: Clears `scheduledPostDate` and `postedDate` (keeps `soldDate` null)
  - **Scheduled**: Sets `scheduledPostDate` to today (or keeps existing), clears `postedDate`
  - **Posted**: Sets `postedDate` to today (or keeps existing)
- The dropdown will show the current computed status and will appear in the form below the date fields

### `ItemDetailViewModel.kt`
- **Add** a `changeStatus(newStatus: ItemStatus)` function that updates the relevant date fields in the form state based on the selected status

---

## Feature 2: Delete Product from Edit Screen

**Current behavior:** Delete functions exist in DAO, Repository, and InventoryViewModel, but no UI button is exposed.

**Planned changes:**

### `ItemDetailViewModel.kt`
- **Add** a `deleteItem()` function that calls `repository.deleteItemById(itemId)` and signals navigation back

### `ItemDetailScreen.kt`
- **Add** a "Delete" button at the bottom of the edit form (only visible when editing an existing item, not when creating a new one)
- Styled as a destructive action (red/error color, outlined button)
- **Add** a confirmation `AlertDialog` that asks "Are you sure you want to delete this item?" with Cancel/Delete options
- On confirmation, call ViewModel's delete function and navigate back to the inventory list

---

## Feature 3: Camera or Gallery Choice for Photos

**Current behavior:** Tapping the image area launches `ActivityResultContracts.GetContent()` which only opens the gallery/file picker.

**Planned changes:**

### `AndroidManifest.xml`
- **Add** `CAMERA` permission: `<uses-permission android:name="android.permission.CAMERA" />`

### `ItemDetailScreen.kt`
- **Replace** the direct gallery picker launch with an `AlertDialog` or `ModalBottomSheet` that presents two options:
  - "Take Photo" (camera)
  - "Choose from Gallery" (existing gallery picker)
- **Add** a second `ActivityResultLauncher` for `ActivityResultContracts.TakePicture()` which takes a photo and saves to a provided URI
- **Add** camera permission request handling using `rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission())`
- When "Take Photo" is selected:
  1. Request camera permission if not granted
  2. Create a temporary file URI via `FileProvider`
  3. Launch camera intent with that URI
  4. On success, save the image path to the form state

### `MainActivity.kt`
- **Add** a `FileProvider` configuration for sharing temp image URIs with the camera app
- **Add** a helper function to create a temp image file and return its content URI

### `res/xml/file_paths.xml` (new file)
- Define file provider paths for the images directory

### `AndroidManifest.xml`
- **Add** `<provider>` entry for `FileProvider` to support camera image capture

---

## Files Modified (summary)

| File | Changes |
|------|---------|
| `ItemDetailScreen.kt` | Status dropdown, delete button + dialog, camera/gallery chooser dialog |
| `ItemDetailViewModel.kt` | `changeStatus()`, `deleteItem()` functions |
| `AndroidManifest.xml` | Camera permission, FileProvider declaration |
| `MainActivity.kt` | FileProvider helper for camera URI |
| `res/xml/file_paths.xml` | **New file** - FileProvider paths config |

## Files NOT modified
- `InventoryItem.kt` - Status model stays as-is (computed from dates)
- `InventoryDao.kt` - Already has `deleteItemById()`
- `InventoryRepository.kt` - Already has `deleteItemById()`
- Database schema - No migration needed
