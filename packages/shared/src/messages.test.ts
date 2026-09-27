import { describe, expect, it } from "vitest";
import { buildTicketLinkMessage, buildWhatsAppUrl } from "./messages.js";

describe("buildTicketLinkMessage", () => {
  it("fills in the ticketLink template", () => {
    const text = buildTicketLinkMessage({
      firstName: "Amara",
      number: 5,
      boothName: "Sunset Fair",
      url: "https://boothq.example.com/t/abc123",
    });
    expect(text).toBe(
      "Hi Amara! You're #5 at Sunset Fair. Track your place in line here: https://boothq.example.com/t/abc123",
    );
  });
});

describe("buildWhatsAppUrl", () => {
  it("strips non-digits and URL-encodes the text", () => {
    const url = buildWhatsAppUrl("+62 812-3456-7890", "Hi there! #5");
    expect(url).toBe("https://wa.me/6281234567890?text=Hi%20there!%20%235");
  });
});
