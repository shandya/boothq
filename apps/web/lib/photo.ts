import { put } from "@vercel/blob/client";
import * as api from "./api";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

export class PhotoReadError extends Error {
  constructor() {
    super("Couldn't read this photo, try taking a new one.");
    this.name = "PhotoReadError";
  }
}

// Shrinks the photo on the phone (docs/PHOTO_TICKETS.md → Upload flow, step 2).
// Redrawing through a canvas also drops all EXIF metadata, including GPS.
export async function resizeToJpeg(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoReadError();
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new PhotoReadError();
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new PhotoReadError();
    return blob;
  } finally {
    bitmap.close();
  }
}

// Token from the API → straight to storage (never through the API, which
// can't take bodies over 4.5 MB on Vercel) → confirm with the API.
export async function uploadTicketPhoto(ticketId: string, photo: Blob, onProgress?: (percent: number) => void) {
  const { pathname, clientToken } = await api.createPhotoUploadToken(ticketId);
  await put(pathname, photo, {
    access: "private",
    token: clientToken,
    contentType: "image/jpeg",
    onUploadProgress: ({ percentage }) => onProgress?.(percentage),
  });
  return api.confirmPhoto(ticketId, pathname);
}

export const ticketPhotoUrl = (ticketId: string, version: number) =>
  `/api/tickets/${encodeURIComponent(ticketId)}/photo?v=${version}`;
