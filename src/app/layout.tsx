import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dust Gatherer",
  description: "Track resale inventory from thrift store find to final sale.",
};

export const viewport: Viewport = {
  themeColor: "#722F37",
  // viewportFit=cover pairs with the safe-area padding in globals.css so the
  // installed app draws correctly on notched displays.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
