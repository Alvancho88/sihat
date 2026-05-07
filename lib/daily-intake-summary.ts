import { dailyLimits, type FoodItem } from "@/lib/food-functions"

export type Gender = "male" | "female"

export type DailyIntakeSummary = {
  foodCount: number
  foodNames: string[]
  totals: {
    sugar: number
    calories: number
    fat: number
    sodium: number
    gi: number
  }
  limits: {
    sugar: number
    fat: number
    sodium: number
    cal: number
    gi: number
  }
  excess: {
    sugar: number
    fat: number
    sodium: number
    cal: number
  }
}

function parseNutrient(value: string): number {
  const parsed = parseFloat(value.replace(/[^0-9.]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10
}

export function buildDailyIntakeSummary(cart: FoodItem[], gender: Gender, lang: "en" | "ms" | "zh" = "en"): DailyIntakeSummary {
  const totals = cart.reduce(
    (acc, food) => ({
      sugar: roundOneDecimal(acc.sugar + parseNutrient(food.sugar)),
      calories: roundOneDecimal(acc.calories + parseNutrient(food.calories)),
      fat: roundOneDecimal(acc.fat + parseNutrient(food.fat)),
      sodium: roundOneDecimal(acc.sodium + parseNutrient(food.sodium)),
      gi: roundOneDecimal(acc.gi + parseNutrient(food.gi)),
    }),
    { sugar: 0, calories: 0, fat: 0, sodium: 0, gi: 0 }
  )

  const limits = {
    sugar: gender === "male" ? dailyLimits.sugar.men : dailyLimits.sugar.women,
    fat: gender === "male" ? dailyLimits.fat.men : dailyLimits.fat.women,
    sodium: gender === "male" ? dailyLimits.sodium.men : dailyLimits.sodium.women,
    cal: gender === "male" ? dailyLimits.cal.men : dailyLimits.cal.women,
    gi: dailyLimits.gi.men,
  }

  return {
    foodCount: cart.length,
    foodNames: cart.map((food) => food.name[lang] || food.name.en),
    totals,
    limits,
    excess: {
      sugar: totals.sugar > limits.sugar ? roundOneDecimal(totals.sugar - limits.sugar) : 0,
      fat: totals.fat > limits.fat ? roundOneDecimal(totals.fat - limits.fat) : 0,
      sodium: totals.sodium > limits.sodium ? Math.round(totals.sodium - limits.sodium) : 0,
      cal: totals.calories > limits.cal ? Math.round(totals.calories - limits.cal) : 0,
    },
  }
}
