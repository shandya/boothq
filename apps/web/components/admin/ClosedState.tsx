import { CapsuleButton } from "../ui/CapsuleButton";

export function ClosedState({ onOpenBooth }: { onOpenBooth: () => void }) {
  const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? "the booth";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 text-center text-label">
      <div className="flex flex-col items-center gap-2 rounded-[28px] bg-card px-8 py-10">
        <span className="text-[17px] font-semibold">Booth is closed</span>
        <span className="text-[13px] text-label-2">{boothName}</span>
      </div>
      <CapsuleButton onClick={onOpenBooth} className="max-w-[280px]">
        Open Booth
      </CapsuleButton>
    </div>
  );
}
