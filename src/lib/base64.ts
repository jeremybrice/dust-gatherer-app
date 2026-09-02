/**
 * Pure ArrayBuffer -> base64 encoder. Uses only `btoa` and typed arrays, both
 * global in the browser and in Node 18+, so it needs no DOM and no Buffer —
 * one code path for the client bundle and for unit tests.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
