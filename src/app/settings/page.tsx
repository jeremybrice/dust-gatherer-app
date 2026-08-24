import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings · Dust Gatherer" };

export default async function SettingsPage() {
  await requireSession();
  return (
    <AppShell title="Settings" active="settings">
      <ul className="settings-links">
        <li>
          <a href="/settings/export">
            <h2>Export data</h2>
            <p>Backup all items and images to a ZIP file</p>
          </a>
        </li>
        <li>
          <a href="/settings/import">
            <h2>Import data</h2>
            <p>Restore items and images from a backup</p>
          </a>
        </li>
      </ul>
    </AppShell>
  );
}
