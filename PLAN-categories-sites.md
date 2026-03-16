# Plan: Categories & Sites Settings Feature

## Overview

Introduce two user-managed configuration lists — **Categories** and **Sites** — managed under Settings. Replace the free-text `category` field on product edit with a dropdown populated from user-defined categories. Add a new `site` dropdown to product edit populated from user-defined sites.

---

## Current State

- `InventoryItem.category` is a `String` field, edited via a plain `OutlinedTextField`
- No `site` field exists on `InventoryItem`
- Settings only contains Theme, Language, and Import/Export
- Settings data is stored in Preferences DataStore; inventory data in Room

---

## Design Decisions

### Storage: Room tables (not DataStore)

Categories and Sites will be stored as **Room entities** rather than DataStore preferences. Reasons:
- They are user-created, unbounded lists of data — a better fit for a database table
- Enables future features like foreign-key relationships, filtering, analytics by category/site
- Consistent with how inventory data is already managed
- Easily included in import/export backups

### Product model changes

- `InventoryItem.category` remains a `String` (storing the category name). This maintains backward compatibility — existing items with free-text categories continue to work.
- A new `site` field (`String`, default `""`) is added to `InventoryItem`.
- Room database migration from version 1 → 2 to add the `site` column.

### UI approach

- **Settings screen**: Add two new clickable rows ("Categories" and "Sites") that navigate to dedicated management screens
- **Category/Site management screens**: A simple list + text field + add button. Each entry has a delete button. Inline editing approach (no separate "create" dialog — just type and tap Add).
- **Product edit (ItemDetailScreen)**: Replace the category `OutlinedTextField` with an `ExposedDropdownMenuBox` (Material 3 dropdown). Add a similar dropdown for Site. Both dropdowns show "None" as a default option, plus all user-created values.

---

## Step-by-Step Implementation Plan

### Step 1: Create Room entities for Category and Site

**New file:** `data/model/Category.kt`
```kotlin
@Entity(tableName = "categories")
data class Category(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String
)
```

**New file:** `data/model/Site.kt`
```kotlin
@Entity(tableName = "sites")
data class Site(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String
)
```

### Step 2: Create DAOs

**New file:** `data/local/CategoryDao.kt`
- `getAllCategories(): Flow<List<Category>>` — ordered by name
- `insertCategory(category)` — insert
- `deleteCategory(category)` — delete
- `getCategoryByName(name): Category?` — for duplicate checking

**New file:** `data/local/SiteDao.kt`
- Same pattern as CategoryDao

### Step 3: Update AppDatabase

- Add `Category::class` and `Site::class` to the `@Database` entities list
- Bump version from 1 to 2
- Add a migration (1 → 2) that runs `CREATE TABLE categories ...` and `CREATE TABLE sites ...` and `ALTER TABLE inventory_items ADD COLUMN site TEXT NOT NULL DEFAULT ''`
- Expose `categoryDao()` and `siteDao()` abstract methods

### Step 4: Add `site` field to InventoryItem

- Add `val site: String = ""` to `InventoryItem`
- This column will be created by the Room migration

### Step 5: Create Repository layer

**New file:** `data/repository/CategoryRepository.kt`
- Wraps CategoryDao — `getAllCategories()`, `addCategory(name)`, `deleteCategory(category)`
- Duplicate-name guard in `addCategory`

**New file:** `data/repository/SiteRepository.kt`
- Same pattern

### Step 6: Create ViewModels

**New file:** `viewmodel/CategoryViewModel.kt`
- Exposes `categories: StateFlow<List<Category>>`
- `addCategory(name: String)` — validates non-blank, calls repository
- `deleteCategory(category: Category)`

**New file:** `viewmodel/SiteViewModel.kt`
- Same pattern

### Step 7: Create Settings management screens

**New file:** `ui/screens/settings/CategoryManagementScreen.kt`
- Scaffold with TopAppBar ("Categories") and back navigation
- Text field + "Add" button at the top
- LazyColumn listing all categories, each with a delete icon button
- Validation: no empty names, no duplicates (show Snackbar on error)

**New file:** `ui/screens/settings/SiteManagementScreen.kt`
- Same pattern as CategoryManagementScreen but for Sites

### Step 8: Update SettingsScreen

Add two new clickable rows after the Language section (before Import/Export):
- **Categories** — row with icon (Icons.Default.Category), label, and chevron → navigates to CategoryManagementScreen
- **Sites** — row with icon (Icons.Default.Store), label, and chevron → navigates to SiteManagementScreen

### Step 9: Update Navigation

- Add two new routes: `Screen.CategoryManagement` and `Screen.SiteManagement`
- Add composable entries in NavHost for both screens
- Wire navigation from SettingsScreen to these new screens
- Pass CategoryViewModel and SiteViewModel through navigation

