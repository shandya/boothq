"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { en } from "./en";
import { id } from "./id";

export type Lang = "en" | "id";
export const LANGS: Array<{ value: Lang; label: string }> = [
  { value: "en", label: "EN" },
  { value: "id", label: "ID" },
];

export type TKey = keyof typeof en;
export type TParams = Record<string, string | number>;
export type TFunction = (key: TKey, params?: TParams) => string;

const DICTIONARIES: Record<Lang, Record<TKey, string>> = { en, id };

// Customers, illustrators and admins each keep their own choice on their own
// device, so the storage key follows the part of the site being used.
type Scope = "customer" | "illustrator" | "admin" | "guest";

function scopeFor(pathname: string | null): Scope {
  if (pathname?.startsWith("/t/")) return "customer";
  if (pathname?.startsWith("/illustrator")) return "illustrator";
  if (pathname?.startsWith("/admin")) return "admin";
  return "guest"; // login and the landing page
}

const storageKey = (scope: Scope) => `boothq.lang.${scope}`;

function isLang(value: unknown): value is Lang {
  return value === "en" || value === "id";
}

// First visit: follow the phone's language, otherwise English.
function readLang(scope: Scope): Lang {
  try {
    const stored = window.localStorage.getItem(storageKey(scope));
    if (isLang(stored)) return stored;
  } catch {
    // storage blocked (private mode): fall through to the browser language
  }
  return navigator.language?.toLowerCase().startsWith("id") ? "id" : "en";
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

type I18nValue = { lang: Lang; setLang: (lang: Lang) => void; t: TFunction };

const I18nContext = createContext<I18nValue>({
  lang: "en",
  setLang: () => {},
  t: (key, params) => interpolate(en[key], params),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const scope = scopeFor(usePathname());
  // The server always renders English; the phone's own choice takes over after hydration.
  const lang = useSyncExternalStore(
    subscribe,
    () => readLang(scope),
    () => "en" as Lang,
  );

  const setLang = useCallback(
    (next: Lang) => {
      try {
        window.localStorage.setItem(storageKey(scope), next);
      } catch {
        // not persisted, but still applies until reload
      }
      listeners.forEach((listener) => listener());
    },
    [scope],
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key, params) => interpolate(DICTIONARIES[lang][key] ?? en[key], params),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export function useT(): TFunction {
  return useContext(I18nContext).t;
}
