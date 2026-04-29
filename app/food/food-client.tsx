"use client"

import { PageLayout } from "@/components/page-layout"
import { useState, useEffect, createContext, useContext, useRef, useMemo } from "react"

import Image from "next/image"
import { Search, X, TrendingDown, TrendingUp, Minus, Info, User, ShoppingCart, Trash2, Plus, Check, Filter, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react"
import { categories, getSugarLevel, getGILevel, getFatLevel, getSodiumLevel, dailyLimits, type FoodItem } from "@/lib/food-functions"

type LangCode = "en" | "ms" | "zh"

const pageContent = {
  en: {
    title: "Search Food",
    subtitle: "Browse foods and plan your daily intake with nutrition tracking.",
    search_placeholder: "Search Food here...",
    no_results: "No foods found. Try a different search.",
    nutrition_guide: "Nutrition Guide & Colour Legend",
    nutrition_guide_description: "Tap to see colour guides for sugar, fat, sodium & GI",
    click_hint: "Tap any food to see details or add to your daily plan",
    nutrition_sugar: "Sugar",
    nutrition_cal: "Cal",
    nutrition_gi: "GI",
    nutrition_fat: "Fat",
    nutrition_sodium: "Sodium",
    portion: "Serving",
    portion_plate: "plate",
    portion_bowl: "bowl",
    portion_piece: "piece",
    portion_pieces: "pieces",
    portion_mixed: "mixed",
    portion_serving: "serving",
    portion_cup: "cup",
    portion_sticks: "sticks",
    portion_with_sauce: "with sauce",
    portion_glass: "glass",
    portion_scoop: "scoop",
    portion_scoops: "scoops",
    portion_medium: "medium",
    portion_slice: "slice",
    portion_slices: "slices",
    tip_label: "Health Tip",
    close: "Close",
    daily_sugar_women: "Women < 25g",
    daily_sugar_men: "Men < 36g",
    daily_sugar_title: "Daily Sugar Limit:",
    gi_legend_title: "GI Guide",
    gi_description: "GI measures how fast food raises blood sugar.",
    risk_low: "Low",
    risk_medium: "Medium",
    risk_high: "High",
    gi_short_explanation: "GI shows how quickly food raises your blood sugar level.",
    gi_popup_title: "What is Glycemic Index (GI)?",
    gi_popup_description: "The Glycemic Index (GI) is a rating system that measures how quickly foods containing carbohydrates affect your blood sugar levels. Foods are ranked on a scale of 0 to 100, with pure glucose being 100. Understanding GI is especially important for people with diabetes or those managing their blood sugar levels.",
    gi_popup_why_important: "Why is GI Important?",
    gi_popup_importance: "Choosing low GI foods can help: maintain steady blood sugar levels, reduce risk of diabetes complications, control appetite and manage weight, and provide sustained energy throughout the day.",
    gi_low: "Low GI (0-55)",
    gi_low_value: "",
    gi_medium: "Medium GI",
    gi_medium_value: "(56-69)",
    gi_high: "High GI (70+)",
    gi_high_value: "",
    gi_best_choice: "Best choice",
    gi_moderate: "Moderate",
    gi_limit_intake: "Limit intake",
    sugar_guide_title: "Sugar Guide",
    fat_guide_title: "Fat Guide",
    sodium_guide_title: "Sodium Guide",
    sodium_short_explanation: "High sodium can raise blood pressure.",
    sodium_popup_title: "What is Sodium?",
    sodium_popup_description: "Sodium is a mineral found in salt and many processed foods. While our body needs some sodium, too much can lead to high blood pressure and increase the risk of heart disease and stroke.",
    sodium_popup_why_important: "Why Limit Sodium?",
    sodium_popup_importance: "Reducing sodium intake can help: lower blood pressure, reduce risk of heart disease, prevent kidney damage, and decrease water retention and bloating.",
    sodium_low: "Low (≤300mg)",
    sodium_low_value: "",
    sodium_medium: "Medium",
    sodium_medium_value: "(301-600mg)",
    sodium_high: "High (≥601mg)",
    sodium_high_value: "",
    daily_intake: "Daily Intake",
    add_to_cart: "Add to Cart",
    added: "Added to Cart",
    pagination_previous: "Previous",
    pagination_next: "Next",
    pagination_showing: "Showing",
    pagination_of: "of",
    pagination_results: "results",
    exceeded_by: "Exceeded by",
    remove: "Remove",
    clear_all: "Clear All",
    total: "Total",
    daily_limit: "Daily Limit",
    no_items: "No items in your daily plan",
    no_items_hint: "Tap '+' on any food to start planning",
    view_cart: "View Plan",
    items: "items",
    three_highs_tip: "Three Highs Health Tip",
    clear_filters: "Clear Filters",
    sort_by: "Sort By",
    ascending: "Ascending",
    descending: "Descending",
    confirm: "Confirm",
    male: "Male",
    female: "Female",
    over_limit: "exceeds daily limit",
    cal_status_ok: "Calorie intake is within limit.",
    cal_status_over: "Calorie intake exceeds daily limit.",
    sugar_status_ok: "Sugar intake is within limit.",
    sugar_status_over: "Sugar intake exceeds daily limit.",
    fat_status_ok: "Fat intake is within limit.",
    fat_status_over: "Fat intake exceeds daily limit.",
    sodium_status_ok: "Sodium intake is within limit.",
    sodium_status_over: "Sodium intake exceeds daily limit.",
    gi_status_low: "Average GI is low — blood sugar friendly.",
    gi_status_high: "Average GI is high — may spike blood sugar.",
    show_more: "Show more",
    show_less: "Show less",
    back_to_search: "Back to Search",
  },
  ms: {
    title: "Cari Makanan",
    subtitle: "Semak makanan dan rancang pengambilan harian dengan penjejakan nutrisi.",
    search_placeholder: "Cari makanan di sini...",
    no_results: "Tiada makanan dijumpai. Cuba carian lain.",
    nutrition_guide: "Panduan Nutrisi & Legenda Warna",
    nutrition_guide_description: "Ketik untuk melihat panduan warna untuk gula, lemak, natrium & GI",
    click_hint: "Ketik makanan untuk butiran atau tambah ke pelan harian",
    nutrition_sugar: "Gula",
    nutrition_cal: "Kal",
    nutrition_gi: "GI",
    nutrition_fat: "Lemak",
    nutrition_sodium: "Natrium",
    portion: "Sajian",
    portion_plate: "pinggan",
    portion_bowl: "mangkuk",
    portion_piece: "keping",
    portion_pieces: "keping",
    portion_mixed: "campuran",
    portion_serving: "hidangan",
    portion_cup: "cawan",
    portion_sticks: "cucuk",
    portion_with_sauce: "dengan sos",
    portion_glass: "gelas",
    portion_scoop: "sudu",
    portion_scoops: "sudu",
    portion_medium: "sederhana",
    portion_slice: "keping",
    portion_slices: "keping",
    tip_label: "Tip Kesihatan",
    close: "Tutup",
    daily_sugar_women: "Wanita < 25g",
    daily_sugar_men: "Lelaki < 36g",
    daily_sugar_title: "Had Gula Harian:",
    gi_legend_title: "Panduan GI",
    gi_description: "GI mengukur seberapa cepat makanan meningkatkan gula darah.",
    risk_low: "Rendah",
    risk_medium: "Sederhana",
    risk_high: "Tinggi",
    gi_short_explanation: "GI menunjukkan seberapa cepat makanan menaikkan gula darah anda.",
    gi_popup_title: "Apakah Indeks Glisemik (GI)?",
    gi_popup_description: "Indeks Glisemik (GI) adalah sistem penilaian yang mengukur seberapa cepat makanan yang mengandungi karbohidrat mempengaruhi paras gula darah anda. Makanan dinilai pada skala 0 hingga 100, dengan glukosa tulen adalah 100.",
    gi_popup_why_important: "Mengapa GI Penting?",
    gi_popup_importance: "Memilih makanan GI rendah boleh membantu: mengekalkan paras gula darah yang stabil, mengurangkan risiko komplikasi diabetes, mengawal selera dan berat badan, serta memberikan tenaga yang berterusan.",
    gi_low: "GI Rendah (0-55)",
    gi_low_value: "",
    gi_medium: "GI Sederhana (56-69)",
    gi_medium_value: "",
    gi_high: "GI Tinggi (70+)",
    gi_high_value: "",
    gi_best_choice: "Pilihan terbaik",
    gi_moderate: "Sederhana",
    gi_limit_intake: "Hadkan pengambilan",
    sugar_guide_title: "Panduan Gula",
    fat_guide_title: "Panduan Lemak",
    sodium_guide_title: "Panduan Natrium",
    sodium_short_explanation: "Natrium tinggi boleh meningkatkan tekanan darah.",
    sodium_popup_title: "Apakah Natrium?",
    sodium_popup_description: "Natrium adalah mineral yang terdapat dalam garam dan banyak makanan diproses. Walaupun badan kita memerlukan sedikit natrium, terlalu banyak boleh menyebabkan tekanan darah tinggi.",
    sodium_popup_why_important: "Mengapa Hadkan Natrium?",
    sodium_popup_importance: "Mengurangkan pengambilan natrium boleh membantu: menurunkan tekanan darah, mengurangkan risiko penyakit jantung, mencegah kerosakan buah pinggang, dan mengurangkan pengekalan air.",
    sodium_low: "Rendah",
    sodium_low_value: "(≤300mg)",
    sodium_medium: "Sederhana (301-600mg)",
    sodium_medium_value: "",
    sodium_high: "Tinggi",
    sodium_high_value: "(≥601mg)",
    daily_intake: "Pengambilan Harian",
    add_to_cart: "Tambah ke Troli",
    added: "Ditambah ke Troli",
    pagination_previous: "Sebelum",
    pagination_next: "Seterus",
    pagination_showing: "Menunjukkan",
    pagination_of: "daripada",
    pagination_results: "keputusan",
    exceeded_by: "Melebihi",
    remove: "Buang",
    clear_all: "Kosongkan",
    total: "Jumlah",
    daily_limit: "Had Harian",
    no_items: "Tiada item dalam pelan harian",
    no_items_hint: "Ketik '+' pada makanan untuk mula merancang",
    view_cart: "Lihat Pelan",
    items: "item",
    three_highs_tip: "Tip Kesihatan Tiga Tinggi",
    clear_filters: "Kosongkan Penapis",
    sort_by: "Isih Mengikut",
    ascending: "Menaik",
    descending: "Menurun",
    confirm: "Sahkan",
    male: "Lelaki",
    female: "Perempuan",
    over_limit: "melebihi had harian",
    cal_status_ok: "Pengambilan kalori dalam had.",
    cal_status_over: "Pengambilan kalori melebihi had harian.",
    sugar_status_ok: "Pengambilan gula dalam had.",
    sugar_status_over: "Pengambilan gula melebihi had harian.",
    fat_status_ok: "Pengambilan lemak dalam had.",
    fat_status_over: "Pengambilan lemak melebihi had harian.",
    sodium_status_ok: "Pengambilan natrium dalam had.",
    sodium_status_over: "Pengambilan natrium melebihi had harian.",
    gi_status_low: "Purata GI rendah — mesra gula darah.",
    gi_status_high: "Purata GI tinggi — boleh meningkatkan gula darah.",
    show_more: "Tunjuk lagi",
    show_less: "Tunjuk kurang",
    back_to_search: "Kembali ke Carian",
  },
  zh: {
    title: "搜索食物",
    subtitle: "浏览食物并规划您的每日摄入量。",
    search_placeholder: "在这里搜索食物...",
    no_results: "未找到食物。请尝试不同的搜索。",
    nutrition_guide: "营养指南和颜色图例",
    nutrition_guide_description: "点击查看糖、脂肪、钠和GI的颜色指南",
    click_hint: "点击食物查看详情或添加到每日计划",
    nutrition_sugar: "糖",
    nutrition_cal: "大卡",
    nutrition_gi: "GI",
    nutrition_fat: "脂肪",
    nutrition_sodium: "钠",
    portion: "份量",
    portion_plate: "盘",
    portion_bowl: "碗",
    portion_piece: "个",
    portion_pieces: "个",
    portion_mixed: "混合",
    portion_serving: "份",
    portion_cup: "杯",
    portion_sticks: "串",
    portion_with_sauce: "配酱",
    portion_glass: "杯",
    portion_scoop: "勺",
    portion_scoops: "勺",
    portion_medium: "中等",
    portion_slice: "片",
    portion_slices: "片",
    tip_label: "健康提示",
    close: "关闭",
    daily_sugar_women: "女性 < 25g",
    daily_sugar_men: "男性 < 36g",
    daily_sugar_title: "每日糖分限制:",
    gi_legend_title: "GI指南",
    gi_description: "GI显示食物升高血糖的速度。",
    risk_low: "低",
    risk_medium: "中",
    risk_high: "高",
    gi_short_explanation: "GI显示食物升高血糖的速度。",
    gi_popup_title: "什么是血糖指数（GI）？",
    gi_popup_description: "血糖指数（GI）是一个评分系统，衡量含碳水化合物的食物影响血糖水平的速度。食物在0到100的范围内评分，纯葡萄糖为100。",
    gi_popup_why_important: "为什么GI很重要？",
    gi_popup_importance: "选择低GI食物有助于：维持稳定的血糖水平、降低糖尿病并发症风险、控制食欲和体重，并提供全天持续的能量。",
    gi_low: "低GI (0-55)",
    gi_low_value: "",
    gi_medium: "中GI (56-69)",
    gi_medium_value: "",
    gi_high: "高GI (70+)",
    gi_high_value: "",
    gi_best_choice: "最佳选择",
    gi_moderate: "适中",
    gi_limit_intake: "限制摄入",
    sugar_guide_title: "糖分指南",
    fat_guide_title: "脂肪指南",
    sodium_guide_title: "钠指南",
    sodium_short_explanation: "高钠会升高血压。",
    sodium_popup_title: "什么是钠？",
    sodium_popup_description: "钠是一种存在于盐和许多加工食品中的矿物质。虽然我们的身体需要一些钠，但过多可能导致高血压，增加心脏病和中风的风险。",
    sodium_popup_why_important: "为什么要限制钠？",
    sodium_popup_importance: "减少钠摄入可以帮助：降低血压、减少心脏病风险、预防肾脏损伤、减少水肿。",
    sodium_low: "低 (≤300mg)",
    sodium_low_value: "",
    sodium_medium: "中 (301-600mg)",
    sodium_medium_value: "",
    sodium_high: "高 (≥601mg)",
    sodium_high_value: "",
    daily_intake: "每日摄取量",
    add_to_cart: "加入购物车",
    added: "已加入购物车",
    pagination_previous: "上一页",
    pagination_next: "下一页",
    pagination_showing: "显示",
    pagination_of: "共",
    pagination_results: "结果",
    exceeded_by: "超出",
    remove: "移除",
    clear_all: "清空",
    total: "总计",
    daily_limit: "每日限量",
    no_items: "计划中没有食物",
    no_items_hint: "点击食物上的'+'开始规划",
    view_cart: "查看计划",
    items: "项",
    three_highs_tip: "三高健康提示",
    clear_filters: "清除筛选",
    sort_by: "排序方式",
    ascending: "升序",
    descending: "降序",
    confirm: "确认",
    male: "男性",
    female: "女性",
    over_limit: "超出每日限量",
    cal_status_ok: "卡路里摄取在限量内。",
    cal_status_over: "卡路里摄取超出每日限量。",
    sugar_status_ok: "糖分摄取在限量内。",
    sugar_status_over: "糖分摄取超出每日限量。",
    fat_status_ok: "脂肪摄取在限量内。",
    fat_status_over: "脂肪摄取超出每日限量。",
    sodium_status_ok: "钠摄取在限量内。",
    sodium_status_over: "钠摄取超出每日限量。",
    gi_status_low: "平均GI偏低 — 对血糖友好。",
    gi_status_high: "平均GI偏高 — 可能导致血糖飙升。",
    show_more: "展开更多",
    show_less: "收起",
    back_to_search: "返回搜索",
  },
}

// Cart context for daily intake
type CartContextType = {
  cart: FoodItem[]
  addToCart: (food: FoodItem) => void
  removeFromCart: (index: number) => void
  clearCart: () => void
  isInCart: (name: string) => boolean
}

const CartContext = createContext<CartContextType | null>(null)

function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart must be used within CartProvider")
  return context
}

