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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-dim" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex w-[calc(100vw-30px)] max-w-105 flex-col gap-2">
        <div className="flex flex-col overflow-hidden rounded-[20px] border border-separator bg-card shadow-(--glass-shadow)">
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
          className="flex h-[52px] cursor-pointer items-center justify-center rounded-[20px] border border-separator bg-card text-[17px] font-semibold text-link shadow-(--glass-shadow)"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
