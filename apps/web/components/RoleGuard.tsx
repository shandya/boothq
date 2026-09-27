"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { me } from "../lib/api";

type Role = "ADMIN" | "ILLUSTRATOR";

// ADMIN can do everything ILLUSTRATOR can (see CLAUDE.md → What we're
// building), so minRole="ILLUSTRATOR" admits either role.
function satisfiesRole(actual: Role, minRole: Role): boolean {
  return minRole === "ILLUSTRATOR" || actual === "ADMIN";
}

export function RoleGuard({ minRole, children }: { minRole: Role; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const query = useQuery({
    queryKey: ["auth-me"],
    queryFn: me,
    retry: false,
  });

  useEffect(() => {
    if (query.isError) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
    }
  }, [query.isError, pathname, router]);

  useEffect(() => {
    if (query.data && !satisfiesRole(query.data.role, minRole)) {
      router.replace("/illustrator");
    }
  }, [query.data, minRole, router]);

  const authorized = query.data && satisfiesRole(query.data.role, minRole);

  if (!authorized) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-fill border-t-label-2"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  return <>{children}</>;
}
