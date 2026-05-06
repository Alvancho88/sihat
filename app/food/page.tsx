/**
 * page.tsx
 *
 * Server component for the Food Search page.
 * Fetches all food data from the database, transforms it into
 * the FoodItem[] format, and passes it to the client component.
 */
import { getAllFoodData, type FoodDataRow } from "@/lib/queries"
import FoodClient from "./food-client"
import { FoodItem } from "@/lib/food-functions"

/**
 * Transforms the flat DB rows (one row per food × language) into the FoodItem[]
 * shape that FoodClient expects.
 *
 * DB numeric fields  →  string fields used by the existing UI helpers
 *   calories  (integer)        →  "644"
 *   sugar     (doublePrecision) →  "8g"
 *   gi_value  (integer)        →  "64"
 *   fat       (doublePrecision) →  "25g"
 *   sodium    (integer)        →  "850mg"
 */

function transformFoodRows(rows: FoodDataRow[]): FoodItem[] {
  // Group rows by food_id
  const byId = new Map<number, FoodItem>()

  for (const row of rows) {
    if (row.food_id === null) continue

    if (!byId.has(row.food_id)) {
      // Determine risk level from nutritional values (matches food-data.ts thresholds)
      const sugarVal  = row.sugar   ?? 0
      const fatVal    = row.fat     ?? 0
      const sodiumVal = row.sodium  ?? 0
      const giVal     = row.gi_value ?? 0

      let risk: "low" | "medium" | "high" = "low"
      if (sugarVal > 15 || fatVal > 15 || sodiumVal > 600 || giVal >= 70) {
        risk = "high"
      } else if (sugarVal > 5 || fatVal > 5 || sodiumVal > 300 || giVal > 55) {
        risk = "medium"
      }

      byId.set(row.food_id, {
        name:     { en: "", ms: "", zh: "" }, // filled below from "en" translation
        category: row.food_type     ?? "",
        image:    row.image_url     ?? "",
        portion:  row.serving_size  ?? "",
        calories: String(row.calories  ?? 0),
        sugar:    `${row.sugar    ?? 0}g`,
        gi:       String(row.gi_value ?? 0),
        fat:      `${row.fat      ?? 0}g`,
        sodium:   `${row.sodium   ?? 0}mg`,
        risk,
        tip: { en: "", ms: "", zh: "" },
      })
    }

    const item = byId.get(row.food_id)!

    // Fill translation fields
    const lang = row.language as "en" | "ms" | "zh" | null
    if (lang === "en" || lang === "ms" || lang === "zh") {
      item.tip[lang] = row.health_tip ?? ""
      item.name[lang] = row.food_name ?? ""
    }
  }

  return Array.from(byId.values())
}

/**
 * FoodPage
 *
 * Next.js server page component. Fetches food rows from the database
 * and renders the FoodClient with the transformed data.
 */
export default async function FoodPage() {
  const rows  = await getAllFoodData()
  const foods = transformFoodRows(rows)

  return <FoodClient initialFoods={foods} />
}
