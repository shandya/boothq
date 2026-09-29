import { describe, expect, it } from "vitest";
import { nationalDisplay, normalizePhone } from "./phone.js";

describe("normalizePhone", () => {
  it("normalizes a local-format number", () => {
    const result = normalizePhone("0812-3456-7890", "ID");
    expect(result).toEqual({ valid: true, e164: "+6281234567890", national: "0812-3456-7890" });
  });

  it("normalizes a number already given with a country code", () => {
    const result = normalizePhone("+62 812-3456-7890", "ID");
    expect(result).toEqual({ valid: true, e164: "+6281234567890", national: "0812-3456-7890" });
  });

  it("normalizes a number with spaces and dashes", () => {
    const result = normalizePhone("0812 3456 7890", "ID");
    expect(result).toEqual({ valid: true, e164: "+6281234567890", national: "0812-3456-7890" });
  });

  it("rejects an invalid number", () => {
    const result = normalizePhone("123", "ID");
    expect(result).toEqual({ valid: false });
  });

  it("rejects an empty string", () => {
    const result = normalizePhone("", "ID");
    expect(result).toEqual({ valid: false });
  });
});

describe("nationalDisplay", () => {
  it("formats a stored E.164 number for display", () => {
    expect(nationalDisplay("+6281234567890")).toBe("0812-3456-7890");
  });

  it("returns null for an unparseable string", () => {
    expect(nationalDisplay("not-a-phone")).toBeNull();
  });
});
