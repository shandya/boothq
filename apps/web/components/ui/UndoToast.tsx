"use client";

import type { UndoDTO } from "@boothq/shared";
import { useEffect } from "react";
import { ApiError } from "../../lib/api";
import { vibrate } from "../../lib/feedback";
import { useUndo } from "../../lib/queries";
import { clearUndoOffer, UNDO_TOAST_MS, useUndoOffer } from "../../lib/undo-store";

function label(undo: UndoDTO): string {
  const n = undo.ticketNumber;
  switch (undo.action) {
    case "CALL_NEXT":
      return `Called #${n}`;
    case "START":
      return `Started #${n}`;
    case "FINISH":
      return `Finished #${n}`;
    case "NO_SHOW":
      return `#${n} marked no-show`;
  }
}

type UndoToastProps = {
  // The snapshot's own `undo`. The offer only shows while it is still the
  // server's undoable action, so it disappears if anything newer happens.
  currentUndoId: string | null | undefined;
  onToast: (message: string) => void;
};

export function UndoToast({ currentUndoId, onToast }: UndoToastProps) {
  const offer = useUndoOffer();
  const undo = useUndo();
  const offerId = offer?.actionId ?? null;

  useEffect(() => {
    if (!offerId) return;
    const id = setTimeout(clearUndoOffer, UNDO_TOAST_MS);
    return () => clearTimeout(id);
  }, [offerId]);

  if (!offer || offer.actionId !== currentUndoId) return null;

  function handleUndo(target: UndoDTO) {
    undo.mutate(target.actionId, {
      onSuccess: () => {
        clearUndoOffer();
        vibrate();
        onToast("Undone");
      },
      onError: (error) => {
        clearUndoOffer();
        onToast(error instanceof ApiError && error.status === 409 ? "Can't undo — the queue changed" : "Couldn't undo");
      },
    });
  }

  return (
    <div
      role="status"
      className="glass fixed bottom-[164px] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full py-1 pl-4 pr-1 text-[15px] font-medium text-label"
    >
      <span className="whitespace-nowrap">{label(offer)}</span>
      <button
        type="button"
        onClick={() => handleUndo(offer)}
        disabled={undo.isPending}
        className="h-11 min-w-16 cursor-pointer rounded-full bg-transparent px-4 text-[15px] font-semibold text-link disabled:cursor-default disabled:opacity-50"
      >
        Undo
      </button>
    </div>
  );
}
