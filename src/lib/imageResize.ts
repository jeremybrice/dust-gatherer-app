// Browser-only: downscales a photo before upload.
//
// Phone photos run 3-8MB, which is both slow over field connectivity and close
// to the serverless request-size ceiling. Downscaling to a long edge of 1600px
// at q0.82 lands around 200-400KB with no visible loss at the sizes this app
// displays.

export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.82;

/** Downscale to a JPEG blob. Images already within MAX_EDGE are still
 *  re-encoded, which normalises heterogeneous archive content to one format. */
export async function downscaleImage(
  input: Blob,
  maxEdge = MAX_EDGE,
): Promise<Blob> {
  const bitmap = await createImageBitmap(input);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get a 2D drawing context");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new Error("Could not encode the image");
    return blob;
  } finally {
    bitmap.close();
  }
}
