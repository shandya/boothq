"use client";

import type { TicketDTO } from "@boothq/shared";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useCreateTicket, useUploadPhoto } from "../../lib/queries";
import { ApiError } from "../../lib/api";
import { PhotoReadError, resizeToJpeg } from "../../lib/photo";
import { CapsuleButton } from "../ui/CapsuleButton";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { GroupedList, GroupedSeparator } from "../ui/GroupedList";
import { PhotoPickButtons } from "../ui/PhotoPickButtons";
import { Sheet } from "../ui/Sheet";
import { UploadProgress } from "./AddPhotoSheet";

type NewTicketSheetProps = {
  nextNumber: number;
  onClose: () => void;
  onCreated: (ticket: TicketDTO) => void;
  onShowExisting: (ticket: TicketDTO) => void;
};

export function NewTicketSheet({ nextNumber, onClose, onCreated, onShowExisting }: NewTicketSheetProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<TicketDTO | null>(null);
  // A photo makes the ticket virtual (docs/PHOTO_TICKETS.md). It's shrunk as
  // soon as it's picked, so Create only has to upload it.
  const [photo, setPhoto] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  // Set once the ticket exists but its photo didn't make it, so Retry doesn't create a second ticket.
  const [pendingPhoto, setPendingPhoto] = useState<TicketDTO | null>(null);

  const mutation = useCreateTicket();
  const uploadPhoto = useUploadPhoto();

  useEffect(() => {
    const url = photo?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo?.previewUrl]);

  async function handleFile(file: File) {
    setPhotoError(null);
    try {
      const blob = await resizeToJpeg(file);
      setPhoto({ blob, previewUrl: URL.createObjectURL(blob) });
    } catch (err) {
      setPhotoError(err instanceof PhotoReadError ? err.message : "Couldn't read this photo, try taking a new one.");
    }
  }

  async function uploadFor(ticket: TicketDTO) {
    if (!photo) {
      onCreated(ticket);
      return;
    }
    setProgress(0);
    try {
      const result = await uploadPhoto.mutateAsync({ id: ticket.id, photo: photo.blob, onProgress: setProgress });
      onCreated(result.ticket);
    } catch (err) {
      setProgress(null);
      setPendingPhoto(ticket);
      setError(
        err instanceof ApiError ? err.message : "The photo didn't upload. Check your connection and try again.",
      );
    }
  }

  async function submit(force = false) {
    setError(null);
    try {
      const result = await mutation.mutateAsync({ name, phone, notes: notes || undefined, force });
      await uploadFor(result.ticket);
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_ACTIVE_TICKET" && err.details?.existing) {
        setDuplicate(err.details.existing as TicketDTO);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  const uploading = progress !== null;
  const busy = mutation.isPending || uploading;
  const canSubmit = name.trim().length > 0 && phone.trim().length > 0 && !busy;

  function primaryAction() {
    if (pendingPhoto) {
      setError(null);
      void uploadFor(pendingPhoto);
    } else {
      void submit(false);
    }
  }

  return (
    <>
      <Sheet
        title="New Ticket"
        subtitle={`Will be #${nextNumber}`}
        onClose={onClose}
        headerAction={
          <button
            type="button"
            onClick={primaryAction}
            disabled={!canSubmit}
            aria-label="Create ticket"
            className="flex h-11 w-11 cursor-pointer items-center justify-center shape-sq bg-accent text-on-accent disabled:cursor-default disabled:opacity-50"
          >
            <Check className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        }
      >
        <GroupedList>
          <div className="flex h-[52px] items-center gap-3 px-4">
            <label htmlFor="nt-name" className="w-16 text-[17px]">
              Name
            </label>
            <input
              id="nt-name"
              type="text"
              autoFocus
              autoCapitalize="words"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-w-0 flex-grow border-none bg-transparent text-[17px] text-label outline-none"
            />
          </div>
          <GroupedSeparator />
          <div className="flex h-[52px] items-center gap-3 px-4">
            <label htmlFor="nt-phone" className="w-16 text-[17px]">
              Phone
            </label>
            <input
              id="nt-phone"
              type="tel"
              placeholder="081234567890"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="min-w-0 flex-grow border-none bg-transparent text-[17px] text-label outline-none placeholder:text-label-2"
            />
          </div>
        </GroupedList>

        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 px-4 text-[13px] font-semibold uppercase tracking-[0.02em] text-label-2">
            Photo &middot; optional
          </h3>
          <GroupedList>
            {photo ? (
              <div className="flex items-center gap-3 p-3">
                <img src={photo.previewUrl} alt="Photo to draw from" className="h-20 w-20 shrink-0 object-cover shape-tile" />
                <div className="flex min-w-0 flex-grow flex-col items-start gap-1">
                  <button type="button" disabled={busy} onClick={() => setPhoto(null)} className="h-11 cursor-pointer bg-transparent text-[17px] text-danger disabled:opacity-50">
                    Remove
                  </button>
                </div>
              </div>
            ) : null}
            {photo ? <GroupedSeparator inset={16} /> : null}
            <PhotoPickButtons
              onFile={handleFile}
              disabled={busy || pendingPhoto != null}
              takeLabel={photo ? "Retake" : "Take Photo"}
              chooseLabel="Choose from Library"
            />
          </GroupedList>
          <p className="m-0 px-4 text-[13px] text-label-2">
            Adding a photo makes this a virtual session: we draw from the photo and they pick up the portrait later.
            The photo is deleted once the drawing is done.
          </p>
          {photoError ? <p className="m-0 px-4 text-[15px] text-danger">{photoError}</p> : null}
        </div>

        <GroupedList>
          <div className="min-h-16 px-4 py-3.5">
            <label htmlFor="nt-notes" className="sr-only">
              Note for the illustrator
            </label>
            <input
              id="nt-notes"
              type="text"
              placeholder="Note (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full border-none bg-transparent text-[17px] text-label outline-none placeholder:text-label-2"
            />
          </div>
        </GroupedList>

        {uploading ? <UploadProgress percent={progress} /> : null}
        {pendingPhoto ? (
          <p className="m-0 px-1 text-[15px]">
            Ticket #{pendingPhoto.number} is created, but its photo didn&apos;t upload.
          </p>
        ) : null}
        {error ? <p className="m-0 px-1 text-[15px] text-danger">{error}</p> : null}

        <CapsuleButton onClick={primaryAction} disabled={!canSubmit} pending={busy}>
          {pendingPhoto ? "Retry Upload" : "Create Ticket & Show QR"}
        </CapsuleButton>
        {pendingPhoto ? (
          <CapsuleButton variant="secondary" size="md" disabled={busy} onClick={() => onCreated(pendingPhoto)}>
            Skip Photo
          </CapsuleButton>
        ) : null}
      </Sheet>

      {duplicate ? (
        <ConfirmSheet
          title={`${duplicate.name} (#${duplicate.number}) already has a ticket with this number`}
          cancelLabel="Show Their QR"
          confirmLabel="Create Anyway"
          pending={mutation.isPending}
          onCancel={() => {
            const existing = duplicate;
            setDuplicate(null);
            onShowExisting(existing);
          }}
          onConfirm={() => {
            setDuplicate(null);
            void submit(true);
          }}
        />
      ) : null}
    </>
  );
}
