import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import ThemeColorSync from "@/components/ThemeColorSync";
import { I18nProvider } from "@/components/I18nProvider";
import { LANG_COOKIE, parseLang } from "@/lib/i18n";
import {
  THEME_COOKIE,
  chromeBackground,
  cssVars,
  parseTheme,
  viewportThemeColor,
} from "@/lib/theme";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  // Query string forces Chrome to re-read the installed-app manifest when
  // the chrome colour changes; a static href left the last-fetched cream.
  return {
    title: "Dust Gatherer",
    description: "Track resale inventory from thrift store find to final sale.",
    manifest: `/manifest.webmanifest?c=${chromeBackground(theme).slice(1).toLowerCase()}`,
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

// Static `viewport.themeColor` would leave the iOS status bar and installed-app
// chrome Classic burgundy. Follow the page background so the top bar matches
// the rest of the screen in both light and dark.
export async function generateViewport(): Promise<Viewport> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return {
    themeColor: viewportThemeColor(theme),
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
        <ThemeColorSync theme={theme} />
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
