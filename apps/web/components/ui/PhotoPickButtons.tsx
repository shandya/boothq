"use client";

import { Camera, ImageIcon } from "lucide-react";
import { useRef } from "react";
import { GroupedSeparator } from "./GroupedList";

type PhotoPickButtonsProps = {
  onFile: (file: File) => void;
  disabled?: boolean;
  takeLabel?: string;
  chooseLabel?: string;
};

// Two rows sharing one shape: the camera (capture) and the photo library.
export function PhotoPickButtons({
  onFile,
  disabled,
  takeLabel = "Take Photo",
  chooseLabel = "Choose from Library",
}: PhotoPickButtonsProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // picking the same photo again must still fire
    if (file) onFile(file);
  }

  const rowClass =
    "flex h-[50px] w-full cursor-pointer items-center gap-3 bg-transparent px-4 text-left text-[17px] text-link disabled:cursor-default disabled:opacity-50";

  return (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      <button type="button" disabled={disabled} onClick={() => cameraRef.current?.click()} className={rowClass}>
        <Camera className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        {takeLabel}
      </button>
      <GroupedSeparator inset={48} />
      <button type="button" disabled={disabled} onClick={() => libraryRef.current?.click()} className={rowClass}>
        <ImageIcon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        {chooseLabel}
      </button>
    </>
  );
}
