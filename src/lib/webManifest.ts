import { chromeBackground, type Theme } from "@/lib/theme";

export function webManifest(theme: Theme) {
  return {
    name: "Dust Gatherer",
    short_name: "Dust Gatherer",
    display: "standalone" as const,
    start_url: "/",
    // Installed Android chrome reads this. Accent was the burgundy bar;
    // the page background is what the rest of the screen already uses.
    theme_color: chromeBackground(theme),
    background_color: chromeBackground(theme),
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
