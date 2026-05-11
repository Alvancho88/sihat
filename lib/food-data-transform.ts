import type { FoodItem } from "@/lib/food-functions"
import type { FoodDataRow } from "@/lib/queries"

export function transformFoodRows(rows: FoodDataRow[]): FoodItem[] {
  const byId = new Map<number, FoodItem>()

  for (const row of rows) {
    if (row.food_id === null) continue

    if (!byId.has(row.food_id)) {
      const sugarVal = row.sugar ?? 0
      const fatVal = row.fat ?? 0
      const sodiumVal = row.sodium ?? 0
      const giVal = row.gi_value ?? 0

      let risk: "low" | "medium" | "high" = "low"
      if (sugarVal > 15 || fatVal > 15 || sodiumVal > 600 || giVal >= 70) {
        risk = "high"
      } else if (sugarVal > 5 || fatVal > 5 || sodiumVal > 300 || giVal > 55) {
        risk = "medium"
      }

      byId.set(row.food_id, {
        name: { en: "", ms: "", zh: "" },
        category: row.food_type ?? "",
        image: row.image_url ?? "",
        portion: row.serving_size ?? "",
        calories: String(row.calories ?? 0),
        sugar: `${row.sugar ?? 0}g`,
        gi: String(row.gi_value ?? 0),
        fat: `${row.fat ?? 0}g`,
        sodium: `${row.sodium ?? 0}mg`,
        risk,
        tip: { en: "", ms: "", zh: "" },
      })
    }

    const item = byId.get(row.food_id)!
    const lang = row.language as "en" | "ms" | "zh" | null
    if (lang === "en" || lang === "ms" || lang === "zh") {
      item.tip[lang] = row.health_tip ?? ""
      item.name[lang] = row.food_name ?? ""
    }
  }

  return Array.from(byId.values())
}
