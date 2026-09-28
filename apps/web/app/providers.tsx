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

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onSuccess: trackServerTime }),
        mutationCache: new MutationCache({ onSuccess: trackServerTime }),
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
