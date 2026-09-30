import { useT } from "../../lib/i18n";

export function UploadProgress({ percent }: { percent: number | null }) {
  const t = useT();
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      aria-label={t("ui.photo.uploading")}
      className="h-2 w-full overflow-hidden shape-sq bg-track"
    >
      <div className="h-full bg-accent transition-[width]" style={{ width: `${percent ?? 0}%` }} />
    </div>
  );
}
