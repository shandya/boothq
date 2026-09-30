import Link from "next/link";
import { useT } from "../../lib/i18n";
import { LanguageSwitch } from "../ui/LanguageSwitch";

type IllustratorMenuProps = {
  isAdmin: boolean;
  onClose: () => void;
  onLogout: () => void;
};

// Admins see an extra Admin View link (docs/UI.md → Illustrator: /illustrator).
export function IllustratorMenu({ isAdmin, onClose, onLogout }: IllustratorMenuProps) {
  const t = useT();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-dim" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex w-[calc(100vw-30px)] max-w-105 flex-col gap-2">
        <div className="shape-tile sticker bg-card p-2 shadow-(--glass-shadow)">
          <LanguageSwitch />
        </div>
        {isAdmin ? (
          <Link
            href="/admin"
            className="flex h-[52px] items-center justify-center shape-tile sticker bg-card text-[17px] text-link no-underline shadow-(--glass-shadow)"
          >
            {t("ill.menu.adminView")}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onLogout}
          className="flex h-[52px] cursor-pointer items-center justify-center shape-tile sticker bg-card text-[17px] font-semibold text-link shadow-(--glass-shadow)"
        >
          {t("common.logOut")}
        </button>
      </div>
    </div>
  );
}
