import { describe, expect, test } from "vitest";
import { checkTriangleBudget, TRIANGLE_BUDGET } from "@/lib/budget";

describe("checkTriangleBudget", () => {
  test("is within budget for a well-optimized model", () => {
    const result = checkTriangleBudget(50_000);
    expect(result.withinBudget).toBe(true);
    expect(result.severity).toBe("ok");
  });

  test("is exactly at the recommended limit", () => {
    const result = checkTriangleBudget(TRIANGLE_BUDGET);
    expect(result.withinBudget).toBe(true);
  });

  test("warns when a model exceeds the recommended mobile budget", () => {
    const result = checkTriangleBudget(TRIANGLE_BUDGET + 1);
    expect(result.withinBudget).toBe(false);
    expect(result.severity).toBe("warn");
    expect(result.message).toMatch(/150,000/);
  });

  test("escalates to a stronger warning far past budget", () => {
    // CHIARA itself is ~132K triangles; a dropped model at 2x budget or
    // more should read as a harder warning, not the same soft nudge.
    const result = checkTriangleBudget(TRIANGLE_BUDGET * 2 + 1);
    expect(result.severity).toBe("high");
  });

  test("message reports the actual triangle count", () => {
    const result = checkTriangleBudget(200_000);
    expect(result.message).toMatch(/200,000/);
  });
});
