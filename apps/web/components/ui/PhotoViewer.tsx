"use client";

import { X } from "lucide-react";
import { useState } from "react";

type PhotoViewerProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

// Full-screen photo. The page itself is the zoom surface: `touch-action:
// pinch-zoom` lets the browser handle pinch and pan natively.
export function PhotoViewer({ src, alt, onClose }: PhotoViewerProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-dim backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="absolute inset-0 bg-bg opacity-95" aria-hidden="true" onClick={onClose} />
      <img src={src} alt={alt} className="relative max-h-full max-w-full object-contain" style={{ touchAction: "pinch-zoom" }} />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-4 flex h-11 w-11 cursor-pointer items-center justify-center shape-sq bg-fill text-label"
      >
        <X className="h-5 w-5" strokeWidth={2} />
      </button>
    </div>
  );
}

// A tappable thumbnail that opens the full-screen viewer.
export function PhotoThumb({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="flex h-32 items-center justify-center text-[15px] text-label-2">Photo unavailable</div>;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="View photo full screen" className="block w-full cursor-zoom-in bg-transparent p-0">
        <img src={src} alt={alt} onError={() => setFailed(true)} className={className} />
      </button>
      {open ? <PhotoViewer src={src} alt={alt} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
