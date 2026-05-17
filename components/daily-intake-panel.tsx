/**
 * daily-intake-panel.tsx
 *
 * A full-screen overlay panel that shows the user's current daily food plan
 * (cart) along with a comparison of their cumulative nutrient intake vs.
 * recommended daily limits.
 *
 * This component is a standalone, reusable version extracted from food-client.tsx
 * so it can be embedded in other pages (e.g., the food search page) without
 * duplicating the layout code.
 *
 * Key features:
 *   - Gender selector (Male / Female) that adjusts daily limits via
 *     buildDailyIntakeSummary (e.g., sugar: women <25g, men <36g).
 *     The preference is persisted to localStorage so it survives page refreshes.
 *   - Horizontal progress bars for Sugar, Fat, and Sodium vs. daily limits.
 *     Each bar has a red vertical limit-marker line; the bar turns red and
 *     shows the excess amount if the limit is exceeded.
 *   - Calorie total card (displayed without a strict limit).
 *   - Scrollable food list with remove buttons.  List is reversed so the most
 *     recently added food appears at the top.
 *   - "Clear All" button that empties the entire daily plan.
 *   - Responsive: compact single-column layout on mobile, two-column on desktop.
 *   - Chinese language gets a slightly narrower max-width to compensate for
 *     shorter character widths (useCompactDesktopPanel).
 *
 * The component reads and mutates cart state via the useCart() hook which is
 * backed by CartContext / CartProvider in components/cart-context.tsx.
 */

"use client"

import { useState } from "react"
import Image from "next/image"
import { ShoppingCart, Trash2, X, Info } from "lucide-react"
import { useCart } from "@/components/cart-context"
import { buildDailyIntakeSummary, type Gender } from "@/lib/daily-intake-summary"
import { getFoodName, getSugarLevel, getGILevel, getFatLevel, getSodiumLevel } from "@/lib/food-functions"

/**
 * LangCode
 *
 * The three language codes supported by the SIHAT application.
 * Used to look up localized food names via getFoodName(food, lang).
 */
type LangCode = "en" | "ms" | "zh"

/**
 * DailyIntakePanelStrings
 *
 * All UI text strings required by the DailyIntakePanel component, grouped
 * as a single interface so the caller can pass its own localized translations
 * object.  This keeps the component language-agnostic — it doesn't import
 * any hardcoded text and instead relies entirely on whatever the parent passes.
 *
 * Design rationale: using an interface rather than accepting a `lang` prop
 * and building strings internally means the panel can be embedded in any page
 * that already has a translations object, without coupling to a specific
 * page's translation format.
 */
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

