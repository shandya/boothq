"use client";

import type { UndoDTO } from "@boothq/shared";
import { useSyncExternalStore } from "react";

// Which Undo the acting phone should currently be offered. The server decides
// what is undoable (QueueSnapshot.undo); this only remembers that *this* phone
// just did it, so the 10 s toast shows on the phone that tapped, not on every
// phone polling the queue (docs/UI.md → Feedback).
export const UNDO_TOAST_MS = 10_000;

let offer: UndoDTO | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function offerUndo(undo: UndoDTO | null | undefined): void {
  offer = undo ?? null;
  emit();
}

export function clearUndoOffer(): void {
  if (offer === null) return;
  offer = null;
  emit();
}

export function useUndoOffer(): UndoDTO | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => offer,
    () => null,
  );
}
