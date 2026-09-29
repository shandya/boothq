import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl, messages } from "./messages.js";

describe("buildWhatsAppUrl", () => {
  it("strips non-digits and URL-encodes the text", () => {
    const url = buildWhatsAppUrl("+62 812-3456-7890", "Hi there! #5");
    expect(url).toBe("https://wa.me/6281234567890?text=Hi%20there!%20%235");
  });
});

describe("messages.readyForPickup", () => {
  it("fills in the customer, number and booth name", () => {
    expect(messages.readyForPickup({ firstName: "Ana", number: 7, booth: "Ink Booth" })).toBe(
      "Hi Ana! Your portrait (#7) from Ink Booth is ready. Pick it up at the booth any time before we close.",
    );
  });

  it("has an Indonesian version", () => {
    expect(messages.readyForPickup({ firstName: "Ana", number: 7, booth: "Ink Booth" }, "id")).toBe(
      "Halo Ana! Potretmu (#7) dari Ink Booth sudah siap. Ambil di booth kapan saja sebelum kami tutup.",
    );
  });
});
