"use client";

import { useState } from "react";
import { ApiError } from "../../lib/api";
import { useRenameEvent, useStartEvent } from "../../lib/queries";
import { CapsuleButton } from "../ui/CapsuleButton";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { GroupedList } from "../ui/GroupedList";
import { Sheet } from "../ui/Sheet";

type EventNameSheetProps = {
  mode: "start" | "rename";
  // Name of the ACTIVE event, if any. Renaming edits it; starting ends it.
  currentName: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
};

const NAME_MAX = 60;

export function EventNameSheet({ mode, currentName, onClose, onDone }: EventNameSheetProps) {
  const [name, setName] = useState(mode === "rename" ? (currentName ?? "") : "");
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const start = useStartEvent();
  const rename = useRenameEvent();
  const pending = start.isPending || rename.isPending;

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= NAME_MAX && !pending;

  function fail(err: unknown) {
    setConfirmEnd(false);
    setError(err instanceof ApiError ? err.message : "Something went wrong.");
  }

  function submit() {
    setError(null);
    if (mode === "rename") {
      rename.mutate({ name: trimmed }, { onSuccess: () => onDone("Event renamed"), onError: fail });
      return;
    }
    start.mutate({ name: trimmed }, { onSuccess: () => onDone("Event started"), onError: fail });
  }

  // Starting over an ACTIVE event ends it, so it asks first.
  function handlePrimary() {
    if (mode === "start" && currentName) {
      setConfirmEnd(true);
      return;
    }
    submit();
  }

  return (
    <>
      <Sheet title={mode === "start" ? "Start Event" : "Rename Event"} onClose={onClose}>
        <GroupedList>
          <div className="flex h-[52px] items-center gap-3 px-4">
            <label htmlFor="ev-name" className="w-16 text-[17px]">
              Name
            </label>
            <input
              id="ev-name"
              type="text"
              autoFocus
              autoCapitalize="words"
              maxLength={NAME_MAX}
              placeholder="Comic Con Jakarta 2026"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSubmit) handlePrimary();
              }}
              className="min-w-0 flex-grow border-none bg-transparent text-[17px] text-label outline-none placeholder:text-label-2"
            />
          </div>
        </GroupedList>

        {mode === "start" ? (
          <p className="m-0 px-4 text-[13px] text-label-2">
            Wait-time estimates will start fresh for this event.
            {currentName ? ` This ends ${currentName}.` : ""}
          </p>
        ) : null}

        {error ? <p className="m-0 px-1 text-[15px] text-danger">{error}</p> : null}

        <CapsuleButton onClick={handlePrimary} disabled={!canSubmit} pending={pending}>
          {mode === "start" ? "Start Event" : "Save"}
        </CapsuleButton>
      </Sheet>

      {confirmEnd ? (
        <ConfirmSheet
          title={`End ${currentName} and start ${trimmed}?`}
          description="Wait-time estimates will start fresh."
          confirmLabel="Start Event"
          pending={pending}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={submit}
        />
      ) : null}
    </>
  );
}
