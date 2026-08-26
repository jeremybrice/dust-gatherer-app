"use client";

import { createContext, useContext, type ReactNode } from "react";
import { t as translate, type Lang } from "@/lib/i18n";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

const I18nContext = createContext<{ lang: Lang; t: TFn } | null>(null);

export function I18nProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: ReactNode;
}) {
  const t: TFn = (key, vars) => translate(lang, key, vars);
  return <I18nContext.Provider value={{ lang, t }}>{children}</I18nContext.Provider>;
}

export function useT(): { lang: Lang; t: TFn } {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within I18nProvider");
  return ctx;
}
