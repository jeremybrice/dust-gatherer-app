export interface StandaloneWindow {
  matchMedia?: (query: string) => { matches: boolean };
  navigator: { standalone?: boolean };
}

/** iOS Safari; omitted from TypeScript's DOM lib. */
declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export function isStandalone(win: StandaloneWindow): boolean {
  if (win.matchMedia?.("(display-mode: standalone)").matches) return true;
  return win.navigator.standalone === true;
}

export function isIosSafari(nav: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): boolean {
  if (/iPhone|iPod/.test(nav.userAgent)) return true;
  return nav.platform === "MacIntel" && nav.maxTouchPoints > 1;
}
