/**
 * page.tsx
 *
 * Server component for the Food Search page.
 * Fetches all food data from the database, transforms it into
 * the FoodItem[] format, and passes it to the client component.
 */
import { getAllFoodData } from "@/lib/queries"
import FoodClient from "./food-client"
import { transformFoodRows } from "@/lib/food-data-transform"

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
