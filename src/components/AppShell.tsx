"use client";

import type { ReactNode } from "react";
import { useT } from "@/components/I18nProvider";

export default function AppShell({
  title,
  active,
  addHref,
  children,
}: {
  title: string;
  active: "home" | "inventory" | "schedule" | "settings";
  addHref?: string;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="container shelled">
      <header className="app">
        <h1>{title}</h1>
        {addHref ? (
          <nav className="nav">
            <a href={addHref}>{t("add")}</a>
          </nav>
        ) : null}
      </header>
      {children}
      <nav className="tabbar" aria-label={t("primary_nav")}>
        <a href="/" className={active === "home" ? "on" : undefined}>{t("home")}</a>
        <a href="/inventory" className={active === "inventory" ? "on" : undefined}>{t("inventory")}</a>
        <a href="/schedule" className={active === "schedule" ? "on" : undefined}>{t("schedule")}</a>
        <a href="/settings" className={active === "settings" ? "on" : undefined}>{t("settings")}</a>
      </nav>
    </div>
  );
}
