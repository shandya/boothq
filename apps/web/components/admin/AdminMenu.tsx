import Link from "next/link";
import { GroupedSeparator } from "../ui/GroupedList";

type AdminMenuProps = {
  onClose: () => void;
  onSettings: () => void;
  onCloseBooth: () => void;
  onLogout: () => void;
};

export function AdminMenu({ onClose, onSettings, onCloseBooth, onLogout }: AdminMenuProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end gap-2 p-2" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-dim" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex flex-col overflow-hidden rounded-[20px] bg-sheet">
        <Link
          href="/illustrator"
          className="flex h-[52px] items-center justify-center text-[17px] text-link no-underline"
        >
          Illustrator View
        </Link>
        <GroupedSeparator inset={0} />
        <button
          type="button"
          onClick={onSettings}
          className="flex h-[52px] cursor-pointer items-center justify-center bg-transparent text-[17px] text-link"
        >
          Settings
        </button>
        <GroupedSeparator inset={0} />
        <button
          type="button"
          onClick={onCloseBooth}
          className="flex h-[52px] cursor-pointer items-center justify-center bg-transparent text-[17px] text-danger"
        >
          Close Booth
        </button>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="relative z-10 flex h-[52px] cursor-pointer items-center justify-center rounded-[20px] bg-sheet text-[17px] font-semibold text-link"
      >
        Log Out
      </button>
    </div>
  );
}
