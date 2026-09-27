import { Check, Copy, MessageCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TicketNumber } from "./TicketNumber";

type QrFullscreenProps = {
  number: number;
  name: string;
  url: string;
  onWhatsApp: () => void;
  onCopyLink: () => void;
  onDone: () => void;
};

function displayUrl(url: string): string {
  const stripped = url.replace(/^https?:\/\//, "");
  return stripped.length <= 40 ? stripped : `${stripped.slice(0, 37)}…`;
}

// The QR always sits on a white card with black modules, even in dark mode
// (scanners need dark-on-light) — docs/UI.md → Color exceptions.
export function QrFullscreen({ number, name, url, onWhatsApp, onCopyLink, onDone }: QrFullscreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col gap-4 bg-bg px-4 pb-[110px] pt-3 text-label">
      <header className="flex h-11 items-center justify-between px-1">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-status-green-fg">
          <Check className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          Ticket created
        </span>
        <button
          type="button"
          onClick={onDone}
          className="glass h-11 cursor-pointer rounded-full px-[18px] text-[17px] font-semibold text-link"
        >
          Done
        </button>
      </header>

      <div className="mt-1 flex flex-col items-center gap-0.5">
        <TicketNumber number={number} size="lg" />
        <span className="text-[22px] font-semibold">{name}</span>
      </div>

      <div className="self-center rounded-[32px] bg-white p-[18px] shadow-[0_6px_24px_rgba(0,0,0,0.10)]">
        <QRCodeSVG value={url} size={250} level="M" marginSize={4} title={`QR code for ticket ${number}`} />
      </div>

      <p className="m-0 text-center text-[17px] leading-[1.4] text-label-2">
        Ask {name} to scan this with
        <br />
        their phone camera.
      </p>
      <p className="m-0 text-center font-mono text-[13px] text-label-2">{displayUrl(url)}</p>

      <div className="fixed inset-x-3 bottom-6 glass grid grid-cols-2 gap-1.5 rounded-full p-1.5">
        <button
          type="button"
          onClick={onWhatsApp}
          className="flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-full bg-fill text-[15px] font-semibold text-link"
        >
          <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          WhatsApp
        </button>
        <button
          type="button"
          onClick={onCopyLink}
          className="flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-full bg-fill text-[15px] font-semibold text-link"
        >
          <Copy className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          Copy Link
        </button>
      </div>
    </div>
  );
}
