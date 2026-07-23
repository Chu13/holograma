import { describe, expect, test } from "vitest";
import { formatBytes, formatCount } from "@/lib/format";

describe("formatBytes", () => {
  test("formats zero bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  test("formats bytes under 1 KB with no decimals", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  test("formats kilobytes with one decimal", () => {
    expect(formatBytes(674_608)).toBe("658.8 KB");
  });

  test("formats megabytes with one decimal", () => {
    expect(formatBytes(2_500_000)).toBe("2.4 MB");
  });

  test("rejects negative sizes", () => {
    expect(() => formatBytes(-1)).toThrow();
  });
});

describe("formatCount", () => {
  test("formats small counts as-is", () => {
    expect(formatCount(42)).toBe("42");
  });

  test("adds thousands separators", () => {
    expect(formatCount(132_316)).toBe("132,316");
  });

  test("formats zero", () => {
    expect(formatCount(0)).toBe("0");
  });
});