/**
 * DailyIntakePanel
 *
 * Full-screen overlay panel for reviewing and managing the daily food plan.
 * Renders nothing when `isOpen` is false (early return before JSX).
 *
 * @param t       - Localized UI string object implementing DailyIntakePanelStrings.
 * @param isOpen  - Controls panel visibility.  When false the panel is not mounted.
 * @param onClose - Callback invoked when the user clicks outside the panel card
 *                  or taps the close button in the header.
 * @param lang    - Active language code; used to resolve multilingual food names.
 */
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

  // Gender preference is persisted in localStorage under "manis-gender".
  // The lazy initializer reads from localStorage immediately so the correct
  // daily limits are applied on the very first render without a flicker.
  // During SSR (window === "undefined") we default to "male" as a safe fallback.
  const [gender, setGender] = useState<Gender>(() => {
    if (typeof window === "undefined") return "male"
    const saved = localStorage.getItem("manis-gender")
    return saved === "female" ? "female" : "male"
  })

  /**
   * handleGenderChange
   *
   * Updates the selected gender in both component state and localStorage.
   * Persisting to localStorage means the choice is shared with the food page
   * and the chatbot's daily intake summary, which all read the same key.
   *
   * @param newGender - "male" or "female"
   */
  const handleGenderChange = (newGender: Gender) => {
    setGender(newGender)
    localStorage.setItem("manis-gender", newGender)
  }

  // Compute daily intake totals, per-nutrient limits, and excess amounts.
  // `totals` is the sum of each nutrient across all items in the cart.
  // `limits` is the gender-specific recommended daily intake for each nutrient.
  // `excess` is max(0, total - limit) for each nutrient (0 when within limit).
  const { totals, limits, excess } = buildDailyIntakeSummary(cart, gender)

  // Colour palette for each nutrient's progress bar.
  // Colours are chosen to be visually distinct and accessible:
  //   cal    → blue-500  (neutral; calories have no enforced limit in this UI)
  //   sugar  → golden brown (warm; aligns with the amber "caution" palette)
  //   fat    → purple    (distinct from sugar and sodium)
  //   sodium → rose pink (distinct from sugar and fat)
  const barColors: Record<string, string> = {
    cal: "#3b82f6",
    sugar: "#BA7517",
    fat: "#7F77DD",
    sodium: "#D4537E",
  }

  // Union type for the three nutrients that show health tips when exceeded.
  // Calories are excluded because the panel does not enforce a calorie limit.
  type ExceededTipKey = "sugar" | "fat" | "sodium"

  // Maps each tracked nutrient to a pair of actionable health tips sourced
  // from the localized translation strings passed in via `t`.
  const exceededTips: Record<ExceededTipKey, [string, string]> = {
    sugar: [t.sugar_tip_1, t.sugar_tip_2],
    fat: [t.fat_tip_1, t.fat_tip_2],
    sodium: [t.sodium_tip_1, t.sodium_tip_2],
  }

  /**
   * HealthTipCard
   *
   * An amber-tinted card showing two actionable health tips for a nutrient
   * that has exceeded its daily limit.  Appears directly below the progress bar
   * inside the NutritionBarCompact / NutritionBar components.
   *
   * Three size variants are controlled by boolean flags:
   *   - `mobile`  — extra-compact text/padding for the narrow mobile column.
   *   - `compact` — slightly smaller than default for the desktop left column.
   *   - default   — full size, used in the desktop left-column NutritionBar.
   *
   * @param tipKey  - Which nutrient's tips to display.
   * @param compact - Render in compact (desktop left-column) size.
   * @param mobile  - Render in minimal (mobile) size.
   */
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

  /**
   * NutritionBarCompact
   *
   * A compact horizontal progress bar for a single nutrient, designed for the
   * narrow mobile layout.  Uses smaller text and tighter padding compared to
   * NutritionBar.
   *
   * Bar math:
   *   - maxDisplay is capped at 110 % of the limit so that values right at the
   *     limit leave a small visual gap before the bar hits the wall, making it
   *     obvious that 100 % is the danger zone.
   *   - fillPct: how wide the coloured fill bar should be (capped at 100 %).
   *   - limitPct: horizontal position of the red vertical limit-marker line.
   *     The marker always appears at the 100 % limit position regardless of
   *     the actual value so users know where the safe boundary is.
   *
   * @param label        - Nutrient label string (e.g. "Sugar (g)").
   * @param value        - Current total intake for this nutrient.
   * @param limit        - Recommended daily limit for this nutrient (gender-adjusted).
   * @param unit         - Unit string appended to numbers (e.g. "g", "mg").
   * @param color        - Hex colour for the progress bar fill when within limit.
   * @param excessAmount - How much the value exceeds the limit (0 if within).
   * @param statusOk     - Text shown below the bar when within limit.
   * @param statusOver   - Text shown below the bar when over limit.
   * @param tipKey       - Which nutrient's health tips to render; omit to hide tips.
   */
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
    // Determine whether the current value has exceeded the daily limit.
    const isOver = value > limit
    // Scale the bar so 100 % visual width corresponds to 110 % of the limit.
    // This ensures that the limit-marker line is not at the very right edge,
    // giving the user a clear visual indication that there is still "room".
    const maxDisplay = limit * 1.1
    // Percentage width of the coloured fill bar (clamped to 100 %).
    const fillPct = Math.min((value / maxDisplay) * 100, 100)
    // Horizontal position (%) of the vertical red limit-marker line.
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

  /**
   * NutritionBar
   *
   * The full-size version of the horizontal nutrient progress bar, used in the
   * desktop layout's left column.  Functionally identical to NutritionBarCompact
   * but with larger text, a taller bar track (h-3 vs h-2), and bigger icon/padding.
   *
   * Bar math is the same as NutritionBarCompact (see that component for details).
   * The opacity of the fill is 0.85 when within the limit for a softer look,
   * and 1.0 (fully opaque red) when over the limit to draw attention.
   *
   * @param label        - Nutrient label string (e.g. "Sugar (g)").
   * @param value        - Current total intake for this nutrient.
   * @param limit        - Recommended daily limit (gender-adjusted).
   * @param unit         - Unit string appended to numbers.
   * @param color        - Hex colour for the fill bar when within limit.
   * @param statusOk     - Text shown below the bar when within limit.
   * @param statusOver   - Text shown below the bar when over limit.
   * @param excessAmount - How much the value exceeds the limit (0 if within).
   * @param tipKey       - Which nutrient's health tips to render; omit to hide tips.
   */
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
    // Same bar-scale math as NutritionBarCompact.
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

  // Do not render anything while the panel is closed.
  // We return null instead of using CSS `display:none` so that the DOM is
  // completely unmounted — this avoids scroll-position side effects and
  // slightly reduces memory use when the panel is not visible.
  if (!isOpen) return null

  // Reverse the cart so the most recently added food appears at the top of the
  // list.  We create a new array with spread+reverse to avoid mutating state.
  const displayCart = [...cart].reverse()

  // Chinese text is shorter per character, so the panel can be slightly narrower
  // on desktop without feeling cramped.  This prevents awkward whitespace on zh.
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
                    // displayCart is the reversed cart, so index 0 here corresponds
                    // to the last element of the original cart array.
                    // We compute originalIndex so that removeFromCart receives
                    // the correct position in the un-reversed cart state array.
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
                      // Same index mapping as the mobile list above.
                      const originalIndex = cart.length - 1 - index
                      // Pre-compute risk levels for each nutrient so we can
                      // colour the pill badges (low=blue, medium=green, high=yellow).
                      const foodSugarLevel = getSugarLevel(food.sugar)
                      const foodGiLevel = getGILevel(food.gi)
                      const foodFatLevel = getFatLevel(food.fat)
                      const foodSodiumLevel = getSodiumLevel(food.sodium)

                      /**
                       * getPillStyle
                       * Returns a Tailwind class string for the coloured badge border
                       * and background based on the risk level of the nutrient value.
                       * low    → light blue  (safe range)
                       * medium → sage green  (moderate caution)
                       * high   → amber/yellow (high caution — mirrors the "Three Highs" theme)
                       */
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