// Level indicator component
function LevelIcon({ level }: { level: "low" | "medium" | "high" }) {
  if (level === "low") return <TrendingDown className="w-3 h-3" />
  if (level === "medium") return <Minus className="w-3 h-3" />
  return <TrendingUp className="w-3 h-3" />
}

// Colorblind-friendly pill styles based on level - using orange-yellow for high
const getLevelPillStyle = (level: "low" | "medium" | "high") => {
  if (level === "low") return "bg-[#B5E0F1] border-[#1a5276] text-[#1a5276]"
  if (level === "medium") return "bg-[#E6EAC7] border-[#4a5a23] text-[#4a5a23]"
  return "bg-[#FFF3CD] border-[#856404] text-[#856404]"
}

function FoodCard({ food, t, lang }: { food: FoodItem; t: typeof pageContent.en; lang: LangCode }) {
  const [open, setOpen] = useState(false)
  const { addToCart, removeFromCart, isInCart, cart } = useCart()

  // Translate portion text (e.g., "1 plate (350g)" -> "1 pinggan (350g)")
  const translatePortion = (portion: string): string => {
    return portion
      .replace(/\bplate\b/gi, t.portion_plate)
      .replace(/\bbowl\b/gi, t.portion_bowl)
      .replace(/\bpieces\b/gi, t.portion_pieces)
      .replace(/\bpiece\b/gi, t.portion_piece)
      .replace(/\bmixed\b/gi, t.portion_mixed)
      .replace(/\bserving\b/gi, t.portion_serving)
      .replace(/\bcup\b/gi, t.portion_cup)
      .replace(/\bsticks\b/gi, t.portion_sticks)
      .replace(/\bwith sauce\b/gi, t.portion_with_sauce)
      .replace(/\bglass\b/gi, t.portion_glass)
      .replace(/\bscoops\b/gi, t.portion_scoops)
      .replace(/\bscoop\b/gi, t.portion_scoop)
      .replace(/\bmedium\b/gi, t.portion_medium)
      .replace(/\bslices\b/gi, t.portion_slices)
      .replace(/\bslice\b/gi, t.portion_slice)
  }
  const inCart = isInCart(food.name)
  const cartIndex = cart.findIndex(f => f.name === food.name)

  const sugarLevel = getSugarLevel(food.sugar)
  const giLevel = getGILevel(food.gi)
  const fatLevel = getFatLevel(food.fat)
  const sodiumLevel = getSodiumLevel(food.sodium)

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="bg-card rounded-2xl border-2 border-border overflow-hidden hover:border-primary hover:shadow-lg transition-all group cursor-pointer">
        {/* Image */}
        <div className="relative h-40 sm:h-40 w-full">
          <Image src={food.image} alt={food.name} fill className="object-cover group-hover:scale-105 transition-transform" />
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-left flex-1 min-w-0">
              <h3 className="text-xl font-bold group-hover:text-primary transition-colors leading-tight">{food.name}</h3>
            </div>
            {/* Add/Remove button - aligned with title */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (inCart) {
                  removeFromCart(cartIndex)
                } else {
                  addToCart(food)
                }
              }}
              className={`px-4 py-3 md:py-2 rounded-xl flex items-center justify-center gap-1.5 shrink-0 transition-all active:scale-95 text-base font-bold whitespace-nowrap ${inCart
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-primary/20 text-foreground border-2 border-border"
                }`}
              aria-label={inCart ? t.remove : t.add_to_cart}
            >
              {inCart ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{inCart ? t.added : t.add_to_cart}</span>
            </button>
          </div>

          {/* Nutrition grid - 2 rows for 5 values with colorblind-friendly colors */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className={`rounded-xl px-2 py-2 text-center border ${getLevelPillStyle(sugarLevel)}`}>
              <div className="flex items-center justify-center gap-1">
                <LevelIcon level={sugarLevel} />
                <span className="text-base font-bold">{food.sugar}</span>
              </div>
              <div className="text-xs md:text-sm font-medium">{t.nutrition_sugar}</div>
            </div>
            <div className="bg-muted rounded-xl px-2 py-2 text-center border border-border">
              <div className="text-base font-bold text-foreground">{food.calories}</div>
              <div className="text-xs md:text-sm font-medium text-muted-foreground">{t.nutrition_cal}</div>
            </div>
            <div className={`rounded-xl px-2 py-2 text-center border ${getLevelPillStyle(giLevel)}`}>
              <div className="flex items-center justify-center gap-1">
                <LevelIcon level={giLevel} />
                <span className="text-base font-bold">{food.gi}</span>
              </div>
              <div className="text-xs md:text-sm font-medium">{t.nutrition_gi}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-xl px-2 py-2 text-center border ${getLevelPillStyle(fatLevel)}`}>
              <div className="flex items-center justify-center gap-1">
                <LevelIcon level={fatLevel} />
                <span className="text-base font-bold">{food.fat}</span>
              </div>
              <div className="text-xs md:text-sm font-medium">{t.nutrition_fat}</div>
            </div>
            <div className={`rounded-xl px-2 py-2 text-center border ${getLevelPillStyle(sodiumLevel)}`}>
              <div className="flex items-center justify-center gap-1">
                <LevelIcon level={sodiumLevel} />
                <span className="text-base font-bold">{food.sodium}</span>
              </div>
              <div className="text-xs md:text-sm font-medium">{t.nutrition_sodium}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {open && (
        <div className="fixed inset-0 bg-foreground/80 z-80 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-card rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-48 sm:h-56 w-full">
              <Image src={food.image} alt={food.name} fill className="object-cover" />
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-foreground">{food.name}</h3>
                  <p className="text-base text-muted-foreground">{t.portion}: {translatePortion(food.portion)}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-3 md:p-2 hover:bg-muted rounded-full transition-colors"
                  aria-label={t.close}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Add/Remove button */}
              <button
                onClick={() => {
                  if (inCart) {
                    removeFromCart(cartIndex)
                  } else {
                    addToCart(food)
                  }
                }}
                className={`w-full mb-4 py-3 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all ${inCart
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-primary/20 border-2 border-border"
                  }`}
              >
                {inCart ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {inCart ? t.added : t.add_to_cart}
              </button>

              {/* Nutrition grid in modal - matching food card style */}
              <div className="grid grid-cols-3 gap-2 md:gap-3 mb-3">
                <div className={`rounded-xl px-3 py-2 text-center border min-h-[48px] ${getLevelPillStyle(sugarLevel)}`}>
                  <div className="flex items-center justify-center gap-1">
                    <LevelIcon level={sugarLevel} />
                    <span className="text-lg font-bold">{food.sugar}</span>
                  </div>
                  <div className="text-sm font-medium">{t.nutrition_sugar}</div>
                </div>
                <div className="bg-muted rounded-xl px-3 py-2 text-center border border-border min-h-[48px]">
                  <div className="text-lg font-bold text-foreground">{food.calories}</div>
                  <div className="text-sm font-medium text-muted-foreground">{t.nutrition_cal}</div>
                </div>
                <div className={`rounded-xl px-3 py-2 text-center border min-h-[48px] ${getLevelPillStyle(giLevel)}`}>
                  <div className="flex items-center justify-center gap-1">
                    <LevelIcon level={giLevel} />
                    <span className="text-lg font-bold">{food.gi}</span>
                  </div>
                  <div className="text-sm font-medium">{t.nutrition_gi}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4">
                <div className={`rounded-xl px-3 py-2 text-center border min-h-[48px] ${getLevelPillStyle(fatLevel)}`}>
                  <div className="flex items-center justify-center gap-1">
                    <LevelIcon level={fatLevel} />
                    <span className="text-lg font-bold">{food.fat}</span>
                  </div>
                  <div className="text-sm font-medium">{t.nutrition_fat}</div>
                </div>
                <div className={`rounded-xl px-3 py-2 text-center border min-h-[48px] ${getLevelPillStyle(sodiumLevel)}`}>
                  <div className="flex items-center justify-center gap-1">
                    <LevelIcon level={sodiumLevel} />
                    <span className="text-lg font-bold">{food.sodium}</span>
                  </div>
                  <div className="text-sm font-medium">{t.nutrition_sodium}</div>
                </div>
              </div>

              {/* Daily limits reference */}
              <div className="text-base text-muted-foreground text-center mb-4 bg-muted rounded-xl px-4 py-3">
                <div className="font-semibold text-foreground mb-1">{t.daily_sugar_title}</div>
                <div className="flex justify-center gap-6">
                  <span>{t.daily_sugar_women}</span>
                  <span>{t.daily_sugar_men}</span>
                </div>
              </div>

              {/* Health tip - Three Highs focused */}
              {(() => {
                const sugarVal = typeof food.sugar === 'string' ? parseFloat(food.sugar.replace(/[^0-9.]/g, '')) : food.sugar;
                const giVal = typeof food.gi === 'string' ? parseFloat(food.gi.replace(/[^0-9.]/g, '')) : food.gi;
                const fatVal = typeof food.fat === 'string' ? parseFloat(food.fat.replace(/[^0-9.]/g, '')) : food.fat;
                const sodiumVal = typeof food.sodium === 'string' ? parseFloat(food.sodium.replace(/[^0-9.]/g, '')) : food.sodium;
                const isHighRisk = sugarVal > 22.5 || giVal >= 70 || fatVal >= 16 || sodiumVal >= 601;
                return (
                  <div className={`flex items-start gap-2 rounded-xl p-4 ${isHighRisk ? 'bg-[#FFF3CD] border border-[#856404]' : 'bg-accent/20'}`}>
                    <Info className={`w-5 h-5 shrink-0 mt-0.5 ${isHighRisk ? 'text-[#856404]' : 'text-accent-foreground'}`} />
                    <p className={`text-base ${isHighRisk ? 'text-[#856404] font-extrabold' : 'text-foreground'}`}>
                      <span className="font-bold">{t.three_highs_tip}:</span> {food.tip[lang] || food.tip.en}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Daily Intake Cart Panel
function DailyIntakePanel({ t, isOpen, onClose }: { t: typeof pageContent.en; isOpen: boolean; onClose: () => void }) {
  const { cart, removeFromCart, clearCart } = useCart()
  const [gender, setGender] = useState<"male" | "female">(() => {
    if (typeof window === "undefined") return "male"
    const saved = localStorage.getItem("manis-gender")
    return saved === "female" ? "female" : "male"
  })

  // Save gender to localStorage when it changes
  const handleGenderChange = (newGender: "male" | "female") => {
    setGender(newGender)
    localStorage.setItem("manis-gender", newGender)
  }

  // Calculate totals
  const totals = cart.reduce((acc, food) => ({
    sugar: acc.sugar + parseFloat(food.sugar.replace(/[^0-9.]/g, '')),
    calories: acc.calories + parseFloat(food.calories.replace(/[^0-9.]/g, '')),
    fat: acc.fat + parseFloat(food.fat.replace(/[^0-9.]/g, '')),
    sodium: acc.sodium + parseFloat(food.sodium.replace(/[^0-9.]/g, '')),
    gi: acc.gi + parseFloat(food.gi.replace(/[^0-9.]/g, '')),
  }), { sugar: 0, calories: 0, fat: 0, sodium: 0, gi: 0 })

  const limits = {
    sugar: gender === "male" ? dailyLimits.sugar.men : dailyLimits.sugar.women,
    fat: gender === "male" ? dailyLimits.fat.men : dailyLimits.fat.women,
    sodium: gender === "male" ? dailyLimits.sodium.men : dailyLimits.sodium.women,
    cal: gender === "male" ? dailyLimits.cal.men : dailyLimits.cal.women,
    gi: dailyLimits.gi.men,
  }

  // Calculate excess amounts
  const excess = {
    sugar: totals.sugar > limits.sugar ? totals.sugar - limits.sugar : 0,
    fat: totals.fat > limits.fat ? totals.fat - limits.fat : 0,
    sodium: totals.sodium > limits.sodium ? totals.sodium - limits.sodium : 0,
    cal: totals.calories > limits.cal ? totals.calories - limits.cal : 0,
  }

  // Bright bar colors
  const barColors: Record<string, string> = {
    cal: "#3b82f6", // blue-500
    sugar: "#BA7517", // golden brown
    fat: "#7F77DD", // purple
    sodium: "#D4537E", // rose pink
  }

  // Horizontal bar with red limit line - compact version for mobile
  const NutritionBarCompact = ({
    label, value, limit, unit, color, excessAmount, statusOk, statusOver,
  }: {
    label: string; value: number; limit: number; unit: string;
    color: string; excessAmount: number; statusOk: string; statusOver: string;
  }) => {
    const isOver = value > limit
    const maxDisplay = limit * 1.1
    const fillPct = Math.min((value / maxDisplay) * 100, 100)
    const limitPct = (limit / maxDisplay) * 100

    return (
      <div className={`mb-2 rounded-xl transition-all ${isOver ? "bg-red-50 border border-red-300 p-1.5 -mx-1" : ""}`}>
        <div className="flex justify-between items-baseline mb-1">
          <div className="flex items-center gap-1">
            {isOver && (
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-600 shrink-0">
                <span className="text-white font-black leading-none" style={{ fontSize: "9px" }}>!</span>
              </span>
            )}
            <span className={`text-xs font-semibold ${isOver ? "text-red-800" : ""}`}>{label}</span>
          </div>
          <span className={`text-xs font-bold ${isOver ? "text-red-800" : "text-foreground"}`}>
            {value}{unit} / {limit}{unit}
          </span>
        </div>
        <div className="relative h-4 bg-background rounded-full overflow-visible">
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
          <div className="mt-1 flex items-center gap-1">
            <span className="inline-block bg-red-600 text-white text-[12px] font-black px-1.5 py-0.5 rounded-full leading-none tracking-wide uppercase">
              +{excessAmount}{unit} {t.exceeded_by.toLowerCase()}
            </span>
            <span className="text-sm md:text-base text-red-700 font-semibold">{statusOver}</span>
          </div>
        )}
        {!isOver && (
          <p className="text-sm md:text-base mt-0.5 leading-relaxed text-muted-foreground">{statusOk}</p>
        )}
      </div>
    )
  }

  // Horizontal bar with red limit line - full version for desktop
  const NutritionBar = ({
    label, value, limit, unit, color, statusOk, statusOver, excessAmount,
  }: {
    label: string; value: number; limit: number; unit: string;
    color: string; statusOk: string; statusOver: string; excessAmount: number;
  }) => {
    const isOver = value > limit
    const maxDisplay = limit * 1.1
    const fillPct = Math.min((value / maxDisplay) * 100, 100)
    const limitPct = (limit / maxDisplay) * 100

    return (
      <div className={`mb-3 rounded-xl transition-all ${isOver ? "bg-red-50 border border-red-300 p-2 -mx-1" : ""}`}>
        <div className="flex justify-between items-baseline mb-1">
          <div className="flex items-center gap-1.5">
            {isOver && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-600 shrink-0">
                <span className="text-white font-black leading-none" style={{ fontSize: "10px" }}>!</span>
              </span>
            )}
            <span className={`text-base font-semibold ${isOver ? "text-red-800" : ""}`}>{label}</span>
          </div>
          <span className={`text-base font-bold ${isOver ? "text-red-800" : "text-foreground"}`}>
            {value}{unit} / {limit}{unit}
          </span>
        </div>
        <div className="relative h-4 bg-background rounded-full overflow-visible">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${fillPct}%`, backgroundColor: isOver ? "#dc2626" : color, opacity: isOver ? 1 : 0.85}}
          />
          <div
            className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-red-700 rounded-full z-10"
            style={{ left: `${limitPct}%` }}
          />
        </div>
        {isOver && excessAmount > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="inline-block bg-red-600 text-white text-sm font-black px-2 py-0.5 rounded-full leading-none tracking-wide uppercase">
              +{excessAmount}{unit} {t.exceeded_by.toLowerCase()}
            </span>
            <span className="text-sm text-red-700 font-semibold">{statusOver}</span>
          </div>
        )}
        {!isOver && (
          <p className="text-sm mt-1 leading-relaxed text-muted-foreground">{statusOk}</p>
        )}
      </div>
    )
  }

  if (!isOpen) return null

  // Reverse cart for display (newest on top)
  const displayCart = [...cart].reverse()

  return (
    <div className="fixed inset-0 bg-foreground/80 z-100 flex items-center justify-center p-2 md:p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] overflow-hidden shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - always visible */}
        <div className="bg-card border-b border-border px-3 md:px-6 py-2 md:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <ShoppingCart className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            <h3 className="text-lg md:text-2xl font-bold text-foreground">{t.daily_intake}</h3>
            <span className="bg-primary text-primary-foreground text-xs md:text-sm px-2 py-0.5 md:px-2.5 md:py-1 rounded-full font-semibold">{cart.length}</span>
          </div>
          <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="text-center py-12">
              <ShoppingCart className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
              <p className="text-xl font-bold text-muted-foreground">{t.no_items}</p>
              <p className="text-base text-muted-foreground mt-2 leading-relaxed">{t.no_items_hint}</p>
            </div>
          </div>
        ) : (
          <>
            {/* MOBILE LAYOUT */}
            <div className="md:hidden flex flex-col flex-1 overflow-hidden">
              {/* Sticky top section (gender + nutrition bars + cal) */}
              <div className="shrink-0 bg-card px-3 py-2 border-b border-border">
                {/* Gender toggle - compact */}
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => handleGenderChange("male")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${gender === "male"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-foreground border-border"
                      }`}
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="10" cy="14" r="5" />
                      <path d="M19 5l-5.4 5.4" />
                      <path d="M15 5h4v4" />
                    </svg>
                    {t.male}
                  </button>
                  <button
                    onClick={() => handleGenderChange("female")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${gender === "female"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-foreground border-border"
                      }`}
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="5" />
                      <path d="M12 13v8" />
                      <path d="M9 18h6" />
                    </svg>
                    {t.female}
                  </button>
                </div>

                {/* Compact nutrition bars */}
                <div className="bg-muted rounded-xl p-2 mb-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-bold text-foreground">{t.total} vs {t.daily_limit}</h4>
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
                  />
                </div>

                {/* Cal card - full width, compact, no limit shown */}
                <div className="rounded-xl px-3 py-2 bg-muted">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{t.nutrition_cal}</p>
                    <p className="text-lg font-bold">
                      {totals.calories} <span className="text-xs font-normal text-muted-foreground">kcal</span>
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
                          <Image src={food.image} alt={food.name} fill className="object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm line-clamp-2">{food.name}</h4>
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

              {/* Clear all button - always at bottom */}
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

            {/* DESKTOP LAYOUT - Two columns */}
            <div className="hidden md:flex flex-1 overflow-hidden">
              {/* Left column - Stats (no scroll needed) */}
              <div className="w-1/2 p-4 border-r border-border flex flex-col">
                {/* Gender toggle */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => handleGenderChange("male")}
                    className={`flex-1 py-2 rounded-xl text-base font-bold border-2 transition-all flex items-center justify-center gap-2 ${gender === "male"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-foreground border-border hover:border-primary/50"
                      }`}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="10" cy="14" r="5" />
                      <path d="M19 5l-5.4 5.4" />
                      <path d="M15 5h4v4" />
                    </svg>
                    {t.male}
                  </button>
                  <button
                    onClick={() => handleGenderChange("female")}
                    className={`flex-1 py-2 rounded-xl text-base font-bold border-2 transition-all flex items-center justify-center gap-2 ${gender === "female"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-foreground border-border hover:border-primary/50"
                      }`}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="5" />
                      <path d="M12 13v8" />
                      <path d="M9 18h6" />
                    </svg>
                    {t.female}
                  </button>
                </div>

                {/* Nutrition bars */}
                <div className="bg-muted rounded-2xl p-3 mb-3 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-base font-bold text-foreground">{t.total} vs {t.daily_limit}</h4>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
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
                  />
                </div>

                {/* Cal card - full width, no limit shown */}
                <div className="rounded-xl p-3 bg-muted">
                  <p className="text-base text-muted-foreground mb-1">{t.nutrition_cal}</p>
                  <p className="text-2xl font-bold">
                    {totals.calories} <span className="text-base font-normal text-muted-foreground">kcal</span>
                  </p>
                </div>
              </div>

              {/* Right column - Food list (scrollable) with Clear All at bottom */}
              <div className="w-1/2 flex flex-col">
                {/* Scrollable food list */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-2">
                    {displayCart.map((food, index) => {
                      const originalIndex = cart.length - 1 - index
                      const foodSugarLevel = getSugarLevel(food.sugar)
                      const foodGiLevel = getGILevel(food.gi)
                      const foodFatLevel = getFatLevel(food.fat)
                      const foodSodiumLevel = getSodiumLevel(food.sodium)

                      // Pill style function for food items
                      const getPillStyle = (level: "low" | "medium" | "high") => {
                        if (level === "low") return "bg-[#B5E0F1] border-[#1a5276] text-[#1a5276]"
                        if (level === "medium") return "bg-[#E6EAC7] border-[#4a5a23] text-[#4a5a23]"
                        return "bg-[#FFF3CD] border-[#856404] text-[#856404]"
                      }

                      return (
                        <div key={originalIndex} className="flex items-start gap-3 bg-muted rounded-xl p-3">
                          <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-border">
                            <Image src={food.image} alt={food.name} fill className="object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Row 1: Food name */}
                            <h4 className="font-bold text-base mb-2 leading-tight">{food.name}</h4>
                            {/* Label row + value pill row — auto column widths fit content, 5 always on one line */}
                            {(() => {
                              const nutrients = [
                                { label: t.nutrition_sugar, value: food.sugar, style: getPillStyle(foodSugarLevel), flex: "flex-1" },
                                { label: t.nutrition_gi, value: food.gi, style: getPillStyle(foodGiLevel), flex: "flex-1" },
                                { label: t.nutrition_fat, value: food.fat, style: getPillStyle(foodFatLevel), flex: "flex-1" },
                                { label: t.nutrition_sodium, value: food.sodium, style: getPillStyle(foodSodiumLevel), flex: "flex-[1.6]" },
                                { label: t.nutrition_cal, value: food.calories, style: "bg-zinc-300 border-zinc-400 text-zinc-800", flex: "flex-1" },
                              ]
                              return (
                                <div className="flex gap-2 flex-nowrap">
                                  {nutrients.map(({ label, value, style, flex }) => (
                                    <div key={label} className={`flex flex-col items-center gap-0.5 ${flex} min-w-0`}>
                                      <span className="text-xs text-muted-foreground font-medium text-center leading-tight truncate w-full">{label}</span>
                                      <span className={`text-sm font-bold rounded border px-2 py-1 w-full flex items-center justify-center min-h-6 ${style}`}>{value}</span>
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

                {/* Clear all button - always at bottom of right column */}
                <div className="shrink-0 px-4 py-3 border-t border-border bg-card">
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

function FoodClientInner({ lang, initialFoods }: { lang: LangCode; initialFoods: FoodItem[] }) {
  const t = pageContent[lang]
  const cats = categories[lang]

  const [search, setSearch] = useState("")
  const [selectedCats, setSelectedCats] = useState<number[]>([]) // Empty = All, or array of selected indices (excluding 0 which is "All")
  const [cart, setCart] = useState<FoodItem[]>([])
  const [cartLoaded, setCartLoaded] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [giInfoOpen, setGiInfoOpen] = useState(false)
  const [sodiumInfoOpen, setSodiumInfoOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [sortActive, setSortActive] = useState(false)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [sortBy, setSortBy] = useState<"sugar" | "cal" | "gi" | "fat" | "sodium">("sugar")
  const [tempSortOrder, setTempSortOrder] = useState<"asc" | "desc">("asc")
  const [tempSortBy, setTempSortBy] = useState<"sugar" | "cal" | "gi" | "fat" | "sodium">("sugar")
  const [guideOpen, setGuideOpen] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const foodGridRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showFloatingButton, setShowFloatingButton] = useState(false)
  const [isNearBottom, setIsNearBottom] = useState(false)
  const ITEMS_PER_PAGE = 15

  // Track scroll position for floating button - hide when near bottom and show static button instead
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const distanceFromBottom = documentHeight - scrollY - windowHeight

      // Show floating button only if scrolled past 400px AND more than 300px from bottom
      const nearBottom = distanceFromBottom <= 300
      setShowFloatingButton(scrollY > 400 && !nearBottom)
      setIsNearBottom(scrollY > 400 && nearBottom)
    }
    window.addEventListener("scroll", handleScroll)
    handleScroll() // Check initial position
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("manis-cart")
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart)
        if (Array.isArray(parsed)) {
          setCart(parsed)
        }
      } catch {
        // Invalid JSON, ignore
      }
    }
    setCartLoaded(true)
  }, [])

  // Save cart to localStorage whenever it changes (only after initial load)
  useEffect(() => {
    if (cartLoaded) {
      localStorage.setItem("manis-cart", JSON.stringify(cart))
    }
  }, [cart, cartLoaded])

  // Cart functions
  const addToCart = (food: FoodItem) => setCart(prev => [...prev, food])
  const removeFromCart = (index: number) => setCart(prev => prev.filter((_, i) => i !== index))
  const clearCart = () => setCart([])
  const isInCart = (name: string) => cart.some(f => f.name === name)

  // Category toggle function - multi-select
  const toggleCategory = (index: number) => {
    if (index === 0) {
      // "All" clicked - clear all selections
      setSelectedCats([])
    } else {
      setSelectedCats(prev => {
        if (prev.includes(index)) {
          // Remove if already selected
          return prev.filter(i => i !== index)
        } else {
          // Add to selection
          return [...prev, index]
        }
      })
    }
  }

  // Clear all filters (categories + sort) and close filter panel
  const clearAllFilters = () => {
    setSelectedCats([])
    setSortActive(false)
    setSortOrder("asc")
    setSortBy("sugar")
    setSortOpen(false) // Close the filter panel
  }

  // Open sort popup
  const openSortPopup = () => {
    setTempSortOrder(sortOrder)
    setTempSortBy(sortBy)
    setSortOpen(true)
  }

  // Confirm sort
  const confirmSort = () => {
    setSortOrder(tempSortOrder)
    setSortBy(tempSortBy)
    setSortActive(true)
    setSortOpen(false)
  }

  // Clear sort
  const clearSort = () => {
    setSortActive(false)
    setSortOrder("asc")
    setSortBy("sugar")
  }

  // Persist state
  useEffect(() => {
    const savedCats = sessionStorage.getItem("food-selectedCats")
    const savedSearch = sessionStorage.getItem("food-search")
    const savedCart = sessionStorage.getItem("food-cart")
    if (savedCats) setSelectedCats(JSON.parse(savedCats))
    if (savedSearch) setSearch(savedSearch)
  }, [])

  useEffect(() => {
    sessionStorage.setItem("food-selectedCats", JSON.stringify(selectedCats))
    sessionStorage.setItem("food-search", search)
  }, [selectedCats, search, cart])

  // Randomize initial foods on first load
  const shuffledFoods = useMemo(() => {
    const malaysian = initialFoods.filter(f => f.category === "Malaysian")
    const others = initialFoods.filter(f => f.category !== "Malaysian")

    const shuffle = (arr: typeof initialFoods) => {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }

    return [...shuffle(malaysian), ...shuffle(others)]
  }, [])

  const filtered = shuffledFoods.filter((f) => {
    // If no categories selected (or "All"), show all
    const foodCategories = f.category.split(",").map(c => c.trim())
    const catMatch = selectedCats.length === 0 || selectedCats.some(i => foodCategories.includes(categories.en[i]))
    const searchMatch = !search || f.name.toLowerCase().includes(search.toLowerCase())
    return catMatch && searchMatch
  }).sort((a, b) => {
    if (!sortActive) return 0
    const getValue = (food: FoodItem) => {
      switch (sortBy) {
        case "sugar": return parseInt(food.sugar.replace(/[^0-9]/g, ''), 10)
        case "cal": return parseInt(food.calories.replace(/[^0-9]/g, ''), 10)
        case "gi": return parseInt(food.gi.replace(/[^0-9]/g, ''), 10)
        case "fat": return parseInt(food.fat.replace(/[^0-9]/g, ''), 10)
        case "sodium": return parseInt(food.sodium.replace(/[^0-9]/g, ''), 10)
      }
    }
    const aVal = getValue(a)
    const bVal = getValue(b)
    return sortOrder === "asc" ? aVal - bVal : bVal - aVal
  })

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginatedFoods = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCats, search, sortActive, sortBy, sortOrder])

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i)
        pages.push("...")
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        pages.push(1)
        pages.push("...")
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push("...")
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
        pages.push("...")
        pages.push(totalPages)
      }
    }
    return pages
  }

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, isInCart }}>
      <div className="max-w-7xl mx-auto px-4 py-10 md:py-14 pb-24 space-y-10">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl md:text-5xl font-extrabold mb-4 text-balance">{t.title}</h1>
          <p className="text-lg md:text-xl text-muted-foreground">{t.subtitle}</p>
        </div>

        {/* GI Info Modal */}
        {giInfoOpen && (
          <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full min-h-screen bg-foreground/80 z-[100] flex items-center justify-center p-4" onClick={() => setGiInfoOpen(false)}>
            <div className="bg-card rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-2xl font-bold text-foreground">{t.gi_popup_title}</h3>
                  <button onClick={() => setGiInfoOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-base text-foreground mb-4 leading-relaxed">{t.gi_popup_description}</p>
                <h4 className="text-lg font-bold text-foreground mb-2">{t.gi_popup_why_important}</h4>
                <p className="text-base text-foreground mb-6 leading-relaxed">{t.gi_popup_importance}</p>
                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between gap-3 bg-[#B5E0F1] border border-[#1a5276] px-4 py-3 rounded-xl">
                    <div className={`flex ${t.gi_low_value ? "items-start" : "items-center"} gap-2`}>
                      <TrendingDown className={`w-5 h-5 text-[#1a5276] shrink-0 ${t.gi_low_value ? "mt-0.5" : ""}`} />
                      {t.gi_low_value ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-[#1a5276]">{t.gi_low}</span>
                          <span className="text-sm text-[#1a5276]">{t.gi_low_value}</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-[#1a5276]">{t.gi_low}</span>
                      )}
                    </div>
                    <span className="text-sm text-[#1a5276]/70 text-right shrink-0">{t.gi_best_choice}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-[#E6EAC7] border border-[#4a5a23] px-4 py-3 rounded-xl">
                    <div className={`flex ${t.gi_medium_value ? "items-start" : "items-center"} gap-2`}>
                      <Minus className={`w-5 h-5 text-[#4a5a23] shrink-0 ${t.gi_medium_value ? "mt-0.5" : ""}`} />
                      {t.gi_medium_value ? (
                        <div className="flex flex-col md:flex-row md:gap-1.5 md:items-baseline">
                          <span className="font-semibold text-[#4a5a23]">{t.gi_medium}</span>
                          <span className="font-semibold text-[#4a5a23]">{t.gi_medium_value}</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-[#4a5a23]">{t.gi_medium}</span>
                      )}
                    </div>
                    <span className="text-sm text-[#4a5a23]/70 text-right shrink-0">{t.gi_moderate}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-[#FFF3CD] border border-[#856404] px-4 py-3 rounded-xl">
                    <div className={`flex ${t.gi_high_value ? "items-start" : "items-center"} gap-2`}>
                      <TrendingUp className={`w-5 h-5 text-[#856404] shrink-0 ${t.gi_high_value ? "mt-0.5" : ""}`} />
                      {t.gi_high_value ? (
                        <div className="flex flex-col md:flex-row md:gap-1.5 md:items-baseline">
                          <span className="font-extrabold text-[#856404]">{t.gi_high}</span>
                          <span className="font-extrabold text-[#856404]">{t.gi_high_value}</span>
                        </div>
                      ) : (
                        <span className="font-extrabold text-[#856404]">{t.gi_high}</span>
                      )}
                    </div>
                    <span className="text-sm text-[#856404]/70 text-right">{t.gi_limit_intake}</span>
                  </div>
                </div>
                <button
                  onClick={() => setGiInfoOpen(false)}
                  className="w-full bg-primary text-primary-foreground font-bold text-lg py-3 rounded-xl hover:opacity-90"
                >
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sodium Info Modal */}
        {sodiumInfoOpen && (
          <div className="fixed top-0 left-0 right-0 bottom-0 w-full h-full min-h-screen bg-foreground/80 z-[100] flex items-center justify-center p-4" onClick={() => setSodiumInfoOpen(false)}>
            <div className="bg-card rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-2xl font-bold text-foreground">{t.sodium_popup_title}</h3>
                  <button onClick={() => setSodiumInfoOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-base text-foreground mb-4 leading-relaxed">{t.sodium_popup_description}</p>
                <h4 className="text-lg font-bold text-foreground mb-2">{t.sodium_popup_why_important}</h4>
                <p className="text-base text-foreground mb-6 leading-relaxed">{t.sodium_popup_importance}</p>
                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between gap-3 bg-[#B5E0F1] border border-[#1a5276] px-4 py-3 rounded-xl">
                    <div className={`flex ${t.sodium_low_value ? "items-start" : "items-center"} gap-2`}>
                      <TrendingDown className={`w-5 h-5 text-[#1a5276] shrink-0 ${t.sodium_low_value ? "mt-0.5" : ""}`} />
                      {t.sodium_low_value ? (
                        <div className="flex flex-col md:flex-row md:gap-1.5 md:items-baseline">
                          <span className="font-semibold text-[#1a5276]">{t.sodium_low}</span>
                          <span className="font-semibold text-[#1a5276]">{t.sodium_low_value}</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-[#1a5276] whitespace-nowrap">{t.sodium_low}</span>
                      )}
                    </div>
                    <span className="text-sm text-[#1a5276]/70 text-right shrink-0">{t.gi_best_choice}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-[#E6EAC7] border border-[#4a5a23] px-4 py-3 rounded-xl">
                    <div className={`flex ${t.sodium_medium_value ? "items-start" : "items-center"} gap-2`}>
                      <Minus className={`w-5 h-5 text-[#4a5a23] shrink-0 ${t.sodium_medium_value ? "mt-0.5" : ""}`} />
                      {t.sodium_medium_value ? (
                        <div className="flex flex-col md:flex-row md:gap-1.5 md:items-baseline">
                          <span className="font-semibold text-[#4a5a23]">{t.sodium_medium}</span>
                          <span className="font-semibold text-[#4a5a23]">{t.sodium_medium_value}</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-[#4a5a23]">{t.sodium_medium}</span>
                      )}
                    </div>
                    <span className="text-sm text-[#4a5a23]/70 text-right shrink-0">{t.gi_moderate}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-[#FFF3CD] border border-[#856404] px-4 py-3 rounded-xl">
                    <div className={`flex ${t.sodium_high_value ? "items-start" : "items-center"} gap-2`}>
                      <TrendingUp className={`w-5 h-5 text-[#856404] shrink-0 ${t.sodium_high_value ? "mt-0.5" : ""}`} />
                      {t.sodium_high_value ? (
                        <div className="flex flex-col md:flex-row md:gap-1.5 md:items-baseline">
                          <span className="font-extrabold text-[#856404]">{t.sodium_high}</span>
                          <span className="font-extrabold text-[#856404]">{t.sodium_high_value}</span>
                        </div>
                      ) : (
                        <span className="font-extrabold text-[#856404] whitespace-nowrap">{t.sodium_high}</span>
                      )}
                    </div>
                    <span className="text-sm text-[#856404]/70 text-right">{t.gi_limit_intake}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSodiumInfoOpen(false)}
                  className="w-full bg-primary text-primary-foreground font-bold text-lg py-3 rounded-xl hover:opacity-90"
                >
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fixed View Plan Button - hidden when any popup is open */}
        {!cartOpen && !giInfoOpen && !sodiumInfoOpen && (
          <button
            onClick={() => setCartOpen(true)}
            className="fixed top-[4.25rem] md:top-24 right-4 md:right-8 z-50 inline-flex items-center gap-2 px-5 md:px-6 py-2 md:py-2.5 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-lg"
          >
            <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
            <span className="text-base md:text-lg">{t.view_cart}</span>
            {cart.length > 0 && (
              <span className="bg-white text-primary text-sm md:text-base font-bold w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        )}

        {/* Floating Back to Search button - shows when scrolling, hides when static button is visible */}
        {showFloatingButton && !cartOpen && (
          <button
            onClick={() => {
              searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
              setTimeout(() => searchInputRef.current?.focus(), 500)
            }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold text-base shadow-lg flex items-center gap-2 active:scale-95 transition-all whitespace-nowrap hover:bg-primary/90"
          >
            <Search className="w-5 h-5" />
            {t.back_to_search}
          </button>
        )}

        {/* Reference Guides - collapsible */}
        <div className="-mx-4 sm:-mx-6 bg-background border-b border-border">
          {/* Toggle button */}
          <button
            onClick={() => setGuideOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 sm:px-6 py-3 text-left hover:bg-muted/50 transition-colors"
          >
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 font-bold text-primary text-base md:text-lg">
                <Info className="w-6 h-6 shrink-0" />
                {t.nutrition_guide}
              </span>
              {!guideOpen && (
                <span className="text-base text-muted-foreground pl-8">
                  {t.nutrition_guide_description}
                </span>
              )}
            </span>
            {guideOpen
              ? <ChevronUp className="w-5 h-5 text-foreground shrink-0" />
              : <ChevronDown className="w-5 h-5 text-foreground shrink-0" />
            }
          </button>

          {/* Collapsible content */}
          {guideOpen && (
            <div className="px-2 sm:px-6 pb-3 space-y-3 md:space-y-2">
              {/* Reference Guides */}
              <div className="-mx-4 sm:-mx-6 px-2 sm:px-6 py-2 bg-background border-b border-border">
                <div className="space-y-3 md:space-y-2">
                  {/* Sugar Guide row */}
                  <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-3 text-sm md:text-base">
                    <span className="font-bold text-primary shrink-0 whitespace-nowrap text-base md:text-base">{t.sugar_guide_title}:</span>
                    <div className="flex w-full gap-1 md:flex-wrap md:gap-3 md:w-auto">
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[#B5E0F1] border border-[#1a5276] text-[#1a5276] font-semibold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><TrendingDown className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_low}</span>
                        <span className="text-xs md:text-base">≤5g</span>
                      </span>
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[#E6EAC7] border border-[#4a5a23] text-[#4a5a23] font-semibold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><Minus className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_medium}</span>
                        <span className="text-xs md:text-base">6-15g</span>
                      </span>
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[#FFF3CD] border border-[#856404] text-[#856404] font-extrabold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><TrendingUp className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_high}</span>
                        <span className="text-xs md:text-base">≥16g</span>
                      </span>
                    </div>
                  </div>

                  {/* Fat Guide */}
                  <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-3 text-sm md:text-base">
                    <span className="font-bold text-primary shrink-0 whitespace-nowrap text-base md:text-base">{t.fat_guide_title}:</span>
                    <div className="flex w-full gap-1 md:flex-wrap md:gap-3 md:w-auto">
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[#B5E0F1] border border-[#1a5276] text-[#1a5276] font-semibold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><TrendingDown className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_low}</span>
                        <span className="text-xs md:text-base">≤5g</span>
                      </span>
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[#E6EAC7] border border-[#4a5a23] text-[#4a5a23] font-semibold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><Minus className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_medium}</span>
                        <span className="text-xs md:text-base">6-15g</span>
                      </span>
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[#FFF3CD] border border-[#856404] text-[#856404] font-extrabold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><TrendingUp className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_high}</span>
                        <span className="text-xs md:text-base">≥16g</span>
                      </span>
                    </div>
                  </div>

                  {/* Sodium Guide */}
                  <div className="flex flex-col gap-1.5 md:flex-row md:flex-nowrap md:items-center md:gap-3 text-sm md:text-base">
                    <span className="font-bold text-primary shrink-0 whitespace-nowrap text-base md:text-base">{t.sodium_guide_title}:</span>
                    <div className="flex w-full gap-1 md:flex-nowrap md:gap-3 md:w-auto md:items-center">
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[#B5E0F1] border border-[#1a5276] text-[#1a5276] font-semibold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><TrendingDown className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_low}</span>
                        <span className="text-xs md:text-base">≤300mg</span>
                      </span>
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[#E6EAC7] border border-[#4a5a23] text-[#4a5a23] font-semibold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><Minus className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_medium}</span>
                        <span className="text-xs md:text-base">301-600mg</span>
                      </span>
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[#FFF3CD] border border-[#856404] text-[#856404] font-extrabold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><TrendingUp className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_high}</span>
                        <span className="text-xs md:text-base">≥601mg</span>
                      </span>
                      <button
                        onClick={() => setSodiumInfoOpen(true)}
                        className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-base font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Info className="w-5 h-5" />
                        {t.sodium_short_explanation}
                      </button>
                    </div>
                    <button
                      onClick={() => setSodiumInfoOpen(true)}
                      className="w-full md:hidden justify-center inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      <Info className="w-4 h-4" />
                      {t.sodium_short_explanation}
                    </button>
                  </div>
                  {/* GI Guide */}
                  <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-3 text-sm md:text-base">
                    <span className="font-bold text-primary shrink-0 whitespace-nowrap text-base md:text-base">{t.gi_legend_title}:</span>
                    <div className="flex w-full gap-1 md:flex-wrap md:gap-3 md:w-auto">
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[#B5E0F1] border border-[#1a5276] text-[#1a5276] font-semibold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><TrendingDown className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_low}</span>
                        <span className="text-xs md:text-base">≤55</span>
                      </span>
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[#E6EAC7] border border-[#4a5a23] text-[#4a5a23] font-semibold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><Minus className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_medium}</span>
                        <span className="text-xs md:text-base">56-69</span>
                      </span>
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[#FFF3CD] border border-[#856404] text-[#856404] font-extrabold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><TrendingUp className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_high}</span>
                        <span className="text-xs md:text-base">≥70</span>
                      </span>
                    </div>
                    <button
                      onClick={() => setGiInfoOpen(true)}
                      className="w-full md:w-auto justify-center md:justify-start inline-flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2 rounded-full text-sm md:text-base font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      <Info className="w-4 h-4 md:w-5 md:h-5" />
                      {t.gi_short_explanation}
                    </button>
                  </div>
                  {/* Daily Sugar Limit */}
                  <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-3 text-sm md:text-base">
                    <span className="font-bold text-primary shrink-0 whitespace-nowrap text-base md:text-base">{t.daily_sugar_title}</span>
                    <div className="flex w-full gap-1 md:flex-wrap md:gap-3 md:w-auto">
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[var(--cb-blue)]/15 text-[var(--cb-blue-text)] font-semibold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><User className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />{t.risk_high === "High" ? "Men" : t.risk_high === "Tinggi" ? "Lelaki" : "男性"}</span>
                        <span className="text-xs md:text-base">&lt;36g</span>
                      </span>
                      <span className="flex-1 md:flex-none inline-flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 px-2 py-1.5 rounded-xl md:rounded-full bg-[var(--cb-pink)]/15 text-foreground font-semibold text-sm md:text-base md:px-4 md:py-2">
                        <span className="inline-flex items-center gap-0.5"><User className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0 text-[var(--cb-pink-text)]" />{t.risk_high === "High" ? "Women" : t.risk_high === "Tinggi" ? "Wanita" : "女性"}</span>
                        <span className="text-xs md:text-base">&lt;25g</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="search"
              placeholder={t.search_placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-14 pr-14 py-4 text-lg rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-muted rounded-xl">
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Category Filter row */}
          <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-3 md:overflow-x-auto md:pb-2 md:items-center">
            {cats.map((cat, i) => {
              const isActive = i === 0 ? selectedCats.length === 0 : selectedCats.includes(i)
              return (
                <button
                  key={i}
                  onClick={() => toggleCategory(i)}
                  className={`px-4 py-2.5 md:px-5 rounded-xl text-base font-bold transition-all border-2 whitespace-nowrap md:shrink-0 active:scale-95 ${isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:border-primary hover:bg-primary/5"
                    }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Filter row - funnel button and sort options */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Button - toggle on click */}
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className={`px-3 py-2.5 rounded-xl border-2 transition-all active:scale-95 shrink-0 ${sortOpen
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:border-primary hover:bg-primary/5"
                }`}
              aria-label={t.sort_by}
            >
              <Filter className="w-6 h-6" />
            </button>

            {/* Show active sort badge next to funnel when panel is closed */}
            {sortActive && !sortOpen && (
              <span className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted text-foreground font-semibold text-base border-2 border-border">
                {t[`nutrition_${sortBy}` as keyof typeof t]} · {sortOrder === "asc" ? t.ascending : t.descending}
              </span>
            )}

            {/* Sort options - shown when sortOpen is true */}
            {sortOpen && (
              <>
                {/* Desktop: inline layout */}
                <div className="hidden md:contents">
                  {/* Group 1: Order Selection - Blue background */}
                  <button
                    onClick={() => setTempSortOrder("asc")}
                    className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-base font-bold transition-all border whitespace-nowrap shrink-0 active:scale-95 ${tempSortOrder === "asc"
                      ? "bg-[#1a5276] text-white border-[#1a5276]"
                      : "bg-[#C9EBF8] text-[#1a5276] border-[#1a5276]/30 hover:border-[#1a5276]"
                      }`}
                  >
                    <ChevronUp className="w-5 h-5" />
                    {t.ascending}
                  </button>
                  <button
                    onClick={() => setTempSortOrder("desc")}
                    className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-base font-bold transition-all border whitespace-nowrap shrink-0 active:scale-95 ${tempSortOrder === "desc"
                      ? "bg-[#1a5276] text-white border-[#1a5276]"
                      : "bg-[#C9EBF8] text-[#1a5276] border-[#1a5276]/30 hover:border-[#1a5276]"
                      }`}
                  >
                    <ChevronDown className="w-5 h-5" />
                    {t.descending}
                  </button>

                  <div className="w-px h-8 bg-border shrink-0" />

                  {/* Group 2: Metric Selection - Sage background */}
                  {(["sugar", "cal", "gi", "fat", "sodium"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setTempSortBy(key)}
                      className={`px-5 py-2.5 rounded-xl text-base font-bold transition-all border whitespace-nowrap shrink-0 active:scale-95 ${tempSortBy === key
                        ? "bg-[#4a5a23] text-white border-[#4a5a23]"
                        : "bg-[#E6EAC7] text-[#4a5a23] border-[#4a5a23]/30 hover:border-[#4a5a23]"
                        }`}
                    >
                      {t[`nutrition_${key}` as keyof typeof t]}
                    </button>
                  ))}

                  <div className="w-px h-8 bg-border shrink-0" />

                  {/* Group 3: Confirm Button - Primary teal */}
                  <button
                    onClick={confirmSort}
                    className="px-5 py-2.5 rounded-xl text-base font-bold bg-primary text-primary-foreground border border-primary hover:bg-primary/90 active:scale-95 transition-all whitespace-nowrap shrink-0"
                  >
                    {t.confirm}
                  </button>

                  {/* Cancel Button - Neutral */}
                  <button
                    onClick={() => setSortOpen(false)}
                    className="p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary hover:bg-primary/5 transition-all active:scale-95 shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile: 3 row layout with dividers */}
                <div className="md:hidden w-full space-y-2">
                  {/* Row 1: Ascending / Descending */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTempSortOrder("asc")}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-base font-bold transition-all border active:scale-95 ${tempSortOrder === "asc"
                        ? "bg-[#1a5276] text-white border-[#1a5276]"
                        : "bg-[#C9EBF8] text-[#1a5276] border-[#1a5276]/30"
                        }`}
                    >
                      <ChevronUp className="w-5 h-5" />
                      {t.ascending}
                    </button>
                    <button
                      onClick={() => setTempSortOrder("desc")}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-base font-bold transition-all border active:scale-95 ${tempSortOrder === "desc"
                        ? "bg-[#1a5276] text-white border-[#1a5276]"
                        : "bg-[#C9EBF8] text-[#1a5276] border-[#1a5276]/30"
                        }`}
                    >
                      <ChevronDown className="w-5 h-5" />
                      {t.descending}
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-border" />

                  {/* Row 2: Sugar / Cal / GI / Fat / Sodium - grid with equal sizing */}
                  <div className="grid grid-cols-3 gap-2">
                    {(["sugar", "cal", "gi", "fat", "sodium"] as const).map((key) => (
                      <button
                        key={key}
                        onClick={() => setTempSortBy(key)}
                        className={`px-3 py-2.5 rounded-xl text-base font-bold transition-all border active:scale-95 text-center ${tempSortBy === key
                          ? "bg-[#4a5a23] text-white border-[#4a5a23]"
                          : "bg-[#E6EAC7] text-[#4a5a23] border-[#4a5a23]/30"
                          }`}
                      >
                        {t[`nutrition_${key}` as keyof typeof t]}
                      </button>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-border" />

                  {/* Row 3: Confirm / Cancel */}
                  <div className="flex gap-2">
                    <button
                      onClick={confirmSort}
                      className="flex-1 px-4 py-2.5 rounded-xl text-base font-bold bg-primary text-primary-foreground border border-primary hover:bg-primary/90 active:scale-95 transition-all"
                    >
                      {t.confirm}
                    </button>
                    <button
                      onClick={() => setSortOpen(false)}
                      className="p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-all active:scale-95"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Clear Filters button - full width, shown when any filter is active */}
          {(selectedCats.length > 1 || sortActive) && (
            <button
              onClick={clearAllFilters}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-transparent text-destructive font-bold text-base hover:bg-destructive/10 active:scale-[0.99] transition-all border-2 border-destructive"
            >
              <Trash2 className="w-5 h-5" />
              {t.clear_filters}
            </button>
          )}

          {/* Hint */}
          <div className="bg-[#B5E0F1] border border-[#1a5276]/30 rounded-2xl px-5 py-4 flex items-start gap-3">
            <Info className="w-6 h-6 text-[#1a5276] shrink-0 mt-0.5" />
            <p className="text-lg font-semibold text-[#1a5276] leading-relaxed">{t.click_hint}</p>
          </div>

          {/* Food Grid - max 3 columns */}
          {filtered.length === 0 ? (
            <div className="bg-muted rounded-2xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <p className="text-xl font-bold text-foreground mb-2">{t.no_results}</p>
            </div>
          ) : (
            <div ref={foodGridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 scroll-mt-24">
              {paginatedFoods.map((food, i) => (
                <FoodCard key={i} food={food} t={t} lang={lang} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex flex-col items-center gap-4 md:gap-6 pb-4">
            {/* Static Back to Search button - shows when near bottom */}
            {isNearBottom && !cartOpen && (
              <button
                onClick={() => {
                  searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                  setTimeout(() => searchInputRef.current?.focus(), 500)
                }}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold text-base shadow-lg flex items-center gap-2 active:scale-95 transition-all whitespace-nowrap hover:bg-primary/90"
              >
                <Search className="w-5 h-5" />
                {t.back_to_search}
              </button>
            )}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <button
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1))
                }}
                disabled={currentPage === 1}
                className="flex items-center gap-1.5 md:gap-2 px-4 md:px-5 py-2.5 md:py-3 text-base md:text-lg font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 shrink-0" />
                <span className="whitespace-nowrap">{t.pagination_previous}</span>
              </button>

              {getPageNumbers().map((page, idx) => (
                typeof page === "number" ? (
                  <button
                    key={idx}
                    onClick={() => {
                      if (currentPage !== page) { setCurrentPage(page) }
                    }}
                    className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full text-base md:text-lg font-medium transition-colors ${currentPage === page
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={idx} className="px-1.5 md:px-2 text-muted-foreground text-base md:text-lg">...</span>
                )
              ))}

              <button
                onClick={() => {
                  setCurrentPage(p => Math.min(totalPages, p + 1))
                }}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1.5 md:gap-2 px-4 md:px-5 py-2.5 md:py-3 text-base md:text-lg font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="whitespace-nowrap">{t.pagination_next}</span>
                <ChevronRight className="w-5 h-5 md:w-6 md:h-6 shrink-0" />
              </button>
            </div>

            <p className="text-base md:text-lg text-muted-foreground">
              {t.pagination_showing} {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} {t.pagination_of} {filtered.length} {t.pagination_results}
            </p>
          </div>
        )}

        {/* Cart Panel */}
        <DailyIntakePanel t={t} isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      </div>
    </CartContext.Provider>
  )
}

export default function FoodClient({ initialFoods }: { initialFoods: FoodItem[] }) {
  return (
    <PageLayout>
      {(lang) => <FoodClientInner lang={lang} initialFoods={initialFoods} />}
    </PageLayout>
  )
}