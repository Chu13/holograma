import { formatCount } from "@/lib/format";

/**
 * Recommended triangle ceiling for smooth 60fps orbit on a mid-range mobile
 * phone. Applies to models dropped by the user — the gallery's own models
 * (CHIARA) are hand-vetted separately.
 */
export const TRIANGLE_BUDGET = 150_000;

export type BudgetSeverity = "ok" | "warn" | "high";

export type BudgetResult = {
  triangles: number;
  withinBudget: boolean;
  severity: BudgetSeverity;
  message: string;
};

/**
 * Evaluate a model's triangle count against the mobile performance budget.
 * Never silently claims a model is fine when it isn't — an over-budget
 * model gets an honest warning in the UI, not a hidden risk.
 */
export function checkTriangleBudget(triangles: number): BudgetResult {
  const withinBudget = triangles <= TRIANGLE_BUDGET;
  const severity: BudgetSeverity = withinBudget
    ? "ok"
    : triangles > TRIANGLE_BUDGET * 2
      ? "high"
      : "warn";

  const message = withinBudget
    ? `${formatCount(triangles)} triangles — within the ${formatCount(TRIANGLE_BUDGET)} mobile budget.`
    : `${formatCount(triangles)} triangles exceeds the ${formatCount(TRIANGLE_BUDGET)} recommended mobile budget — this model may not hold 60fps on a mid-range phone.`;

  return { triangles, withinBudget, severity, message };
}
