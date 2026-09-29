import { describe, expect, it } from "vitest";
import { neutralizeFormula, toCsv, toCsvRow } from "./csv.js";

describe("toCsvRow", () => {
  it("joins plain cells and leaves null/undefined empty", () => {
    expect(toCsvRow(["a", 1, null, undefined, "b"])).toBe("a,1,,,b");
  });

  it("quotes cells with commas, quotes or line breaks, doubling inner quotes", () => {
    expect(toCsvRow(["Doe, Jane"])).toBe('"Doe, Jane"');
    expect(toCsvRow(['say "hi"'])).toBe('"say ""hi"""');
    expect(toCsvRow(["line1\nline2"])).toBe('"line1\nline2"');
    expect(toCsvRow(["a\r\nb"])).toBe('"a\r\nb"');
  });

  it("keeps accents and emoji as they are", () => {
    expect(toCsvRow(["Sinta Ñandú 🎨"])).toBe("Sinta Ñandú 🎨");
  });
});

describe("neutralizeFormula (CSV injection)", () => {
  it.each(["=1+1", "+cmd|' /C calc'!A0", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"])("prefixes %j", (value) => {
    expect(neutralizeFormula(value)).toBe(`'${value}`);
  });

  it("leaves ordinary text and a real E.164 phone number alone", () => {
    expect(neutralizeFormula("Budi")).toBe("Budi");
    expect(neutralizeFormula("cat = cute")).toBe("cat = cute");
    expect(neutralizeFormula("+6281234567890")).toBe("+6281234567890");
  });

  it("still neutralizes a '+' cell that isn't a phone number", () => {
    expect(neutralizeFormula("+62 81 & cmd")).toBe("'+62 81 & cmd");
    expect(neutralizeFormula("+1")).toBe("'+1");
  });

  it("applies inside a row, and quoting still works after the prefix", () => {
    expect(toCsvRow(['=A1,"x"'])).toBe(`"'=A1,""x"""`);
  });
});

describe("toCsv", () => {
  it("starts with a BOM, uses CRLF, and ends with a newline", () => {
    const out = toCsv(["A", "B"], [["1", "2"]]);
    expect(out).toBe("﻿A,B\r\n1,2\r\n");
  });
});
