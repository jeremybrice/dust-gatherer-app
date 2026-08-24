"use client";

import { useState } from "react";
import { runExport, type ExportProgress, type ExportResult } from "@/lib/exportClient";

export default function ExportPanel() {
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await runExport(setProgress));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="container">
      <header className="app">
        <h1>Download a backup</h1>
        <nav className="nav">
          <a href="/">Back</a>
        </nav>
      </header>

      <p className="notice">
        Downloads a <code>.zip</code> of your whole inventory, photos included, in the same
        format the Android app used. Re-importing it restores everything exactly. This is
        currently the only copy of your data outside the database, so export regularly.
      </p>

      <p>
        <button type="button" className="btn" onClick={onExport} disabled={busy}>
          {busy ? "Exporting…" : "Download backup"}
        </button>
      </p>

      {progress && (
        <p aria-live="polite">
          {progress.phase === "photos"
            ? `Downloading photos: ${progress.completed} of ${progress.total}`
            : "Building the archive…"}
        </p>
      )}

      {error && <p role="alert" className="error">{error}</p>}

      {result && (
        <>
          <h2>Backup saved</h2>
          <ul>
            <li>{result.fileName}</li>
            <li>{result.itemCount} items, {result.photoCount} photos</li>
          </ul>
          {result.errors.length > 0 && (
            <>
              <p role="alert" className="error">
                {result.errors.length} photo{result.errors.length === 1 ? "" : "s"} could not
                be downloaded and are missing from this backup. Do not rely on it for those
                photos; try the export again.
              </p>
              <ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
