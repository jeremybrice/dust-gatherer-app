import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { I18nProvider } from "@/components/I18nProvider";
import { LANG_COOKIE, parseLang } from "@/lib/i18n";
import { THEME_COOKIE, cssVars, parseTheme } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dust Gatherer",
  description: "Track resale inventory from thrift store find to final sale.",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// Static `viewport.themeColor` would leave the iOS status bar and installed-app
// chrome burgundy whatever accent she picked.
export async function generateViewport(): Promise<Viewport> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return {
    themeColor: theme.accent,
    viewportFit: "cover",
    width: "device-width",
    initialScale: 1,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const lang = parseLang(jar.get(LANG_COOKIE)?.value);
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  return (
    <html
      lang={lang}
      className={theme.mode === "system" ? undefined : theme.mode}
      style={cssVars(theme) as CSSProperties}
    >
      <body>
        <ServiceWorkerRegister />
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
