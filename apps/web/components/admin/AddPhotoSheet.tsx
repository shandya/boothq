"use client";

import type { TicketDTO } from "@boothq/shared";
import { useState } from "react";
import { ApiError } from "../../lib/api";
import { PhotoReadError, resizeToJpeg } from "../../lib/photo";
import { useUploadPhoto } from "../../lib/queries";
import { GroupedList } from "../ui/GroupedList";
import { PhotoPickButtons } from "../ui/PhotoPickButtons";
import { Sheet } from "../ui/Sheet";

type AddPhotoSheetProps = {
  ticket: TicketDTO;
  onClose: () => void;
  onDone: () => void;
};

// "Add Photo" on an in-person ticket: the ticket becomes a virtual session
// once the upload is confirmed (docs/PHOTO_TICKETS.md → User stories).
export function AddPhotoSheet({ ticket, onClose, onDone }: AddPhotoSheetProps) {
  const upload = useUploadPhoto();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setProgress(0);
    try {
      const photo = await resizeToJpeg(file);
      await upload.mutateAsync({ id: ticket.id, photo, onProgress: setProgress });
      onDone();
    } catch (err) {
      setProgress(null);
      setError(
        err instanceof PhotoReadError || err instanceof ApiError
          ? err.message
          : "The upload didn't finish. Check your connection and try again.",
      );
    }
  }

  const busy = progress !== null;

  return (
    <Sheet title="Add Photo" subtitle={`#${ticket.number} ${ticket.name}`} onClose={onClose}>
      <GroupedList>
        <PhotoPickButtons onFile={handleFile} disabled={busy} />
      </GroupedList>
      {busy ? <UploadProgress percent={progress} /> : null}
      {error ? <p className="m-0 px-1 text-[15px] text-danger">{error}</p> : null}
      <p className="m-0 px-1 text-[13px] text-label-2">
        Adding a photo makes this a virtual session: we draw from the photo and they pick up the portrait later. The
        photo is deleted once the drawing is done.
      </p>
    </Sheet>
  );
}

export function UploadProgress({ percent }: { percent: number | null }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      aria-label="Uploading photo"
      className="h-2 w-full overflow-hidden shape-sq bg-track"
    >
      <div className="h-full bg-accent transition-[width]" style={{ width: `${percent ?? 0}%` }} />
    </div>
  );
}
