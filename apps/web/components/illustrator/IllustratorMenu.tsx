import Link from "next/link";

type IllustratorMenuProps = {
  isAdmin: boolean;
  onClose: () => void;
  onLogout: () => void;
};

// Admins see an extra Admin View link (docs/UI.md → Illustrator: /illustrator).
export function IllustratorMenu({ isAdmin, onClose, onLogout }: IllustratorMenuProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end gap-2 p-2" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-dim" onClick={onClose} aria-hidden="true" />
      {isAdmin ? (
        <Link
          href="/admin"
          className="relative z-10 flex h-[52px] items-center justify-center rounded-[20px] bg-sheet text-[17px] text-link no-underline"
        >
          Admin View
        </Link>
      ) : null}
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
