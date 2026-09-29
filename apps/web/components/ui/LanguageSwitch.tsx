"use client";

import { LANGS, useI18n } from "../../lib/i18n";
import { SegmentedControl } from "./SegmentedControl";

// EN / ID toggle. The choice is stored per device and per part of the site
// (customer, illustrator, admin), so each role keeps its own.
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t("common.language")} className={className}>
      <SegmentedControl options={LANGS} value={lang} onChange={setLang} />
    </div>
  );
}
