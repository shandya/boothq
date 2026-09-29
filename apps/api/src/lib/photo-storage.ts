import { del, get, head, list, BlobNotFoundError } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { AppError } from "./errors.js";

// docs/PHOTO_TICKETS.md → Photo storage. The rest of the API talks to this
// interface only, so the backing store can be swapped without touching it.
export interface PhotoStorage {
  createUploadToken(pathname: string, maxBytes: number): Promise<{ clientToken: string }>;
  exists(pathname: string): Promise<boolean>;
  read(pathname: string): Promise<{ body: ReadableStream<Uint8Array>; contentType: string } | null>;
  delete(pathnames: string[]): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

export const PHOTO_CONTENT_TYPE = "image/jpeg";
export const PHOTO_MAX_BYTES = 1_000_000;

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new AppError(503, "STORAGE_UNAVAILABLE", "Photo storage isn't configured.");
  return token;
}

export const vercelBlobStorage: PhotoStorage = {
  async createUploadToken(pathname, maxBytes) {
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: blobToken(),
      pathname,
      maximumSizeInBytes: maxBytes,
      allowedContentTypes: [PHOTO_CONTENT_TYPE],
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return { clientToken };
  },

  async exists(pathname) {
    try {
      await head(pathname, { token: blobToken() });
      return true;
    } catch (err) {
      if (err instanceof BlobNotFoundError) return false;
      throw err;
    }
  },

  async read(pathname) {
    const result = await get(pathname, { access: "private", token: blobToken() });
    if (!result || result.statusCode !== 200) return null;
    return { body: result.stream, contentType: result.blob.contentType };
  },

  async delete(pathnames) {
    if (pathnames.length === 0) return;
    await del(pathnames, { token: blobToken() });
  },

  async deletePrefix(prefix) {
    const token = blobToken();
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, token });
      if (page.blobs.length > 0) await del(page.blobs.map((b) => b.pathname), { token });
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  },
};

let storage: PhotoStorage = vercelBlobStorage;

export function getPhotoStorage(): PhotoStorage {
  return storage;
}

// Tests install an in-memory fake here.
export function setPhotoStorage(next: PhotoStorage): void {
  storage = next;
}

export function photoPathname(dayId: string, ticketId: string, suffix: string): string {
  return `${ticketPhotoPrefix(dayId, ticketId)}${suffix}.jpg`;
}

export function ticketPhotoPrefix(dayId: string, ticketId: string): string {
  return `days/${dayId}/${ticketId}-`;
}

export function dayPhotoPrefix(dayId: string): string {
  return `days/${dayId}/`;
}
