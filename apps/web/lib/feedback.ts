import { ApiError } from "./api";

// Haptic tap feedback on a successful mutation, where supported
// (docs/UI.md → Illustrator: /illustrator, Feedback; PRD I13).
export function vibrate(ms = 10): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
}

// A stale-state 409 means someone else changed the queue first; the
// mutation hooks already resync `details.snapshot` into the cache, this
// just tells the illustrator why nothing happened (docs/UI.md → Feedback).
export function onStale(showToast: (message: string) => void) {
  return (error: unknown) => {
    if (error instanceof ApiError && error.status === 409) showToast("Already updated");
  };
}