### Step 10: Update ItemDetailScreen — Category dropdown

Replace the `OutlinedTextField` for category (lines 371–379) with:
- `ExposedDropdownMenuBox` with a read-only `OutlinedTextField` showing current selection
- Dropdown items: one for each user-created category
- Selection updates `viewModel.updateCategory(name)`
- The ItemDetailScreen will need access to the category list (pass from CategoryViewModel or collect in the composable)

### Step 11: Update ItemDetailScreen — Site dropdown

Add a new `ExposedDropdownMenuBox` for site (after or near the category dropdown):
- Same pattern as category dropdown
- Selection updates `viewModel.updateSite(name)`

### Step 12: Update ItemDetailViewModel and ItemFormState

- Add `site: String = ""` to `ItemFormState`
- Add `updateSite(site: String)` method to `ItemDetailViewModel`
- Update `loadItem()` to populate `site` from the loaded `InventoryItem`
- Update `saveItem()` to include `site` in the constructed `InventoryItem`

### Step 13: Update DustGathererApplication

- Expose `categoryDao()` and `siteDao()` from the database (they're already accessible via AppDatabase, but ViewModels need repositories wired up)

### Step 14: Wire ViewModels in MainActivity / Navigation

- Create CategoryRepository, SiteRepository, CategoryViewModel, SiteViewModel in MainActivity (following existing pattern with `ViewModelProvider.Factory`)
- Pass them to `AppNavigation`

### Step 15: Update Import/Export

- Update `ExportModels.kt` to include `site` field in `ExportItem`
- Update `DataExporter.kt` to export categories and sites lists
- Update `DataImporter.kt` to import categories and sites, and handle `site` field
- Handle backward compat: if importing an old backup without `site`, default to `""`

### Step 16: Add string resources

Add to `strings.xml` and `strings.xml` (Ukrainian):
- `categories` — "Categories"
- `sites` — "Sites"
- `site` — "Site"
- `add_category` — "Add Category"
- `add_site` — "Add Site"
- `category_exists` — "Category already exists"
- `site_exists` — "Site already exists"
- `no_selection` — "" (empty / none)
- `manage_categories` — "Manage Categories"
- `manage_sites` — "Manage Sites"

---

## Files Changed (Summary)

| Action | File |
|--------|------|
| **New** | `data/model/Category.kt` |
| **New** | `data/model/Site.kt` |
| **New** | `data/local/CategoryDao.kt` |
| **New** | `data/local/SiteDao.kt` |
| **New** | `data/repository/CategoryRepository.kt` |
| **New** | `data/repository/SiteRepository.kt` |
| **New** | `viewmodel/CategoryViewModel.kt` |
| **New** | `viewmodel/SiteViewModel.kt` |
| **New** | `ui/screens/settings/CategoryManagementScreen.kt` |
| **New** | `ui/screens/settings/SiteManagementScreen.kt` |
| **Modified** | `data/model/InventoryItem.kt` — add `site` field |
| **Modified** | `data/local/AppDatabase.kt` — add entities, DAOs, migration |
| **Modified** | `viewmodel/ItemDetailViewModel.kt` — add `site` to form state |
| **Modified** | `ui/screens/itemdetail/ItemDetailScreen.kt` — dropdowns for category & site |
| **Modified** | `ui/screens/settings/SettingsScreen.kt` — add category/site navigation rows |
| **Modified** | `ui/navigation/Navigation.kt` — new routes & viewmodel params |
| **Modified** | `DustGathererApplication.kt` — (minor, if needed) |
| **Modified** | `MainActivity.kt` — wire new ViewModels |
| **Modified** | `data/export/ExportModels.kt` — add `site` field |
| **Modified** | `data/export/DataExporter.kt` — export categories & sites |
| **Modified** | `data/export/DataImporter.kt` — import categories & sites |
| **Modified** | `res/values/strings.xml` — new string resources |
| **Modified** | `res/values-uk/strings.xml` — Ukrainian translations |

---

## Backward Compatibility

- Existing items with free-text category values will still display (the string is preserved)
- Those old free-text values won't appear in the dropdown unless the user creates a matching category — this is by design (nudges users to formalize their categories)
- The `site` field defaults to `""`, so existing items are unaffected
- Old export backups without `site` field import cleanly with default `""`

---

## What This Plan Does NOT Include (out of scope)

- Filtering inventory by category or site (can be a follow-up)
- Displaying category/site on the ItemCard in the inventory list
- Multi-select categories per product (the field remains single-select)
- Reordering categories/sites
- Color-coding or icons per category/site
