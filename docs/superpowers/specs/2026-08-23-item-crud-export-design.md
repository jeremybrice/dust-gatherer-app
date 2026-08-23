# Item CRUD + Export design

Date: 2026-08-23
Status: approved by Jeremy 2026-08-23

## Purpose

Make the inventory editable and give the data a way back out. Today production holds the
only copy of the inventory (208 items with photos) and the app is read-only. This increment
delivers item create, edit, and delete with photo capture, at behavioral parity with the
retired Android app's `ItemDetailScreen.kt` (in git history before `46d7f5f`), plus a backup
export producing a version 2 ZIP that this app's own importer accepts. Export ships in the
same release as CRUD, per the warning in [docs/handoff.md](../../handoff.md): the moment
editing works, the old Android ZIP stops describing reality.

## Out of scope

Calendar, analytics, settings screens, category and site management UI, i18n, the PWA shell,
and bulk select. The category and site dropdowns read the rows already in the `categories`
and `sites` tables; managing those lists is a later increment.

## Decisions already made

- Behavioral parity with Android: same fields, rules, and flows. Layout adapts to mobile web.
- Photo capture uses a native file input (`accept="image/*"`), so the phone's own
  camera/gallery chooser handles capture. No getUserMedia, no permissions code.
- Export is assembled client-side in the browser. Netlify functions buffer non-streaming
  responses around 6MB and the real backup is tens of megabytes, so a server-built ZIP is
  the same "works locally, fails deployed" trap class the handoff documents. The browser
  fetches the document and images through routes already proven in production and zips
  locally with a small library.
- Mutations are route handlers under `/api/items`, following the existing API and session
  patterns, not Server Actions.

## Item screens and navigation

Two new pages: `/items/new` (add) and `/items/[id]` (edit). Inventory list rows link to the
edit page and the list gains an "Add item" button.

Form fields, matching Android:

- Photo area (tap to add or change)
- Title, required
- Description, multi-line
- Purchase price, required, decimal, dollar prefix
- Asking price, optional, decimal, dollar prefix
- Purchase date, defaults to today
- Scheduled post date, optional and clearable
- Status dropdown, shown only when editing an item that is not sold; options In Stock,
  Scheduled, Posted
- Purchase location
- Category dropdown, populated from `categories`, blank option allowed
- Site dropdown, populated from `sites`, blank option allowed
- Notes, multi-line

Save is disabled until the form is valid (title non-blank, purchase price parses). Two
guarded flows match Android exactly:

- **Mark as Sold**, shown only when editing an unsold item: a dialog asks the final selling
  price, pre-filled with the asking price, and confirming sets the selling price and a sold
  date of today.
- **Delete**, shown only when editing: a confirmation dialog, then the item and its photo
  blob are removed.

Both return to the inventory list on success. Failures surface inline and never navigate
away, so typed data is not lost.

## Photo capture and storage

Tapping the photo area opens a file input. The chosen image is resized client-side using the
existing resize module from the import pipeline ([src/lib/imageResize.ts](../../../src/lib/imageResize.ts)),
uploaded through the existing images API, and the returned blob key is stored on the item.

Blob hygiene: replacing a photo deletes the old blob after the item save succeeds; deleting
an item deletes its blob. Storage cannot accumulate orphans through normal use.

## Mutation API

Route handlers following the existing conventions and session guard:

- `POST /api/items` creates an item
- `PUT /api/items/[id]` updates an item
- `DELETE /api/items/[id]` deletes an item and its blob

`status` and `profit` remain derived, never stored ([src/lib/itemStatus.ts](../../../src/lib/itemStatus.ts)).
A requested status change is translated server-side into the date-field writes that imply it,
porting the Android `ItemDetailViewModel` transition logic exactly. Request validation uses
zod, consistent with [src/lib/exportFormat.ts](../../../src/lib/exportFormat.ts). Created
items rely on the identity default for `id`; nothing in this increment writes explicit ids.

## Export

A "Download backup" action on the settings page, alongside import.

1. `GET /api/export` returns the full `ExportData` document defined by
   [src/lib/exportFormat.ts](../../../src/lib/exportFormat.ts), written explicitly at
   version 2 with all fields present, plus each item's blob key so the client can fetch
   images. `imageFileName` in the document is derived from the stored blob key.
2. The browser fetches each photo through the existing `/api/images/[key]` route, assembles
   `inventory.json` and `images/<fileName>` entries into a ZIP with a small client-side zip
   library, and triggers a download. Per-item progress is shown, matching the Android
   exporter's progress behavior.

The safety property is the round trip: an exported ZIP re-imported into a fresh database
must reproduce the inventory exactly. The importer preserves ids and is idempotent, so this
holds by construction and is verified by test.

## Testing

- Unit: status-transition mapping, request validation, export document assembly.
- Integration (PGlite, over the deployed driver module per
  [tests/integration/driver.test.ts](../../../tests/integration/driver.test.ts) precedent):
  CRUD handlers create, update, and delete real rows.
- Round trip: a generated export document and archive feed directly into the existing import
  parser and mapping, asserting equality.
- Not locally testable: new Blobs behavior (photo upload from the form, blob deletion).
  The implementation plan must include a scripted post-deploy verification checklist for
  these, since this is the exact gap class that caused the production driver outage.

## Risks

- Blob deletion is new Blobs surface and only verifiable in production. Mitigation: deploy
  verification checklist, and deletion ordered after the database write so a blob failure
  cannot strand an item pointing at a missing image.
- The export document must satisfy the importer's schema, which requires
  `manifest.version`. Writing all fields explicitly, rather than imitating
  kotlinx.serialization's omission of defaults, is deliberate and safe: the reader supplies
  defaults for absent fields but accepts present ones, and the Android app that produced the
  omitting form is retired.
