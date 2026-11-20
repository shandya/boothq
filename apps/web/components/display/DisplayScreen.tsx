"use client";

import { useEffect } from "react";
import { useT } from "../../lib/i18n";
import { useNowServing } from "../../lib/queries";
import { LanguageSwitch } from "../ui/LanguageSwitch";
import { useOnlineStatus } from "../ui/OfflineBanner";

const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? "the booth";

// Public tablet/TV screen at the booth (docs/UI.md → Display). Numbers only, no names.
export function DisplayScreen() {
  const t = useT();
  const online = useOnlineStatus();
  const { data, isError } = useNowServing();

  useEffect(() => {
    document.title = `${boothName}`;
  }, []);

  const closed = data != null && !data.boothOpen;
  const reconnecting = !online || (isError && data != null);

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-[6vw] py-[4vh] text-label">
      <header className="flex items-center justify-between gap-4">
        <h1 className="truncate text-[clamp(24px,4vw,48px)] text-label-2">{boothName}</h1>
        <LanguageSwitch className="w-28 shrink-0" />
      </header>

      <section className="flex flex-1 flex-col items-center justify-center text-center">
        {data == null ? null : closed ? (
          <p className="text-[clamp(32px,6vw,80px)] text-label-2">{t("display.closed")}</p>
        ) : (
          <>
            <p className="text-[clamp(28px,5vw,64px)] text-label-2">{t("display.nowServing")}</p>
            {data.nowServing != null ? (
              <p aria-live="polite" className="text-[clamp(120px,32vw,420px)] leading-none text-accent">
                #{data.nowServing}
              </p>
            ) : (
              <p className="mt-6 text-[clamp(32px,6vw,80px)] text-label-2">{t("display.none")}</p>
            )}
            {data.paused ? (
              <p
                role="status"
                className="mt-8 rounded-2xl bg-status-orange-bg px-8 py-4 text-[clamp(24px,4vw,48px)] text-status-orange-fg"
              >
                {t("display.break")}
              </p>
            ) : null}
          </>
        )}
      </section>

      <footer className="flex flex-col items-center gap-2 text-center">
        {data != null && data.boothOpen && data.next.length > 0 ? (
          <p className="text-[clamp(28px,5vw,64px)]">
            <span className="text-label-2">{t("display.next")}: </span>
            {data.next.join(" · ")}
          </p>
        ) : null}
        {data != null && data.boothOpen && data.waitingCount > 0 ? (
          <p className="text-[clamp(18px,2.5vw,32px)] text-label-2">
            {data.waitingCount === 1 ? t("display.waiting1") : t("display.waitingN", { n: data.waitingCount })}
          </p>
        ) : null}
        {reconnecting ? (
          <p role="status" className="text-[clamp(16px,2vw,24px)] text-status-orange-fg">
            {t("display.offline")}
          </p>
        ) : null}
      </footer>
    </main>
  );
}
