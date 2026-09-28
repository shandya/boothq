"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Keeps the illustrator's screen on for the length of the console session
// (docs/UI.md → Illustrator: /illustrator, I12). The OS releases the lock
// whenever the tab is hidden, so it must be re-requested on visibilitychange;
// browsers without the API (or that deny the request) fall back to a
// "Tap to keep screen on" indicator that retries on a user gesture.
export function useWakeLock(): { active: boolean; request: () => void } {
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    navigator.wakeLock
      .request("screen")
      .then((sentinel) => {
        sentinelRef.current = sentinel;
        setActive(true);
        sentinel.addEventListener("release", () => setActive(false));
      })
      .catch(() => setActive(false));
  }, []);

  useEffect(() => {
    request();

    function onVisibilityChange() {
      if (document.visibilityState === "visible") request();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void sentinelRef.current?.release();
    };
  }, [request]);

  return { active, request };
}
