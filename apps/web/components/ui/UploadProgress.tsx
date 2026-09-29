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
