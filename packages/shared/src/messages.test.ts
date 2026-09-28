import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl } from "./messages.js";

describe("buildWhatsAppUrl", () => {
  it("strips non-digits and URL-encodes the text", () => {
    const url = buildWhatsAppUrl("+62 812-3456-7890", "Hi there! #5");
    expect(url).toBe("https://wa.me/6281234567890?text=Hi%20there!%20%235");
  });
});
