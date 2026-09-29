"use client";

import type { TicketDTO } from "@boothq/shared";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../lib/api";
import { PhotoReadError, resizeToJpeg, ticketPhotoUrl } from "../../lib/photo";
import { useDeletePhoto, useUpdateTicket, useUploadPhoto } from "../../lib/queries";
import { CapsuleButton } from "../ui/CapsuleButton";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { GroupedList, GroupedSeparator } from "../ui/GroupedList";
import { PhotoPickButtons } from "../ui/PhotoPickButtons";
import { PhotoThumb } from "../ui/PhotoViewer";
import { Sheet } from "../ui/Sheet";
import { UploadProgress } from "../ui/UploadProgress";

export function EditTicketSheet({ ticket, onClose }: { ticket: TicketDTO; onClose: () => void }) {
  const [name, setName] = useState(ticket.name);
  const [phone, setPhone] = useState(ticket.phoneDisplay ?? ticket.phone ?? "");
  const [notes, setNotes] = useState(ticket.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateTicket();
  const upload = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const [progress, setProgress] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmRemovePhoto, setConfirmRemovePhoto] = useState(false);
  const [photoVersion] = useState(() => Date.now());
  // A photo can be added or removed until drawing starts (docs/PHOTO_TICKETS.md).
  const photoEditable = ticket.status === "WAITING" || ticket.status === "CALLED";

  // Uploads right away; the photo makes the ticket a virtual session.
  async function handleFile(file: File) {
    setPhotoError(null);
    setProgress(0);
    try {
      const photo = await resizeToJpeg(file);
      await upload.mutateAsync({ id: ticket.id, photo, onProgress: setProgress });
    } catch (err) {
      setPhotoError(
        err instanceof PhotoReadError || err instanceof ApiError
          ? err.message
          : "The upload didn't finish. Check your connection and try again.",
      );
    } finally {
      setProgress(null);
    }
  }

  function save() {
    setError(null);
    mutation.mutate(
      { id: ticket.id, input: { name, phone, notes: notes || undefined } },
      {
        onSuccess: onClose,
        onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <>
      <Sheet title="Edit Ticket" onClose={onClose}>
        <GroupedList>
          <div className="flex h-[52px] items-center gap-3 px-4">
            <label htmlFor="et-name" className="w-16 text-[17px]">
              Name
            </label>
            <input
              id="et-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-w-0 flex-grow border-none bg-transparent text-[17px] text-label outline-none"
            />
          </div>
          <GroupedSeparator />
          <div className="flex h-[52px] items-center gap-3 px-4">
            <label htmlFor="et-phone" className="w-16 text-[17px]">
              Phone
            </label>
            <input
              id="et-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="min-w-0 flex-grow border-none bg-transparent text-[17px] text-label outline-none"
            />
          </div>
        </GroupedList>
        <GroupedList>
          <div className="min-h-16 px-4 py-3.5">
            <label htmlFor="et-notes" className="sr-only">
              Note for the illustrator
            </label>
            <input
              id="et-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Note (optional)"
              className="w-full border-none bg-transparent text-[17px] text-label outline-none placeholder:text-label-2"
            />
          </div>
        </GroupedList>
        {photoEditable ? (
          <div className="flex flex-col gap-1.5">
            <h3 className="m-0 px-4 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
              Photo
            </h3>
            <GroupedList>
              {ticket.hasPhoto ? (
                <>
                  <PhotoThumb
                    src={ticketPhotoUrl(ticket.id, photoVersion)}
                    alt={`Photo of ${ticket.name}`}
                    className="max-h-56 w-full object-cover"
                  />
                  <GroupedSeparator inset={0} />
                  <button
                    type="button"
                    onClick={() => setConfirmRemovePhoto(true)}
                    className="flex h-[50px] w-full cursor-pointer items-center gap-3 bg-transparent px-4 text-left text-[17px] text-danger"
                  >
                    <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                    Remove Photo
                  </button>
                </>
              ) : (
                <PhotoPickButtons onFile={handleFile} disabled={progress !== null} />
              )}
            </GroupedList>
            {progress !== null ? <UploadProgress percent={progress} /> : null}
            {photoError ? <p className="m-0 px-4 text-[15px] text-danger">{photoError}</p> : null}
            <p className="m-0 px-4 text-[13px] text-label-2">
              The photo is deleted once the drawing is done.
            </p>
          </div>
        ) : null}
        {error ? <p className="m-0 px-1 text-[15px] text-danger">{error}</p> : null}
        <CapsuleButton onClick={save} pending={mutation.isPending}>
          Save Changes
        </CapsuleButton>
      </Sheet>
      {confirmRemovePhoto ? (
        <ConfirmSheet
          title={`Remove the photo for #${ticket.number}?`}
          description="The ticket goes back to being an in-person session."
          destructive
          confirmLabel="Remove Photo"
          pending={deletePhoto.isPending}
          onCancel={() => setConfirmRemovePhoto(false)}
          onConfirm={() =>
            deletePhoto.mutate(ticket.id, { onSettled: () => setConfirmRemovePhoto(false) })
          }
        />
      ) : null}
    </>
  );
}
