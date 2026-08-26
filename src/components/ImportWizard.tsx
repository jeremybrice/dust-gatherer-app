"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import {
  parseArchive,
  runImport,
  type ImportProgress,
  type ParsedArchive,
  type RunImportResult,
} from "@/lib/importClient";
import { IMPORT_STRATEGIES, type ImportStrategy } from "@/lib/importMapping";

const STRATEGY_KEYS: Record<ImportStrategy, string> = {
  IMPORT_AS_NEW: "import_as_new",
  SKIP_EXISTING: "import_skip_existing",
  REPLACE_EXISTING: "import_replace_existing",
};

export default function ImportWizard() {
  const { t } = useT();
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
      setError(err instanceof Error ? err.message : t("file_read_error"));
    }
  }

  async function onImport() {
    if (!archive) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await runImport(archive, strategy, setProgress));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("import_failed"));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="container">
      <header className="app">
        <h1>{t("import_heading")}</h1>
        <a href="/settings">{t("back")}</a>
      </header>

      <p className="notice">
        {t("import_notice")}
      </p>

      <p>
        <input type="file" accept=".zip,application/zip" onChange={onFile} disabled={busy} />
      </p>

      {error && <p role="alert" className="error">{error}</p>}

      {archive && !result && (
        <>
          <h2>{t("import_ready")}</h2>
          <ul>
            <li>{t("import_items", { "1": archive.data.items.length })}</li>
            <li>{t("import_photos", { "1": archive.images.size })}</li>
            <li>{t("import_taxonomy", { "1": archive.data.categories.length, "2": archive.data.sites.length })}</li>
            <li>{t("import_version", { "1": archive.data.manifest.version })}</li>
          </ul>

          <label htmlFor="strategy">{t("import_strategy_label")}</label>
          <select
            id="strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as ImportStrategy)}
            disabled={busy}
          >
            {IMPORT_STRATEGIES.map((s) => (
              <option key={s} value={s}>{t(STRATEGY_KEYS[s])}</option>
            ))}
          </select>

          <p>
            <button type="button" onClick={onImport} disabled={busy}>
              {busy ? t("importing") : t("start_import")}
            </button>
          </p>
        </>
      )}

      {progress && (
        <p aria-live="polite">
          {t("importing")} {progress.completed}/{progress.total}
        </p>
      )}

      {result && (
        <>
          <h2>{t("import_complete")}</h2>
          <ul>
            <li>{t("items_imported", { "1": result.imported })}</li>
            {result.skipped > 0 && <li>{t("items_skipped", { "1": result.skipped })}</li>}
          </ul>
          {result.errors.length > 0 && (
            <>
              <p className="error">
                {t("import_photo_errors", { "1": result.errors.length })}
              </p>
              <ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </>
          )}
          <p><a href="/inventory">{t("view_inventory")}</a></p>
        </>
      )}
    </div>
  );
}
