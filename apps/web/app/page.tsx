"use client";

import Link from "next/link";
import { LanguageSwitch } from "../components/ui/LanguageSwitch";
import { useT } from "../lib/i18n";

export default function HomePage() {
  const t = useT();
  const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? t("common.the_booth");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">{boothName}</h1>
      <Link href="/login" className="text-sm underline">
        {t("home.staffLogin")}
      </Link>
      <LanguageSwitch className="w-28" />
    </main>
  );
}
