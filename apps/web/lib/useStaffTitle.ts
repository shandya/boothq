"use client";

import { useEffect } from "react";

const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? "the booth";

// Staff screens combine the app's own name with the booth's, e.g.
// "BoothQ · My Illustration Booth" (docs/IMPLEMENTATION_PLAN.md Phase 6).
// Customer-facing screens never call this — they set their own title
// instead (components/customer/CustomerScreen.tsx) — per CLAUDE.md's
// naming rule: customers never see "BoothQ".
export function useStaffTitle(): void {
  useEffect(() => {
    document.title = `BoothQ · ${boothName}`;
  }, []);
}
