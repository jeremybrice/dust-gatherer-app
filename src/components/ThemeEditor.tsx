"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import {
  PRESETS,
  THEME_MODES,
  applyTheme,
  clearThemeCookieString,
  isDefaultTheme,
  themeCookieString,
  type ColorKey,
  type Theme,
  type ThemeMode,
} from "@/lib/theme";

const MAIN_COLORS: { key: ColorKey; label: string }[] = [
  { key: "accent", label: "color_accent" },
  { key: "bg", label: "color_background" },
  { key: "surface", label: "color_cards" },
  { key: "text", label: "color_text" },
];

const STATUS_COLORS: { key: ColorKey; label: string }[] = [
  { key: "statusInventory", label: "status_in_stock" },
  { key: "statusScheduled", label: "status_scheduled" },
  { key: "statusPosted", label: "status_posted" },
  { key: "statusSold", label: "status_sold" },
];

const MODE_LABELS: Record<ThemeMode, string> = {
  system: "mode_system",
  light: "mode_light",
  dark: "mode_dark",
};

export default function ThemeEditor({ initial }: { initial: Theme }) {
  const { t } = useT();
  const [theme, setTheme] = useState<Theme>(initial);

  // Unlike the language switch, nothing needs a reload: every colour is a CSS
  // variable, so the whole app restyles under her finger.
  function update(next: Theme) {
    setTheme(next);
    applyTheme(document.documentElement, next);
    document.cookie = themeCookieString(next, location.protocol === "https:");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", next.accent);
  }

  function setColor(key: ColorKey, value: string) {
    update({ ...theme, [key]: value.toUpperCase() });
  }

  function reset() {
    document.cookie = clearThemeCookieString();
    location.reload();
  }

  const activePreset = PRESETS.find((p) =>
    (Object.keys(p.colors) as ColorKey[]).every((k) => p.colors[k] === theme[k]),
  )?.id;

  return (
    <section className="settings-block theme-editor">
      <h2>{t("theme")}</h2>
      <p className="hint">{t("theme_hint")}</p>

      <h3>{t("theme_mode")}</h3>
      <div role="radiogroup" aria-label={t("theme_mode")} className="mode-row">
        {THEME_MODES.map((mode) => (
          <label key={mode} className="radio-row">
            <input
              type="radio"
              name="dg-theme-mode"
              checked={theme.mode === mode}
              onChange={() => update({ ...theme, mode })}
            />
            {t(MODE_LABELS[mode])}
          </label>
        ))}
      </div>

      <h3>{t("theme_presets")}</h3>
      <div className="swatches">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={preset.id === activePreset ? "swatch on" : "swatch"}
            onClick={() => update({ ...theme, ...preset.colors })}
            aria-pressed={preset.id === activePreset}
          >
            <span
              className="swatch-dots"
              style={{ background: preset.colors.bg, borderColor: preset.colors.text }}
            >
              <i style={{ background: preset.colors.accent }} />
              <i style={{ background: preset.colors.statusScheduled }} />
              <i style={{ background: preset.colors.statusPosted }} />
              <i style={{ background: preset.colors.statusSold }} />
            </span>
            {t(`preset_${preset.id}`)}
          </button>
        ))}
      </div>

      <h3>{t("main_colors")}</h3>
      <ColorRows rows={MAIN_COLORS} theme={theme} onChange={setColor} />

      <h3>{t("status_colors")}</h3>
      <ColorRows rows={STATUS_COLORS} theme={theme} onChange={setColor} />

      <h3>{t("theme_preview")}</h3>
      <div className="preview">
        <div className="stat profit">
          <div className="k">{t("sales_profit")}</div>
          <div className="v">+$120.00</div>
          <div className="s">$300.00 {t("revenue")}</div>
        </div>
        <div className="preview-row">
          <span className="chips-inline">
            <a className="on" href="#" onClick={(e) => e.preventDefault()}>{t("chip_all")}</a>
            <a href="#" onClick={(e) => e.preventDefault()}>{t("chip_stale")}</a>
          </span>
          <span className="chip">{t("stale")}</span>
        </div>
        <div className="preview-row">
          <span className="badge INVENTORY">{t("status_in_stock")}</span>
          <span className="badge SCHEDULED">{t("status_scheduled")}</span>
          <span className="badge POSTED">{t("status_posted")}</span>
          <span className="badge SOLD">{t("status_sold")}</span>
        </div>
      </div>

      {!isDefaultTheme(theme) && (
        <button type="button" className="btn btn-quiet" onClick={reset}>
          {t("reset_theme")}
        </button>
      )}
    </section>
  );
}

function ColorRows({
  rows,
  theme,
  onChange,
}: {
  rows: { key: ColorKey; label: string }[];
  theme: Theme;
  onChange: (key: ColorKey, value: string) => void;
}) {
  const { t } = useT();
  return (
    <div className="color-rows">
      {rows.map(({ key, label }) => (
        <label key={key} className="color-row">
          <span className="color-name">{t(label)}</span>
          <span className="color-value">{theme[key]}</span>
          <input
            type="color"
            value={theme[key].toLowerCase()}
            onChange={(e) => onChange(key, e.target.value)}
            aria-label={t(label)}
          />
        </label>
      ))}
    </div>
  );
}
