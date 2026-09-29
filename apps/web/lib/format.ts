// Formats a moment as a 24-hour clock time for display, e.g. "16:40"
// (docs/UI.md shows times this way throughout the admin/illustrator screens).
export function formatClockTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

// e.g. "12 Sep"
export function formatShortDate(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}
