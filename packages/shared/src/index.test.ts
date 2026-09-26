import { describe, expect, it } from "vitest";
import { SHARED_PACKAGE_NAME } from "./index.js";

describe("shared package", () => {
  it("exports a package name", () => {
    expect(SHARED_PACKAGE_NAME).toBe("@boothq/shared");
  });
});
