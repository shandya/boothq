"use client";

import { IllustratorScreen } from "../../components/illustrator/IllustratorScreen";
import { RoleGuard } from "../../components/RoleGuard";

export default function IllustratorPage() {
  return (
    <RoleGuard minRole="ILLUSTRATOR">
      <IllustratorScreen />
    </RoleGuard>
  );
}
