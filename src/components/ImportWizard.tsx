"use client";

import { useState } from "react";
import {
  parseArchive,
  runImport,
  type ImportProgress,
  type ParsedArchive,
  type RunImportResult,
} from "@/lib/importClient";
import { IMPORT_STRATEGIES, type ImportStrategy } from "@/lib/importMapping";

const STRATEGY_LABELS: Record<ImportStrategy, string> = {
  IMPORT_AS_NEW: "Add everything as new items",
  SKIP_EXISTING: "Skip items that already exist",
  REPLACE_EXISTING: "Replace items that already exist",
};

export default function ImportWizard() {
  const [archive, setArchive] = useState<ParsedArchive | null>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>("IMPORT_AS_NEW");
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<RunImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setArchive(null);
    try {
      setArchive(await parseArchive(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  async function onImport() {
    if (!archive) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await runImport(archive, strategy, setProgress));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="container">
      <header className="app">
        <h1>Import a backup</h1>
        <a href="/settings">Back</a>
      </header>

      <p className="notice">
        Choose the <code>.zip</code> exported from the Dust Gatherer Android app. The archive
        is unpacked in your browser and photos are resized before upload, so large backups
        work over a slow connection.
      </p>

      <p>
        <input type="file" accept=".zip,application/zip" onChange={onFile} disabled={busy} />
      </p>

      {error && <p role="alert" className="error">{error}</p>}

      {archive && !result && (
        <>
          <h2>Ready to import</h2>
          <ul>
            <li>{archive.data.items.length} items</li>
            <li>{archive.images.size} photos</li>
            <li>{archive.data.categories.length} categories, {archive.data.sites.length} sites</li>
            <li>Backup format version {archive.data.manifest.version}</li>
          </ul>

          <label htmlFor="strategy">If an item already exists</label>
          <select
            id="strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as ImportStrategy)}
            disabled={busy}
          >
            {IMPORT_STRATEGIES.map((s) => (
              <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>
            ))}
          </select>

          <p>
            <button type="button" onClick={onImport} disabled={busy}>
              {busy ? "Importing…" : "Start import"}
            </button>
          </p>
        </>
      )}

      {progress && (
        <p aria-live="polite">
          {progress.phase === "images" ? "Uploading photos" : "Saving items"}:{" "}
          {progress.completed} of {progress.total}
        </p>
      )}

      {result && (
        <>
          <h2>Import complete</h2>
          <ul>
            <li>{result.imported} items imported</li>
            {result.skipped > 0 && <li>{result.skipped} skipped</li>}
          </ul>
          {result.errors.length > 0 && (
            <>
              <p className="error">
                {result.errors.length} photo{result.errors.length === 1 ? "" : "s"} could not be
                uploaded. Those items were imported without a picture.
              </p>
              <ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </>
          )}
          <p><a href="/inventory">View your inventory</a></p>
        </>
      )}
    </div>
  );
}
