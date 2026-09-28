// PUBLIC_WEB_URL is hand-typed into a hosting dashboard, so tolerate a
// trailing slash or path: browsers send a bare origin in the Origin header,
// and customer links must not end up as `https://host//t/...`.
export function publicWebOrigin(): string {
  const raw = process.env.PUBLIC_WEB_URL?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}
