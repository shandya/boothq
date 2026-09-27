"use client";

// Every snapshot/view response carries serverTime; the client stores
// offset = serverTime - Date.now() and uses it for timers ("drawing for
// 6:12", "called 2 min ago") instead of trusting its own clock
// (docs/ARCHITECTURE.md → Live updates: polling).
let offsetMs = 0;
const listeners = new Set<() => void>();

export function setServerTime(serverTimeIso: string): void {
  const next = new Date(serverTimeIso).getTime() - Date.now();
  // Ignore small jitter from request latency so timers don't visibly jump.
  if (Math.abs(next - offsetMs) < 1000) return;
  offsetMs = next;
  for (const listener of listeners) listener();
}

export function getServerNow(): Date {
  return new Date(Date.now() + offsetMs);
}

export function subscribeServerTime(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getServerTimeOffsetSnapshot(): number {
  return offsetMs;
}
