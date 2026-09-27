import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type PhoneParseResult =
  | { valid: true; e164: string; national: string }
  | { valid: false };

export function normalizePhone(input: string, defaultCountry: CountryCode): PhoneParseResult {
  const phoneNumber = parsePhoneNumberFromString(input, defaultCountry);
  if (!phoneNumber || !phoneNumber.isValid()) {
    return { valid: false };
  }
  return {
    valid: true,
    e164: phoneNumber.number,
    national: phoneNumber.formatNational(),
  };
}

export function getDefaultCountry(): CountryCode {
  const country = process.env.DEFAULT_COUNTRY;
  if (!country) {
    throw new Error("DEFAULT_COUNTRY env var is required");
  }
  return country as CountryCode;
}

// For display only: recovers the national format from a stored E.164 number.
export function nationalDisplay(e164: string): string | null {
  const phoneNumber = parsePhoneNumberFromString(e164);
  return phoneNumber?.isValid() ? phoneNumber.formatNational() : null;
}
