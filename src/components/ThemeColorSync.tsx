"use client";

import { useEffect } from "react";
import { THEME_COOKIE, applyThemeColorMeta, parseTheme, type Theme } from "@/lib/theme";

function themeFromCookie(fallback: Theme): Theme {
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${THEME_COOKIE}=`))
    ?.slice(THEME_COOKIE.length + 1);
  return raw ? parseTheme(raw) : fallback;
}

/** Keep the no-media theme-color meta in sync on every page, not just
 *  Settings. Reads the live cookie so it cannot overwrite a colour the
 *  editor just wrote. Android Chrome standalone binds that one node. */
export default function ThemeColorSync({ theme }: { theme: Theme }) {
  useEffect(() => {
    const sync = () => applyThemeColorMeta(document, themeFromCookie(theme));
    sync();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [theme]);
  return null;
}
