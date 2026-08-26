import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { I18nProvider } from "@/components/I18nProvider";
import { LANG_COOKIE, parseLang } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dust Gatherer",
  description: "Track resale inventory from thrift store find to final sale.",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#722F37",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return (
    <html lang={lang}>
      <body>
        <ServiceWorkerRegister />
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
