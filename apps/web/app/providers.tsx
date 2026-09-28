"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../lib/api";
import { setServerTime } from "../lib/server-time";

function extractServerTime(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  if ("serverTime" in data && typeof (data as { serverTime?: unknown }).serverTime === "string") {
    return (data as { serverTime: string }).serverTime;
  }
  if ("snapshot" in data) {
    return extractServerTime((data as { snapshot?: unknown }).snapshot);
  }
  return null;
}

function trackServerTime(data: unknown): void {
  const serverTime = extractServerTime(data);
  if (serverTime) setServerTime(serverTime);
}

// A session (12h JWT) can expire mid-use; without this, a staff screen's
// polls just start failing silently with no indication to log in again
// (docs/IMPLEMENTATION_PLAN.md Phase 6 → error states on every screen).
function redirectToLoginOn401(error: unknown): void {
  if (typeof window === "undefined") return;
  if (!(error instanceof ApiError) || error.status !== 401) return;
  if (window.location.pathname.startsWith("/login")) return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/login?next=${next}`);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onSuccess: trackServerTime,
          onError: redirectToLoginOn401,
        }),
        mutationCache: new MutationCache({
          onSuccess: trackServerTime,
          onError: redirectToLoginOn401,
        }),
        defaultOptions: {
          queries: {
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status < 500) && failureCount < 2,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
