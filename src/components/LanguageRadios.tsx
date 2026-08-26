"use client";

import { useT } from "@/components/I18nProvider";
import { langCookieString, type Lang } from "@/lib/i18n";

export default function LanguageRadios() {
  const { lang, t } = useT();

  function choose(next: Lang) {
    if (next === lang) return;
    document.cookie = langCookieString(next, location.protocol === "https:");
    location.reload();
  }

  return (
    <section className="settings-block">
      <h2>{t("language")}</h2>
      <div role="radiogroup" aria-label={t("language")}>
        {(["en", "uk"] as const).map((code) => (
          <label key={code} className="radio-row">
            <input
              type="radio"
              name="dg-lang"
              checked={lang === code}
              onChange={() => choose(code)}
            />
            {t(code === "en" ? "language_en" : "language_uk")}
          </label>
        ))}
      </div>
    </section>
  );
}
