import { ApiError } from "../api";
import type { TFunction, TKey } from "./index";

// Turns an API failure into a message in the reader's language. The server
// only sends English, so known error codes map to dictionary entries and
// anything unknown falls back to the caller's own text.
export function errorText(
  error: unknown,
  t: TFunction,
  fallback: TKey = "common.somethingWrong",
): string {
  if (!(error instanceof ApiError)) return t(fallback);
  if (error.code === "VALIDATION_ERROR" && /phone/i.test(error.message))
    return t("err.INVALID_PHONE");
  const key = `err.${error.code}` as TKey;
  try {
    return t(key) === key ? t(fallback) : t(key);
  } catch {
    return t(fallback);
  }
}
