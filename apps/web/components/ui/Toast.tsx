"use client";

import { useCallback, useEffect, useState } from "react";

export function useToast(durationMs = 2400) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), durationMs);
    return () => clearTimeout(id);
  }, [message, durationMs]);

  const showToast = useCallback((next: string) => setMessage(next), []);

  return { message, showToast };
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="glass pointer-events-none fixed left-1/2 top-6 z-[60] -translate-x-1/2 rounded-full px-4 py-2.5 text-[15px] font-medium text-label"
    >
      {message}
    </div>
  );
}
