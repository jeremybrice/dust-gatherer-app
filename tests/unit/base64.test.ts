import { describe, it, expect } from "vitest";
import { arrayBufferToBase64 } from "@/lib/base64";

describe("arrayBufferToBase64", () => {
  it("encodes an empty buffer as an empty string", () => {
    expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe("");
  });

  it("matches Buffer's base64 encoding for arbitrary bytes", () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const expected = Buffer.from(bytes).toString("base64");
    expect(arrayBufferToBase64(bytes.buffer)).toBe(expected);
  });

  it("round-trips known text", () => {
    const text = "Dust Gatherer: style + occasion";
    const bytes = new TextEncoder().encode(text);
    const b64 = arrayBufferToBase64(bytes.buffer);
    expect(atob(b64)).toBe(text);
  });
});
