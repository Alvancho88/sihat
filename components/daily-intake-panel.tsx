"use client"

import { useState } from "react"
import Image from "next/image"
import { ShoppingCart, Trash2, X, Info } from "lucide-react"
import { useCart } from "@/components/cart-context"
import { buildDailyIntakeSummary, type Gender } from "@/lib/daily-intake-summary"
import { getFoodName, getSugarLevel, getGILevel, getFatLevel, getSodiumLevel } from "@/lib/food-functions"

type LangCode = "en" | "ms" | "zh"

export interface DailyIntakePanelStrings {
  daily_intake: string
  no_items: string
  no_items_hint: string
  clear_all: string
  total: string
  daily_limit: string
  nutrition_sugar: string
  nutrition_fat: string
  nutrition_sodium: string
  nutrition_gi: string
  nutrition_cal: string
  male: string
  female: string
  exceeded_by: string
  sugar_status_ok: string
  sugar_status_over: string
  fat_status_ok: string
  fat_status_over: string
  sodium_status_ok: string
  sodium_status_over: string
  health_tip_short: string
  sugar_tip_1: string
  sugar_tip_2: string
  fat_tip_1: string
  fat_tip_2: string
  sodium_tip_1: string
  sodium_tip_2: string
}

export function DailyIntakePanel({
  t,
  isOpen,
  onClose,
  lang,
}: {
  t: DailyIntakePanelStrings
  isOpen: boolean
  onClose: () => void
  lang: LangCode
}) {
  const { cart, removeFromCart, clearCart } = useCart()

  const [gender, setGender] = useState<Gender>(() => {
    if (typeof window === "undefined") return "male"
    const saved = localStorage.getItem("manis-gender")
    return saved === "female" ? "female" : "male"
  })

  const handleGenderChange = (newGender: Gender) => {
    setGender(newGender)
    localStorage.setItem("manis-gender", newGender)
  }

  const { totals, limits, excess } = buildDailyIntakeSummary(cart, gender)

  const barColors: Record<string, string> = {
    cal: "#3b82f6",
    sugar: "#BA7517",
    fat: "#7F77DD",
    sodium: "#D4537E",
  }

  type ExceededTipKey = "sugar" | "fat" | "sodium"

  const exceededTips: Record<ExceededTipKey, [string, string]> = {
    sugar: [t.sugar_tip_1, t.sugar_tip_2],
    fat: [t.fat_tip_1, t.fat_tip_2],
    sodium: [t.sodium_tip_1, t.sodium_tip_2],
  }

  const HealthTipCard = ({
    tipKey,
    compact = false,
    mobile = false,
  }: {
    tipKey: ExceededTipKey
    compact?: boolean
    mobile?: boolean
  }) => (
    <div
      className={`w-full rounded-md border border-amber-200 bg-amber-50 text-amber-950 ${
        mobile ? "mt-0.5 px-1.5 py-1" : compact ? "mt-1 px-2 py-1.5" : "mt-1.5 px-2.5 py-2"
      }`}
    >
      <div
        className={`flex items-start gap-1 font-semibold leading-snug ${mobile ? "text-xs" : "text-[15px]"}`}
      >
        <Info
          className={`${mobile ? "w-3 h-3" : compact ? "w-3.5 h-3.5" : "w-4 h-4"} mt-0.5 shrink-0`}
        />
        <div className="min-w-0">
          <p className="font-bold">{t.health_tip_short}:</p>
          <ul
            className={`${mobile ? "mt-0 space-y-0" : compact ? "mt-0.5 space-y-0.5" : "mt-1 space-y-1"}`}
          >
            {exceededTips[tipKey].map((tip) => (
              <li key={tip} className="flex gap-1 leading-snug">
                <span aria-hidden="true">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )

  const NutritionBarCompact = ({
    label,
    value,
    limit,
    unit,
    color,
    excessAmount,
    statusOk,
    statusOver,
    tipKey,
  }: {
    label: string
    value: number
    limit: number
    unit: string
    color: string
    excessAmount: number
    statusOk: string
    statusOver: string
    tipKey?: ExceededTipKey
  }) => {
    const isOver = value > limit
    const maxDisplay = limit * 1.1
    const fillPct = Math.min((value / maxDisplay) * 100, 100)
    const limitPct = (limit / maxDisplay) * 100

    return (
      <div
        className={`mb-1 rounded-xl transition-all ${isOver ? "bg-red-50 border border-red-300 px-1.5 py-0.5 -mx-1" : ""}`}
      >
        <div className="flex justify-between items-baseline mb-0.5">
          <div className="flex items-center gap-1">
            {isOver && (
              <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-red-600 shrink-0">
                <span className="text-white font-black leading-none" style={{ fontSize: "8px" }}>
                  !
                </span>
              </span>
            )}
            <span className={`text-xs font-semibold ${isOver ? "text-red-800" : ""}`}>{label}</span>
          </div>
          <span className={`text-xs font-bold ${isOver ? "text-red-800" : "text-foreground"}`}>
            {value}
            {unit} / {limit}
            {unit}
          </span>
        </div>
        <div className="relative h-2 bg-background rounded-full overflow-visible">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${fillPct}%`, backgroundColor: isOver ? "#dc2626" : color, opacity: 1 }}
          />
          <div
            className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-red-700 rounded-full z-10"
            style={{ left: `${limitPct}%` }}
          />
        </div>
        {isOver && excessAmount > 0 && (
          <div className="mt-0.5 flex flex-col items-start gap-0">
            <span className="text-xs text-red-700 font-semibold">
              +{excessAmount}
              {unit} {t.exceeded_by}
            </span>
            <span className="text-xs text-black font-semibold leading-snug">{statusOver}</span>
            {tipKey && <HealthTipCard tipKey={tipKey} mobile />}
          </div>
        )}
        {!isOver && (
          <p className="text-xs mt-0.5 leading-snug text-muted-foreground">{statusOk}</p>
        )}
      </div>
    )
  }

  const NutritionBar = ({
    label,
    value,
    limit,
    unit,
    color,
    statusOk,
    statusOver,
    excessAmount,
    tipKey,
  }: {
    label: string
    value: number
    limit: number
    unit: string
    color: string
    statusOk: string
    statusOver: string
    excessAmount: number
    tipKey?: ExceededTipKey
  }) => {
    const isOver = value > limit
    const maxDisplay = limit * 1.1
    const fillPct = Math.min((value / maxDisplay) * 100, 100)
    const limitPct = (limit / maxDisplay) * 100

    return (
      <div
        className={`mb-1 rounded-xl transition-all ${isOver ? "bg-red-50 border border-red-300 px-2 py-1 -mx-1" : ""}`}
      >
        <div className="flex justify-between items-baseline mb-0.5">
          <div className="flex items-center gap-1.5">
            {isOver && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-600 shrink-0">
                <span className="text-white font-black leading-none" style={{ fontSize: "10px" }}>
                  !
                </span>
              </span>
            )}
            <span className={`text-[15px] font-semibold ${isOver ? "text-red-800" : ""}`}>{label}</span>
          </div>
          <span className={`text-[15px] font-bold ${isOver ? "text-red-800" : "text-foreground"}`}>
            {value}
            {unit} / {limit}
            {unit}
          </span>
        </div>
        <div className="relative h-3 bg-background rounded-full overflow-visible">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${fillPct}%`,
              backgroundColor: isOver ? "#dc2626" : color,
              opacity: isOver ? 1 : 0.85,
            }}
          />
          <div
            className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-red-700 rounded-full z-10"
            style={{ left: `${limitPct}%` }}
          />
        </div>
        {isOver && excessAmount > 0 && (
          <div className="mt-0.5 flex flex-col items-start gap-0.5">
            <span className="text-[15px] text-red-700 font-semibold">
              +{excessAmount}
              {unit} {t.exceeded_by}
            </span>
            <span className="text-[15px] text-black font-semibold leading-snug">{statusOver}</span>
            {tipKey && <HealthTipCard tipKey={tipKey} compact />}
          </div>
        )}
        {!isOver && (
          <p className="text-[15px] mt-0.5 leading-snug text-muted-foreground">{statusOk}</p>
        )}
      </div>
    )
  }

  if (!isOpen) return null

  const displayCart = [...cart].reverse()
  const useCompactDesktopPanel = lang === "zh"

  return (
    <div
      className="fixed inset-0 bg-foreground/80 z-100 flex items-start justify-center overflow-y-auto px-3 pb-4 md:px-4"
      onClick={onClose}
    >
      <div
        className={`bg-card rounded-2xl w-full ${useCompactDesktopPanel ? "max-w-3xl" : "max-w-4xl"} overflow-hidden shadow-xl flex flex-col`}
        style={{
          marginTop: useCompactDesktopPanel ? 112 : 96,
          maxHeight: useCompactDesktopPanel ? "calc(100dvh - 8rem)" : "calc(100dvh - 7rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel header */}
        <div className="bg-card border-b border-border px-3 md:px-5 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <ShoppingCart className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            <h3 className="text-lg md:text-2xl font-bold text-foreground">{t.daily_intake}</h3>
            <span className="bg-primary text-primary-foreground text-xs md:text-sm px-2 py-0.5 md:px-2.5 md:py-1 rounded-full font-semibold">
              {cart.length}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Empty state */}
        {cart.length === 0 ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-5">
            <div className="text-center py-8">
              <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-xl font-bold text-muted-foreground">{t.no_items}</p>
              <p className="text-base text-muted-foreground mt-2 leading-relaxed">{t.no_items_hint}</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── MOBILE LAYOUT ─────────────────────────────────────── */}
            <div className="md:hidden flex flex-col flex-1 overflow-hidden">
              <div className="shrink-0 bg-card px-3 py-1.5 border-b border-border">
                {/* Gender selector */}
                <div className="flex gap-2 mb-1.5">
                  <button
                    onClick={() => handleGenderChange("male")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                      gender === "male"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-foreground border-border"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="10" cy="14" r="5" />
                      <path d="M19 5l-5.4 5.4" />
                      <path d="M15 5h4v4" />
                    </svg>
                    {t.male}
                  </button>
                  <button
                    onClick={() => handleGenderChange("female")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                      gender === "female"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-foreground border-border"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="8" r="5" />
                      <path d="M12 13v8" />
                      <path d="M9 18h6" />
                    </svg>
                    {t.female}
                  </button>
                </div>

                {/* Compact nutrition bars */}
                <div className="bg-muted rounded-xl p-1 mb-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold text-foreground">
                      {t.total} vs {t.daily_limit}
                    </h4>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <div className="w-3 h-0.5 bg-red-700 rounded" />
                      <span>{t.daily_limit}</span>
                    </div>
                  </div>
                  <NutritionBarCompact
                    label={`${t.nutrition_sugar} (g)`}
                    value={totals.sugar}
                    limit={limits.sugar}
                    unit="g"
                    color={barColors.sugar}
                    excessAmount={excess.sugar}
                    statusOk={t.sugar_status_ok}
                    statusOver={t.sugar_status_over}
                    tipKey="sugar"
                  />
                  <NutritionBarCompact
                    label={`${t.nutrition_fat} (g)`}
                    value={totals.fat}
                    limit={limits.fat}
                    unit="g"
                    color={barColors.fat}
                    excessAmount={excess.fat}
                    statusOk={t.fat_status_ok}
                    statusOver={t.fat_status_over}
                    tipKey="fat"
                  />
                  <NutritionBarCompact
                    label={`${t.nutrition_sodium} (mg)`}
                    value={totals.sodium}
                    limit={limits.sodium}
                    unit="mg"
                    color={barColors.sodium}
                    excessAmount={excess.sodium}
                    statusOk={t.sodium_status_ok}
                    statusOver={t.sodium_status_over}
                    tipKey="sodium"
                  />
                </div>

                {/* Calorie total card */}
                <div className="rounded-xl px-3 py-1.5 bg-muted">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{t.nutrition_cal}</p>
                    <p className="text-lg font-bold">
                      {totals.calories}{" "}
                      <span className="text-xs font-normal text-muted-foreground">kcal</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Scrollable food list */}
              <div className="flex-1 overflow-y-auto px-3 py-2">
                <div className="space-y-2">
                  {displayCart.map((food, index) => {
                    const originalIndex = cart.length - 1 - index
                    return (
                      <div key={originalIndex} className="flex items-center gap-2 bg-muted rounded-xl p-2">
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-border">
                          <Image
                            src={food.image}
                            alt={getFoodName(food, lang)}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm line-clamp-2">{getFoodName(food, lang)}</h4>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#B5E0F1] text-[#1a5276] border border-[#1a5276]">
                              {t.nutrition_sugar} {food.sugar}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FFF3CD] text-[#856404] border border-[#856404]">
                              {t.nutrition_fat} {food.fat}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FFF3CD] text-[#856404] border border-[#856404]">
                              {t.nutrition_sodium} {food.sodium}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E6EAC7] text-[#4a5a23] border border-[#4a5a23]">
                              {t.nutrition_gi} {food.gi}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-200 text-zinc-700 border border-zinc-400">
                              {t.nutrition_cal} {food.calories}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromCart(originalIndex)}
                          className="p-3 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Clear all */}
              <div className="shrink-0 px-3 py-2 border-t border-border bg-card">
                <button
                  onClick={clearCart}
                  className="w-full flex items-center justify-center gap-2 border-2 border-destructive text-destructive font-bold text-sm py-2 rounded-xl hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {t.clear_all}
                </button>
              </div>
            </div>

            {/* ── DESKTOP LAYOUT ────────────────────────────────────── */}
            <div className="hidden md:flex flex-1 overflow-hidden">
              {/* Left column: gender + bars + calories */}
              <div
                className={`${useCompactDesktopPanel ? "w-1/2 p-2.5" : "w-[53%] p-2"} border-r border-border flex flex-col`}
              >
                <div className="flex gap-2 mb-1.5">
                  <button
                    onClick={() => handleGenderChange("male")}
                    className={`flex-1 py-1 text-base rounded-xl font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                      gender === "male"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="10" cy="14" r="5" />
                      <path d="M19 5l-5.4 5.4" />
                      <path d="M15 5h4v4" />
                    </svg>
                    {t.male}
                  </button>
                  <button
                    onClick={() => handleGenderChange("female")}
                    className={`flex-1 py-1 text-base rounded-xl font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                      gender === "female"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="8" r="5" />
                      <path d="M12 13v8" />
                      <path d="M9 18h6" />
                    </svg>
                    {t.female}
                  </button>
                </div>

                <div className="bg-muted rounded-2xl p-2 mb-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-[15px] font-bold text-foreground">
                      {t.total} vs {t.daily_limit}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[15px] text-muted-foreground">
                      <div className="w-4 h-0.5 bg-red-700 rounded" />
                      <span>{t.daily_limit}</span>
                    </div>
                  </div>
                  <NutritionBar
                    label={`${t.nutrition_sugar} (g)`}
                    value={totals.sugar}
                    limit={limits.sugar}
                    unit="g"
                    color={barColors.sugar}
                    statusOk={t.sugar_status_ok}
                    statusOver={t.sugar_status_over}
                    excessAmount={excess.sugar}
                    tipKey="sugar"
                  />
                  <NutritionBar
                    label={`${t.nutrition_fat} (g)`}
                    value={totals.fat}
                    limit={limits.fat}
                    unit="g"
                    color={barColors.fat}
                    statusOk={t.fat_status_ok}
                    statusOver={t.fat_status_over}
                    excessAmount={excess.fat}
                    tipKey="fat"
                  />
                  <NutritionBar
                    label={`${t.nutrition_sodium} (mg)`}
                    value={totals.sodium}
                    limit={limits.sodium}
                    unit="mg"
                    color={barColors.sodium}
                    statusOk={t.sodium_status_ok}
                    statusOver={t.sodium_status_over}
                    excessAmount={excess.sodium}
                    tipKey="sodium"
                  />
                </div>

                <div className="rounded-xl px-3 py-1.5 bg-muted">
                  <p className="text-[15px] text-muted-foreground mb-0.5">{t.nutrition_cal}</p>
                  <p className="text-2xl font-bold">
                    {totals.calories}{" "}
                    <span className="text-lg font-normal text-muted-foreground">kcal</span>
                  </p>
                </div>
              </div>

              {/* Right column: food list + clear */}
              <div className={`${useCompactDesktopPanel ? "w-1/2" : "w-[47%]"} flex flex-col`}>
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="space-y-2">
                    {displayCart.map((food, index) => {
                      const originalIndex = cart.length - 1 - index
                      const foodSugarLevel = getSugarLevel(food.sugar)
                      const foodGiLevel = getGILevel(food.gi)
                      const foodFatLevel = getFatLevel(food.fat)
                      const foodSodiumLevel = getSodiumLevel(food.sodium)

                      const getPillStyle = (level: "low" | "medium" | "high") => {
                        if (level === "low") return "bg-[#B5E0F1] border-[#1a5276] text-[#1a5276]"
                        if (level === "medium") return "bg-[#E6EAC7] border-[#4a5a23] text-[#4a5a23]"
                        return "bg-[#FFF3CD] border-[#856404] text-[#856404]"
                      }

                      return (
                        <div key={originalIndex} className="flex items-start gap-3 bg-muted rounded-xl p-3">
                          <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-border">
                            <Image
                              src={food.image}
                              alt={getFoodName(food, lang)}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-lg mb-2 leading-tight">
                              {getFoodName(food, lang)}
                            </h4>
                            {(() => {
                              const nutrients = [
                                {
                                  label: t.nutrition_sugar,
                                  value: food.sugar,
                                  style: getPillStyle(foodSugarLevel),
                                  width: "w-[3.25rem]",
                                },
                                {
                                  label: t.nutrition_gi,
                                  value: food.gi,
                                  style: getPillStyle(foodGiLevel),
                                  width: "w-12",
                                },
                                {
                                  label: t.nutrition_fat,
                                  value: food.fat,
                                  style: getPillStyle(foodFatLevel),
                                  width: "w-12",
                                },
                                {
                                  label: t.nutrition_sodium,
                                  value: food.sodium,
                                  style: getPillStyle(foodSodiumLevel),
                                  width: "w-20",
                                },
                                {
                                  label: t.nutrition_cal,
                                  value: food.calories,
                                  style: "bg-zinc-300 border-zinc-400 text-zinc-800",
                                  width: "w-[3.25rem]",
                                },
                              ]
                              return (
                                <div className="flex flex-wrap gap-x-1.5 gap-y-1.5">
                                  {nutrients.map(({ label, value, style, width }) => (
                                    <div
                                      key={label}
                                      className={`flex flex-col items-center gap-0.5 ${width} shrink-0`}
                                    >
                                      <span className="text-sm text-muted-foreground font-medium text-center leading-tight whitespace-nowrap">
                                        {label}
                                      </span>
                                      <span
                                        className={`text-base font-bold rounded border px-1.5 py-1 w-full flex items-center justify-center min-h-7 whitespace-nowrap ${style}`}
                                      >
                                        {value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )
                            })()}
                          </div>
                          <button
                            onClick={() => removeFromCart(originalIndex)}
                            className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="shrink-0 px-3 py-2.5 border-t border-border bg-card">
                  <button
                    onClick={clearCart}
                    className="w-full flex items-center justify-center gap-2 border-2 border-destructive text-destructive font-bold text-sm py-2.5 rounded-xl hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t.clear_all}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
