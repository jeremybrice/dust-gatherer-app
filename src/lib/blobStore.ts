import { getStore } from "@netlify/blobs";

export const IMAGE_STORE = "inventory-images";

// Blob keys are generated here, never taken from client input: a
// caller-supplied key could collide with or overwrite another item's image.
export function newImageKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Keys are 32 lowercase hex characters; anything else never reaches the store. */
export const IMAGE_KEY_RE = /^[a-f0-9]{32}$/;

export function imageStore() {
  return getStore(IMAGE_STORE);
}
