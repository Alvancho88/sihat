// app/recommendation/recommendation-page.tsx
// Server component — entry point for the /recommendation route.
//
// Responsibilities:
//   1. Fetches the full SIHAT food database at request time (server-side) so the
//      client component can match AI-analysed food items against real DB records
//      for verified nutritional data and meal-plan integration.
//   2. Transforms raw DB rows into a typed FoodItem array via transformFoodRows().
//   3. Passes the food list down to RecommendationClient as `initialFoods`.
//
// Why a Server Component?
//   Database calls cannot run in the browser. Fetching here means the client
//   component receives ready-to-use data with zero client-side DB round trips.
//
// Suspense boundary:
//   RecommendationClient uses useSearchParams() which requires Suspense in
//   Next.js App Router to avoid a static-rendering error.

import { Suspense } from "react"
import { getAllFoodData } from "@/lib/queries"
import { transformFoodRows } from "@/lib/food-data-transform"
import RecommendationClient from "./recommendation-client"

export default async function RecommendationPage() {
  // Fetch all food rows from the SIHAT database (server-side only)
  const rows = await getAllFoodData()

  // Transform raw DB rows into typed FoodItem objects used for:
  //   - Matching AI-detected food names to verified DB nutrition values
  //   - Enabling "Add to Meal Plan" with accurate calorie/GI data
  const foods = transformFoodRows(rows)

  return (
    // Suspense required because RecommendationClient calls useSearchParams()
    // (used to detect ?fromChatbot navigation and restore chatbot analysis)
    <Suspense>
      <RecommendationClient initialFoods={foods} />
    </Suspense>
  )
}