"use client";

import { HistoryScreen } from "../../../components/admin/HistoryScreen";
import { RoleGuard } from "../../../components/RoleGuard";

export default function HistoryPage() {
  return (
    <RoleGuard minRole="ADMIN">
      <HistoryScreen />
    </RoleGuard>
  );
}
