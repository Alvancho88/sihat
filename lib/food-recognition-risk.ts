/**
 * Three Highs risk from sugar (g), sodium (mg), and fat (g).
 * Same thresholds as the AI Food Recognition / recommendation page.
 */

export function getLevelFromThresholds(
  value: number,
  lowMax: number,
  mediumMax: number
): "low" | "medium" | "high" {
  if (value <= lowMax) return "low";
  if (value <= mediumMax) return "medium";
  return "high";
}

export function computeRiskFromIndicators(
  sugar: number,
  salt: number,
  fat: number,
  apiRisk: string
): "low" | "medium" | "high" {
  if (!Number.isNaN(sugar) && !Number.isNaN(salt) && !Number.isNaN(fat)) {
    const sugarLevel = getLevelFromThresholds(sugar, 5, 15);
    const saltLevel = getLevelFromThresholds(salt, 200, 600);
    const fatLevel = getLevelFromThresholds(fat, 5, 15);
    if (sugarLevel === "high" || saltLevel === "high" || fatLevel === "high") return "high";
    if (sugarLevel === "medium" || saltLevel === "medium" || fatLevel === "medium") return "medium";
    return "low";
  }
  const r = (apiRisk ?? "medium").toLowerCase().replace(/\s+risk$/, "").trim();
  if (r === "low") return "low";
  if (r === "high") return "high";
  return "medium";
}

/** Parse values like "12g", "380 mg", "1.5". */
export function parseNutrientNumber(value: string): number {
  const n = parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : Number.NaN;
}
