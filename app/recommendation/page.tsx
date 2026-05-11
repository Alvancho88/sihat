import { Suspense } from "react"
import { getAllFoodData } from "@/lib/queries"
import { transformFoodRows } from "@/lib/food-data-transform"
import RecommendationClient from "./recommendation-client"

export default async function RecommendationPage() {
  const rows = await getAllFoodData()
  const foods = transformFoodRows(rows)

  return (
    <Suspense>
      <RecommendationClient initialFoods={foods} />
    </Suspense>
  )
}
