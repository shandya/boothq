"use client";

import { useEffect, useState } from "react";
import { useT } from "../../lib/i18n";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

type OfflineBannerProps = {
  lastUpdated?: Date | string | null;
};

// "Offline — showing info from 14:32" (docs/UI.md → Design principles).
export function OfflineBanner({ lastUpdated }: OfflineBannerProps) {
  const t = useT();
  const online = useOnlineStatus();
  if (online) return null;

  const time = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      role="status"
      className="flex h-9 items-center justify-center bg-status-orange-bg px-4 text-[13px] font-medium text-status-orange-fg"
    >
      {time ? t("ui.offline.since", { time }) : t("ui.offline")}
    </div>
  );
}
