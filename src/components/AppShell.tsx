import type { ReactNode } from "react";

export default function AppShell({
  title,
  active,
  addHref,
  children,
}: {
  title: string;
  active: "home" | "inventory" | "settings";
  addHref?: string;
  children: ReactNode;
}) {
  return (
    <div className="container shelled">
      <header className="app">
        <h1>{title}</h1>
        {addHref ? (
          <nav className="nav">
            <a href={addHref}>+ Add</a>
          </nav>
        ) : null}
      </header>
      {children}
      <nav className="tabbar" aria-label="Primary">
        <a href="/" className={active === "home" ? "on" : undefined}>Home</a>
        <a href="/inventory" className={active === "inventory" ? "on" : undefined}>Inventory</a>
        <a href="/settings" className={active === "settings" ? "on" : undefined}>Settings</a>
      </nav>
    </div>
  );
}
