import Link from "next/link";
import { useT } from "../../lib/i18n";
import { LanguageSwitch } from "../ui/LanguageSwitch";
import { GroupedSeparator } from "../ui/GroupedList";

type AdminMenuProps = {
  onClose: () => void;
  onSettings: () => void;
  onEvents: () => void;
  onCloseBooth: () => void;
  onLogout: () => void;
};

export function AdminMenu({
  onClose,
  onSettings,
  onEvents,
  onCloseBooth,
  onLogout,
}: AdminMenuProps) {
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
        <div className="flex flex-col overflow-hidden shape-tile sticker bg-card shadow-(--glass-shadow)">
          <Link
            href="/illustrator"
            className="flex h-[52px] items-center justify-center text-[17px] text-link no-underline"
          >
            {t("admin.menu.illustratorView")}
          </Link>
          <GroupedSeparator inset={0} />
          <Link
            href="/admin/history"
            className="flex h-[52px] items-center justify-center text-[17px] text-link no-underline"
          >
            {t("admin.menu.dayHistory")}
          </Link>
          <GroupedSeparator inset={0} />
          <button
            type="button"
            onClick={onSettings}
            className="flex h-[52px] cursor-pointer items-center justify-center bg-transparent text-[17px] text-link"
          >
            {t("admin.menu.settings")}
          </button>
          <GroupedSeparator inset={0} />
          <button
            type="button"
            onClick={onEvents}
            className="flex h-[52px] cursor-pointer items-center justify-center bg-transparent text-[17px] text-link"
          >
            {t("admin.menu.events")}
          </button>
          <GroupedSeparator inset={0} />
          <button
            type="button"
            onClick={onCloseBooth}
            className="flex h-[52px] cursor-pointer items-center justify-center bg-transparent text-[17px] text-danger"
          >
            {t("admin.menu.closeBooth")}
          </button>
        </div>
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
