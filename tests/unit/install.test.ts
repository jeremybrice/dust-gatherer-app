import { describe, it, expect } from "vitest";
import { isIosSafari, isStandalone } from "@/lib/install";

describe("isStandalone", () => {
  it("is true for display-mode standalone", () => {
    expect(
      isStandalone({
        matchMedia: (q: string) => ({ matches: q.includes("standalone") }),
        navigator: {},
      }),
    ).toBe(true);
  });

  it("is true for iOS navigator.standalone", () => {
    expect(
      isStandalone({
        matchMedia: () => ({ matches: false }),
        navigator: { standalone: true },
      }),
    ).toBe(true);
  });

  it("is false in a normal browser tab", () => {
    expect(
      isStandalone({
        matchMedia: () => ({ matches: false }),
        navigator: {},
      }),
    ).toBe(false);
  });
});

describe("isIosSafari", () => {
  it("detects iPhone", () => {
    expect(
      isIosSafari({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        platform: "iPhone",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it("detects iPadOS desktop UA", () => {
    expect(
      isIosSafari({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it("rejects Android and desktop Chrome", () => {
    expect(
      isIosSafari({
        userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0",
        platform: "Linux armv8l",
        maxTouchPoints: 5,
      }),
    ).toBe(false);
    expect(
      isIosSafari({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0",
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});
