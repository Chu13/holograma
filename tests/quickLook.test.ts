import { describe, expect, test } from "vitest";
import { buildQuickLookLink } from "@/ar/quickLook";

describe("buildQuickLookLink", () => {
  test("rejects a usdzUrl that isn't a .usdz file", () => {
    expect(() =>
      buildQuickLookLink({ usdzUrl: "https://holograma.app/models/chiara.glb" }),
    ).toThrow(/usdz/i);
  });

  test("returns rel=ar and the bare usdz href with no options", () => {
    const link = buildQuickLookLink({
      usdzUrl: "https://holograma.app/models/chiara.usdz",
    });
    expect(link.rel).toBe("ar");
    expect(link.href).toBe("https://holograma.app/models/chiara.usdz");
  });

  test("appends canonicalWebPageURL as a URL fragment when provided", () => {
    const link = buildQuickLookLink({
      usdzUrl: "https://holograma.app/models/chiara.usdz",
      canonicalWebPageURL: "https://holograma.app/model/chiara",
    });
    expect(link.href).toBe(
      "https://holograma.app/models/chiara.usdz#canonicalWebPageURL=https%3A%2F%2Fholograma.app%2Fmodel%2Fchiara",
    );
  });

  test("combines multiple fragment options with &", () => {
    const link = buildQuickLookLink({
      usdzUrl: "https://holograma.app/models/chiara.usdz",
      canonicalWebPageURL: "https://holograma.app/model/chiara",
      allowsContentScaling: false,
    });
    expect(link.href).toBe(
      "https://holograma.app/models/chiara.usdz#canonicalWebPageURL=https%3A%2F%2Fholograma.app%2Fmodel%2Fchiara&allowsContentScaling=0",
    );
  });
});
