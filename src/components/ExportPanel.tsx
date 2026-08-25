"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { runExport, type ExportProgress, type ExportResult } from "@/lib/exportClient";

export default function ExportPanel() {
  const { t } = useT();
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
      setError(err instanceof Error ? err.message : t("export_failed"));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="container">
      <header className="app">
        <h1>{t("export_heading")}</h1>
        <nav className="nav">
          <a href="/settings">{t("back")}</a>
        </nav>
      </header>

      <p className="notice">
        {t("export_notice")}
      </p>

      <p>
        <button type="button" className="btn" onClick={onExport} disabled={busy}>
          {busy ? t("exporting") : t("download_backup")}
        </button>
      </p>

      {progress && (
        <p aria-live="polite">
          {progress.phase === "photos"
            ? t("export_photos_progress", { "1": progress.completed, "2": progress.total })
            : t("export_building")}
        </p>
      )}

      {error && <p role="alert" className="error">{error}</p>}

      {result && (
        <>
          <h2>{t("export_saved")}</h2>
          <ul>
            <li>{result.fileName}</li>
            <li>{t("export_counts", { "1": result.itemCount, "2": result.photoCount })}</li>
          </ul>
          {result.errors.length > 0 && (
            <>
              <p role="alert" className="error">
                {t("export_photo_errors", { "1": result.errors.length })}
              </p>
              <ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
