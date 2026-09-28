"use client";

import { AdminScreen } from "../../components/admin/AdminScreen";
import { RoleGuard } from "../../components/RoleGuard";

export default function AdminPage() {
  return (
    <RoleGuard minRole="ADMIN">
      <AdminScreen />
    </RoleGuard>
  );
}
