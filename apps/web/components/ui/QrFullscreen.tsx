import { Check, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useT } from "../../lib/i18n";
import { TicketNumber } from "./TicketNumber";

type QrFullscreenProps = {
  number: number;
  name: string;
  url: string;
  onCopyLink: () => void;
  onDone: () => void;
};

function displayUrl(url: string): string {
  const stripped = url.replace(/^https?:\/\//, "");
  return stripped.length <= 40 ? stripped : `${stripped.slice(0, 37)}…`;
}

// The QR always sits on a white card with black modules, even in dark mode
// (scanners need dark-on-light) — docs/UI.md → Color exceptions.
export function QrFullscreen({ number, name, url, onCopyLink, onDone }: QrFullscreenProps) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 flex flex-col gap-4 bg-bg px-4 pb-[110px] pt-3 text-label">
      <header className="flex h-11 items-center justify-between px-1">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-status-green-fg">
          <Check className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          {t("ui.qr.created")}
        </span>
        <button
          type="button"
          onClick={onDone}
          className="glass h-11 cursor-pointer shape-sq px-[18px] text-[17px] font-semibold text-link"
        >
          {t("common.done")}
        </button>
      </header>

      <div className="mt-1 flex flex-col items-center gap-0.5">
        <TicketNumber number={number} size="lg" />
        <span className="text-[22px] font-semibold">{name}</span>
      </div>

      <div className="self-center shape-card sticker bg-white p-[18px]">
        <QRCodeSVG value={url} size={250} level="M" marginSize={4} title={t("qr.qrAlt", { n: number })} />
      </div>

      <p className="m-0 text-center text-[17px] leading-[1.4] text-label-2">
        {t("qr.askScan", { name })}
        <br />
        {t("qr.theirCamera")}
      </p>
      <p className="m-0 text-center font-mono text-[13px] text-label-2">{displayUrl(url)}</p>

      <div className="fixed inset-x-3 bottom-6 glass shape-sq p-1.5">
        <button
          type="button"
          onClick={onCopyLink}
          className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 shape-sq bg-fill text-[15px] font-semibold text-link"
        >
          <Copy className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          {t("qr.copyLink")}
        </button>
      </div>
    </div>
  );
}
